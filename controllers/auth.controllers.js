import User from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import sendEmail  from "../utils/nodemailer.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

// =================
// ✅ GENERATE OTP
// =================
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();  
}

// ===================================
// ✅ GENERATE ACCESS & REFRESH TOKEN
// ===================================
const generateTokens = async (user) => {
  try {   
          const accessToken = jwt.sign({
            _id: user._id,
            email: user.email,
            fullName: user.fullname,
          },
            process.env.JWT_SECRET,
          {
            expiresIn: process.env.JWT_EXPIRY
          });

          const refreshToken = jwt.sign({
            _id: user._id,
          },
            process.env.REFRESH_TOKEN_SECRET,
          {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
          });

          user.refreshToken = refreshToken;
          await user.save({ validateBeforeSave: false });

          return { accessToken, refreshToken };
  } catch (error) {
      return ApiError(res, 501, "Something went wrong while generating access and refresh token!")
  }
}

// ===========================
// ✅ REGISTER USER & SEND OTP
// ===========================
export const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, phone, address } = req.body;
    const profileImage = req.file?.path;
    try {
        if(!email || !password || !name || !phone) {
          const apiError = new ApiError(400, 'All fields are required!');
          return apiError.send(res);  
        }
    
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          const apiError = new ApiError(400, 'User already exists with this email!');
          return apiError.send(res);  
        }
    
        const otp = generateOtp();  
        if(!otp) {
          const apiError = new ApiError(500, 'Failed to generate OTP!');
          return apiError.send(res); 
        }

        // If profile image is provided, upload it to Cloudinary
        let cloudinaryResponse = null;
        if (profileImage) {
          cloudinaryResponse = await uploadOnCloudinary(profileImage);
          if (!cloudinaryResponse) {
            const apiError = new ApiError(500, 'Profile Image upload failed!');
            return apiError.send(res);  
          }
        }
    
        const user = await User.create({
            name,
            email,
            password,
            profileImage: cloudinaryResponse ? cloudinaryResponse.secure_url : null,
            otp,
            phone,
            role: 'user',
            resetToken: null,
            resetTokenExpiry: null,
            refreshToken: null,
            otpExpiry: Date.now() + 10 * 60 * 1000, 
            verified: false,   
        });

        if(!user) {
          const apiError = new ApiError(400, 'User Registration failed!');
          return apiError.send(res);  
        }
    
        // Send OTP to user's email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP for Registration',
            text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
        };

        if(!mailOptions) {
          const apiError = new ApiError(500, 'Failed to send OTP!');
          return apiError.send(res);
        }
    
        await sendEmail(mailOptions);
    
        return res
        .status(201)
        .json(new ApiResponse(201, user, 'User registered successfully. OTP sent to your email.'));
    } catch (err) {
      const apiError = new ApiError(501, 'User registration failed!', err.message);
      return apiError.send(res); 
    }
});

// =====================================
// ✅ VERIFY OTP (During Registration)
// =====================================
export const verifyOtpForRegistration = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;  

  try {
      const user = await User.findOne({ email });

      if (!user) {
          const apiError = new ApiError(404, 'User not found!');
          return apiError.send(res);
      }

      // Check if the OTP matches and if it hasn't expired
      if (user.otp !== otp || user.otpExpiry < Date.now()) {
          const apiError = new ApiError(400, 'Invalid or expired OTP!');
          return apiError.send(res);
      }

      // OTP is valid, mark the user as verified
      user.isVerified = true;
      await user.save();

      return res
          .status(200)
          .json(new ApiResponse(200, {}, 'OTP verified successfully. User registration completed.'));
  } catch (err) {
      const apiError = new ApiError(500, 'OTP verification failed!', err.message);
      return apiError.send(res);
  }
});

// =========
// ✅ LOGIN
// =========
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      const apiError = new ApiError(404, 'Invalid credentails!');
      return apiError.send(res); 
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      const apiError = new ApiError(401, 'Invalid Email or Password!');
      return apiError.send(res);   
    }

    const { accessToken, refreshToken } = await generateTokens(user);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken -otp -otpExpiry -resetToken -resetTokenExpiry");

    const isProduction = process.env.NODE_ENV === "production";

    const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'Strict',
    };

    return res
        .status(200)
        .cookie("accessToken" , accessToken, { ...cookieOptions, maxAge: 1 * 24 * 60 * 60 * 1000 })
        .cookie("refreshToken" , refreshToken , { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 })
        .json(
            new ApiResponse(
                200, 
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User loggedIn Successfully"
            )
        )
  } catch (err) {
    const apiError = new ApiError(500, 'Login failed!', err.message);
    return apiError.send(res); 
  }    
});

// ==============================
// ✅ FORGOT PASSWORD (Send OTP)
// ==============================
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
  
    try {
      const user = await User.findOne({ email });
  
      if (!user) {
        const apiError = new ApiError(404, 'User not found!');
        return apiError.send(res); 
      }
  
      const otp = generateOtp(); // Generate OTP for password reset
      if(!otp) {
        const apiError = new ApiError(500, 'Failed to generate OTP!');
        return apiError.send(res); 
      }
  
      user.otp = otp;
      user.otpExpiry = Date.now() + 10 * 60 * 1000; // OTP expires in 10 minutes
      await user.save();
  
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset OTP',
        text: `Your OTP for password reset is: ${otp}. It will expire in 10 minutes.`,
      };
  
      await sendEmail(mailOptions); // Send OTP to email
  
      return res
      .status(200)
      .json(new ApiResponse(200, {}, 'OTP sent to your email for password reset.'));
    } catch (err) {
      const apiError = new ApiError(500, 'Failed to send OTP!', err.message);
      return apiError.send(res); 
    }
});
  
// =================================
// ✅ VERIFY OTP FOR PASSWORD RESET
// =================================
export const verifyOtpForPasswordReset = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
  
    try {
      const user = await User.findOne({ email });
  
      if (!user || user.otp !== otp || user.otpExpiry < Date.now()) {
        const apiError = new ApiError(400, 'Invalid or expired OTP!');
        return apiError.send(res); 
      }
  
      // OTP is valid, proceed to password reset
      return res
      .status(200)
      .json(new ApiResponse(200, {}, 'OTP verified. You can now reset your password.'));
    } catch (err) {
      const apiError = new ApiError(500, 'OTP verification failed!', err.message);
      return apiError.send(res);
    }
});

// ===================
// ✅ RESET PASSWORD
// ===================
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword, otp } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      const apiError = new ApiError(404, 'User not found!');
      return apiError.send(res);
    }

    console.log(`Stored OTP: '${user.otp}'`, `Entered OTP: '${otp}'`);
    console.log(typeof user.otp, typeof otp);

    // Check if the OTP is valid and not expired
    if (user.otp !== otp || user.otpExpiry < Date.now()) {
      const apiError = new ApiError(400, 'Invalid or expired OTP!');
      return apiError.send(res); 
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const updatedUser = await User.updateOne(
      { email },
      {
        $set: {
          password: hashedPassword,
          otp: null,
          otpExpiry: null,
        }
      }
    );

    if(!updatedUser) {
      const apiError = new ApiError(400, 'Failed to reset Password!');
      return apiError.send(res); 
    }

    // Clear existing cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    const { accessToken, refreshToken } = await generateTokens(user);

    if (!accessToken || !refreshToken) {
      const apiError = new ApiError(500, 'Failed to generate new tokens!');
      return apiError.send(res); 
    }

    // Set new cookies with updated tokens
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'Strict',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'Strict',
    });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, 'Password reset successfully'));
  } catch (err) {
    const apiError = new ApiError(500, 'Password reset failed!', err.message);
    return apiError.send(res);
  }
});

// ===================
// ✅ REFRESH TOKEN
// ===================
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    const apiError = new ApiError(400, "Refresh token is required!");
    return apiError.send(res);
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded._id);

    if (!user || user.refreshToken !== refreshToken) {
      const apiError = new ApiError(401, "Invalid refresh token!");
      return apiError.send(res);
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user);

    return res.status(200).json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Tokens refreshed successfully"));
  } catch (err) {
    const apiError = new ApiError(500, "Failed to refresh token!", err.message);
    return apiError.send(res);
  }
});

// ================
// ✅ LOGOUT USER
// ================
export const logoutUser = asyncHandler(async (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  return res.status(200).json(new ApiResponse(200, {}, "User logged out successfully"));
});
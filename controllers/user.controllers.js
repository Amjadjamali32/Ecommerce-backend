import User from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

// =========================
// ✅ CHANGE PROFILE
// =========================
export const changeProfile = asyncHandler(async (req, res) => {
  const profileImage = req.file?.path;
  try {
    if (!profileImage) {
      const apiError = new ApiError(400, "Profile image is required!");
      return apiError.send(res);
    }

    // Check if the user exists
    const user = await User.findById(req.user._id);

    if (!user) {
      const apiError = new ApiError(404, "User not found!");
      return apiError.send(res);
    }

    // Delete old image from Cloudinary if it exists
    if (user.profileImage) {
      try {
        // Extract public_id from the Cloudinary URL
        const publicId = user.profileImage.split('/').pop().split('.')[0];
        await deleteFromCloudinary(publicId);
        console.log(`Deleted old image: ${publicId}`);
      } catch (deleteError) {
        console.error("Error deleting old image:", deleteError);
        // Continue with upload even if deletion fails
      }
    }

    // Upload new image to Cloudinary
    const cloudinaryResponse = await uploadOnCloudinary(profileImage);

    if (!cloudinaryResponse) {
      const apiError = new ApiError(500, "Failed to upload image to Cloudinary!");
      return apiError.send(res);
    }

    const updatedUser = User.findByIdAndUpdate(
      req.user._id, 
      { 
        profileImage: cloudinaryResponse.secure_url 
      }, 
      { 
        new: true 
      }
    );
    
    if (!updatedUser) {
      const apiError = new ApiError(404, "User not found!");
      return apiError.send(res);
    }

    return res.status(200).json(new ApiResponse(200, user, "Profile updated successfully"));
  } catch (err) {
    const apiError = new ApiError(500, "Profile update failed!", err.message);
    return apiError.send(res);
  }
});

// =======================
// ✅ UPDATE ACCOUNT INFO
// =======================
export const updateAccountInfo = asyncHandler(async (req, res) => {
  const { name, email, phone, address } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      const apiError = new ApiError(404, "User not found!");
      return apiError.send(res);
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    return res.status(200).json(new ApiResponse(200, user, "Account info updated successfully"));
  } catch (err) {
    const apiError = new ApiError(500, "Account info update failed!", err.message);
    return apiError.send(res);
  }
});

// ====================
// ✅ GET CURRENT USER 
// ====================
export const getCurrentUser = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      const apiError = new ApiError(404, "User not found!");
      return apiError.send(res);
    }

    return res.status(200).json(new ApiResponse(200, user, "User profile fetched successfully"));
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch user profile!", err.message);
    return apiError.send(res);
  }
});

// ==========================
// ✅ GET ALL USERS (ADMIN)
// ==========================
export const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const users = await User.find();

    if (!users || users.length == 0) {
      const apiError = new ApiError(404, "No users found!");
      return apiError.send(res);
    }

    return res.status(200).json(new ApiResponse(200, users, "Users fetched successfully"));
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch users!", err.message);
    return apiError.send(res);
  }
});

// ===========================
// ✅ GET SINGLE USER (ADMIN)
// ===========================
export const getSingleUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log("user Id: ", id);

  try {
    const user = await User.findById(id).select("-password");

    if (!user) {
      const apiError = new ApiError(404, "User not found!");
      return apiError.send(res);
    }

    return res.status(200).json(new ApiResponse(200, user, "User fetched successfully"));
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch user!", err.message);
    return apiError.send(res);
  }
});

// =======================
// ✅ DELETE USER (ADMIN)
// =======================
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findByIdAndDelete(id);

    if (!user || user.length == 0) {
      const apiError = new ApiError(404, "User not found!");
      return apiError.send(res);
    }

    return res.status(200).json(new ApiResponse(200, {}, "User deleted successfully"));
  } catch (err) {
    const apiError = new ApiError(500, "Failed to delete user!", err.message);
    return apiError.send(res);
  }
});

// ============================
// ✅ DELETE ALL USERS (ADMIN)
// ============================
export const deleteAllUsers = asyncHandler(async (req, res) => {
    try {
      await User.deleteMany();
  
      return res.status(200).json(new ApiResponse(200, {}, "All users deleted successfully"));
    } catch (err) {
      const apiError = new ApiError(500, "Failed to delete all users!", err.message);
      return apiError.send(res);
    }
});

// ====================================
// ✅ UPDATE USER ROLE AND INFO (ADMIN)
// ====================================
export const updateUserRoleAndInfo = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role, name, email, phone, address } = req.body;
  
    try {
      const user = await User.findById(id);
  
      if (!user) {
        const apiError = new ApiError(404, "User not found!");
        return apiError.send(res);
      }
  
      if (role) user.role = role;
      if (name) user.name = name;
      if (email) user.email = email;
      if (phone) user.phone = phone;
      if (address) user.address = address;
  
      await user.save();
  
      return res.status(200).json(new ApiResponse(200, user, "User role and info updated successfully"));
    } catch (err) {
      const apiError = new ApiError(500, "Failed to update user role and info!", err.message);
      return apiError.send(res);
    }
});
  
// ===================
// ✅ ADMIN DASHBOARD
// ===================
  export const adminDashboard = asyncHandler(async (req, res) => {
    try {
      const totalUsers = await User.countDocuments();
  
      return res.status(200).json(new ApiResponse(200, { totalUsers }, "Admin dashboard fetched successfully"));
    } catch (err) {
      const apiError = new ApiError(500, "Failed to fetch admin dashboard data!", err.message);
      return apiError.send(res);
    }
});
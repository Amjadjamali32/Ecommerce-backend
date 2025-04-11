import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

export const protect = asyncHandler(async (req, res, next) => {
  try {
      // Extract token from cookies or Authorization header
      const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer", "");

      // console.log('Token:', token); // Log the token

      if (!token) {
        const apiError = new ApiError(401, "Access denied. No Token provided!");
        return apiError.send(res);
      }

      // Verify the token
      const decodedTokenInfo = jwt.verify(token, process.env.JWT_SECRET);

      if (!decodedTokenInfo?._id) {
        const apiError = new ApiError(401, "Invalid token! Please login again.");
        return apiError.send(res);
      }

      // Fetch the user and exclude sensitive fields
      const user = await User.findById(decodedTokenInfo._id).select("-password -refreshToken");
      if (!user) {
        const apiError = new ApiError(404, "User not found!");
        return apiError.send(res);
      }

      // Attach user to the request object
      req.user = user;
      next();
  } catch (error) {
    const apiError = new ApiError(401, "Authentication failed!");
    return apiError.send(res);;
  }
});

export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admins only' });
  }
};
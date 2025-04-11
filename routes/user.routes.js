import router from "express";
import { fileUploadMiddleware } from "../middlewares/multer.js";
import { protect, admin } from "../middlewares/auth.js";
import { adminDashboard, changeProfile, getAllUsers, getCurrentUser, getSingleUser, updateAccountInfo } from "../controllers/user.controllers.js"

const userRouter = router.Router();

// user routes
userRouter.route("/updateProfile").post(protect, fileUploadMiddleware, changeProfile);
userRouter.route("/profile").get(protect, getCurrentUser);
userRouter.route("/update").get(protect, updateAccountInfo); // remaining

// admin routes
userRouter.route("/").get(protect, admin, getAllUsers);
userRouter.route("/:id").get(protect, admin, getSingleUser);
userRouter.route("/admin-dashboard").get(protect, admin, adminDashboard); // remaining for correction

export default userRouter;
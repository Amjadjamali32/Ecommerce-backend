import router from "express";
import { profileImageUpload } from "../middlewares/multer.js";
import { protect, admin } from "../middlewares/auth.js";
import { getAdminDashboard, updateUserProfile, getAllUsers, getCurrentUser, getSingleUser, deleteAllUsers, deleteUser, updateUserRoleAndInfo } from "../controllers/user.controllers.js"

const userRouter = router.Router();

// user routes
userRouter.route("/update-profile").put(protect, updateUserProfile, profileImageUpload);
userRouter.route("/profile").get(protect, getCurrentUser);

// admin routes
userRouter.route("/").get(protect, admin, getAllUsers);
userRouter.route("/admin-dashboard").get(protect, admin, getAdminDashboard); 
userRouter.route("/:id").get(protect, admin, getSingleUser);
userRouter.route("/").delete(protect, admin, deleteAllUsers); 
userRouter.route("/:id").delete(protect, admin, deleteUser);
userRouter.route("/:id").patch(protect, admin, updateUserRoleAndInfo);

export default userRouter;
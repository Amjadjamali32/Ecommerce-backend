import router from "express";
import { registerUser, verifyOtpForRegistration, loginUser, forgotPassword, resetPassword, verifyOtpForPasswordReset, logoutUser, refreshToken }  from "../controllers/auth.controllers.js";
import { profileImageUpload } from "../middlewares/multer.js";
import { protect } from "../middlewares/auth.js";

const authRouter = router();

authRouter.route("/register").post(registerUser, profileImageUpload);
authRouter.route("/verify").post(verifyOtpForRegistration)
authRouter.route("/login").post(loginUser)
authRouter.route("/forgot").post(forgotPassword)
authRouter.route("/verify/reset").post(verifyOtpForPasswordReset)
authRouter.route("/reset").post(resetPassword) 
authRouter.route("/refreshTokens").post(protect, refreshToken) 
authRouter.route("/logout").post(logoutUser)

export default authRouter;
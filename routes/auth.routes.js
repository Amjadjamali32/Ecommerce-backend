import router from "express";
import { registerUser, verifyOtpForRegistration, loginUser, forgotPassword, resetPassword, verifyOtpForPasswordReset, logoutUser, refreshToken, getGoogleAuthUrl, googleAuthCallback }  from "../controllers/auth.controllers.js";
import { profileImageUpload } from "../middlewares/multer.js";
import { protect } from "../middlewares/auth.js";
import passport from "passport";

const authRouter = router();

authRouter.route("/register").post(profileImageUpload, registerUser)
authRouter.route("/verify").post(verifyOtpForRegistration)
authRouter.route("/login").post(loginUser)
authRouter.route("/forgot").post(forgotPassword)
authRouter.route("/verify/reset").post(verifyOtpForPasswordReset)
authRouter.route("/reset").post(resetPassword) 
authRouter.route("/refreshTokens").post(protect, refreshToken) 
authRouter.route("/logout").post(logoutUser)

// social login routes
authRouter.route("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }), getGoogleAuthUrl)
authRouter.route("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), googleAuthCallback)
export default authRouter;
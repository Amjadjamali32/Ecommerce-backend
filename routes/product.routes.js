import router from "express";
import { fileUploadMiddleware } from "../middlewares/multer.js";
import { protect, admin } from "../middlewares/auth.js";
import { getAllProducts } from "../controllers/product.controllers.js";

const productRouter = router.Router();

// user routes

// admin routes
productRouter.route("/").get(protect, admin, getAllProducts);

export default productRouter;
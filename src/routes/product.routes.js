import router from "express";
import { productImageUpload } from '../middlewares/multer.js';
import { protect, admin } from "../middlewares/auth.js";
import { adminGetAllProducts, adminProductStats, createProduct, createProductReview, deleteProduct, deleteProductReview, getAllProducts, getProductDetails, getProductReviews, getSellerProducts, toggleProductFeature, updateProduct, addToWishlist, removeFromWishlist, getWishlist } from "../controllers/product.controllers.js";

const productRouter = router.Router();

productRouter.route("/").get(getAllProducts);
productRouter.route("/admin/").get(adminGetAllProducts);
productRouter.route("/").post(protect, admin, productImageUpload, createProduct);
productRouter.route("/wishlist/").get(protect, getWishlist);
productRouter.route("/:id").delete(protect, admin, deleteProduct);
productRouter.route("/:productId").get(getProductDetails);
productRouter.route("/review/:productId").post(protect, admin, createProductReview); 
productRouter.route("/review/:productId").get(getProductReviews);
productRouter.route("/review/:productId/:reviewId").delete(protect, deleteProductReview);
productRouter.route("/admin/products-dashboard").get(protect, admin, adminProductStats);
productRouter.route("/:productId").patch(protect, admin, toggleProductFeature);
productRouter.route("/delete/:productId").delete(protect, deleteProduct);
productRouter.route("/:productId").put(protect, admin, productImageUpload, updateProduct);
productRouter.route("/wishlist").post(protect, addToWishlist);
productRouter.route("/wishlist/:productId").delete(protect, removeFromWishlist);
productRouter.route("/").get(protect, getSellerProducts);

export default productRouter;
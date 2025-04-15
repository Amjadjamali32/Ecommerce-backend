import express from 'express';
import { 
  createOrder,
  confirmStripePayment,
  getOrderDetails,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  adminOrderStats,
  deleteOrder,
  downloadReceipt,
} from "../controllers/order.controllers.js";
import { protect, admin } from "../middlewares/auth.js";

const router = express.Router();

// User routes
router.route("/")
  .post(protect, createOrder)
  .get(protect, getUserOrders);

router.route("/confirm-payment").post(protect, confirmStripePayment);
router.route("/:orderId").get(protect, getOrderDetails);
router.route("/receipt/:orderId").get(protect, downloadReceipt);

// Admin routes
router.route("/admin/getAllorders").get(protect, admin, getAllOrders);

router.get("/admin/order-stats", protect, admin, adminOrderStats);
router.route("/admin/:orderId")
  .put(protect, admin, updateOrderStatus)
  .delete(protect, admin, deleteOrder);

export default router;
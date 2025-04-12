import express from 'express';
import { 
  createOrder,
  confirmStripePayment,
  getOrderDetails,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  adminOrderStats,
  deleteOrder
} from "../controllers/order.controllers.js";
import { protect, admin } from "../middlewares/auth.js";

const router = express.Router();

// User routes
router.route("/")
  .post(protect, createOrder)
  .get(protect, getUserOrders);

router.post("/confirm-payment", protect, confirmStripePayment);
router.get("/:orderId", protect, getOrderDetails);

// Admin routes
router.route("/admin/orders")
  .get(protect, admin, getAllOrders);

router.get("/admin/order-stats", protect, admin, adminOrderStats);
router.route("/admin/orders/:orderId")
  .put(protect, admin, updateOrderStatus)
  .delete(protect, admin, deleteOrder);

export default router;
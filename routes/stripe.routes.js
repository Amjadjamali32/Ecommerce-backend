// routes/stripe.routes.js
import express from "express";
import {
  createCheckoutSession,
  handleStripeWebhook,
} from "../controllers/stripe.controller.js";

const router = express.Router();

router.post("/create-checkout-session", createCheckoutSession);

// Stripe requires raw body for webhooks
router.post("/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

export default router;

import stripe from "../utils/stripe.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";

// Create Stripe Checkout Session
export const createCheckoutSession = async (req, res) => {
  try {
    const { cartItems, shippingInfo } = req.body;
    const user = req.user;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const line_items = cartItems.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
        },
        unit_amount: item.price * 100,
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: user.email,
      line_items,
      metadata: {
        userId: user._id.toString(),
        shipping: JSON.stringify(shippingInfo),
        cart: JSON.stringify(cartItems),
      },
      success_url: `${process.env.CLIENT_URL}/order-success`,
      cancel_url: `${process.env.CLIENT_URL}/cart`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe Checkout Error:", err);
    res.status(500).json({ message: "Failed to create checkout session" });
  }
};

// Stripe Webhook
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const cartItems = JSON.parse(session.metadata.cart);
    const shippingInfo = JSON.parse(session.metadata.shipping);

    try {
      const orderItems = await Promise.all(cartItems.map(async (item) => {
        const product = await Product.findById(item.productId);
        return {
          product: product._id,
          name: product.name,
          quantity: item.quantity,
          price: product.price,
          image: product.images[0],
        };
      }));

      const itemsPrice = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
      const shippingPrice = 20;
      const taxPrice = itemsPrice * 0.1;
      const totalPrice = itemsPrice + shippingPrice + taxPrice;

      await Order.create({
        user: userId,
        orderItems,
        shippingInfo,
        paymentInfo: {
          id: session.payment_intent,
          status: session.payment_status,
        },
        itemsPrice,
        shippingPrice,
        taxPrice,
        totalPrice,
      });

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Error creating order after payment:", error);
      res.status(500).send("Internal server error");
    }
  } else {
    res.status(400).end();
  }
};

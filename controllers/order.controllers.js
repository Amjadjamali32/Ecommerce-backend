import Order from "../models/order.models.js";
import Product from "../models/product.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// =============================
// ✅ CREATE ORDER (USER)
// =============================
export const createOrder = asyncHandler(async (req, res) => {
  const { 
    shippingInfo, 
    orderItems, 
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice 
  } = req.body;

  try {
    // Validate required fields
    if (!shippingInfo || !orderItems || orderItems.length === 0 || !paymentMethod) {
      const apiError = new ApiError(400, "Required fields are missing");
      return apiError.send(res);
    }

    // Validate and process order items
    const items = [];
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        const apiError = new ApiError(404, `Product not found: ${item.product}`);
        return apiError.send(res);
      }

      if (product.stock < item.quantity) {
        const apiError = new ApiError(400, `Insufficient stock for product: ${product.name}`);
        return apiError.send(res);
      }

      items.push({
        name: product.name,
        price: product.price,
        image: product.images[0],
        product: product._id,
        quantity: item.quantity
      });
    }

    // Create payment intent for Stripe
    let paymentIntent;
    if (paymentMethod === 'card') {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalPrice * 100), // Convert to cents
        currency: 'usd',
        metadata: { integration_check: 'accept_a_payment' },
      });
    }

    // Create order
    const order = await Order.create({
      user: req.user._id,
      shippingInfo,
      orderItems: items,
      paymentInfo: {
        id: paymentIntent?.id || 'cash_on_delivery',
        status: paymentIntent?.status || 'pending',
        method: paymentMethod
      },
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      paidAt: paymentMethod === 'card' ? Date.now() : undefined
    });

    // Reduce product stock (but don't commit until payment succeeds)
    if (paymentMethod === 'card') {
      for (const item of orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity }
        });
      }
    }

    return res.status(201).json(
      new ApiResponse(
        201, 
        { 
          order, 
          clientSecret: paymentIntent?.client_secret 
        }, 
        "Order created successfully"
      )
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to create order", err.message);
    return apiError.send(res);
  }
});

// =============================
// ✅ PROCESS STRIPE PAYMENT (USER)
// =============================
export const processStripePayment = asyncHandler(async (req, res) => {
  const { orderId, paymentId } = req.params;

  try {
    const order = await Order.findById(orderId);
    
    if (!order) {
      const apiError = new ApiError(404, "Order not found");
      return apiError.send(res);
    }

    // Verify the order belongs to the user
    if (order.user.toString() !== req.user._id.toString()) {
      const apiError = new ApiError(403, "Not authorized to process this order");
      return apiError.send(res);
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);

    if (paymentIntent.status !== 'succeeded') {
      const apiError = new ApiError(400, "Payment not succeeded");
      return apiError.send(res);
    }

    // Update order status
    order.paymentInfo.status = 'succeeded';
    order.paymentInfo.paidAt = Date.now();
    order.orderStatus = 'processing';
    await order.save();

    // Reduce product stock
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }

    return res.status(200).json(
      new ApiResponse(200, order, "Payment processed successfully")
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to process payment", err.message);
    return apiError.send(res);
  }
});

// =============================
// ✅ GET ORDER DETAILS (USER/ADMIN)
// =============================
export const getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name images price');

    if (!order) {
      const apiError = new ApiError(404, "Order not found");
      return apiError.send(res);
    }

    // Check if user is order owner or admin
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      const apiError = new ApiError(403, "Not authorized to view this order");
      return apiError.send(res);
    }

    return res.status(200).json(
      new ApiResponse(200, order, "Order details fetched successfully")
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch order details", err.message);
    return apiError.send(res);
  }
});

// =============================
// ✅ GET USER ORDERS (USER)
// =============================
export const getUserOrders = asyncHandler(async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort('-createdAt')
      .populate('orderItems.product', 'name images price');

    return res.status(200).json(
      new ApiResponse(200, orders, "User orders fetched successfully")
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch user orders", err.message);
    return apiError.send(res);
  }
});

// =============================
// ✅ GET ALL ORDERS (ADMIN)
// =============================
export const getAllOrders = asyncHandler(async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find()
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name images price');

    const totalOrders = await Order.countDocuments();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          orders,
          page,
          totalPages: Math.ceil(totalOrders / limit),
          totalOrders
        },
        "All orders fetched successfully"
      )
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch all orders", err.message);
    return apiError.send(res);
  }
});

// =============================
// ✅ UPDATE ORDER STATUS (ADMIN)
// =============================
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    if (!status) {
      const apiError = new ApiError(400, "Status is required");
      return apiError.send(res);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      const apiError = new ApiError(404, "Order not found");
      return apiError.send(res);
    }

    // Validate status transition
    const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      const apiError = new ApiError(400, "Invalid order status");
      return apiError.send(res);
    }

    // Special handling for cancelled orders
    if (status === 'cancelled') {
      // Restock products if order was already processing
      if (order.orderStatus === 'processing') {
        for (const item of order.orderItems) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: item.quantity }
          });
        }
      }
      
      // Refund payment if paid
      if (order.paymentInfo.status === 'succeeded' && order.paymentInfo.method === 'card') {
        try {
          await stripe.refunds.create({
            payment_intent: order.paymentInfo.id,
          });
        } catch (refundError) {
          console.error("Failed to process refund:", refundError);
        }
      }
    }

    order.orderStatus = status;
    
    // Set deliveredAt date if status is delivered
    if (status === 'delivered') {
      order.deliveredAt = Date.now();
    }

    await order.save();

    return res.status(200).json(
      new ApiResponse(200, order, "Order status updated successfully")
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to update order status", err.message);
    return apiError.send(res);
  }
});

// =============================
// ✅ ADMIN DASHBOARD ORDER STATS
// =============================
export const adminOrderStats = asyncHandler(async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalSales = await Order.aggregate([
      {
        $match: { 
          'paymentInfo.status': 'succeeded',
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalPrice" }
        }
      }
    ]);
    
    const pendingOrders = await Order.countDocuments({ orderStatus: 'processing' });
    const shippedOrders = await Order.countDocuments({ orderStatus: 'shipped' });
    
    const salesData = await Order.aggregate([
      {
        $match: { 
          'paymentInfo.status': 'succeeded',
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$totalPrice" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalOrders,
          totalSales: totalSales[0]?.total || 0,
          pendingOrders,
          shippedOrders,
          salesData
        },
        "Order statistics fetched successfully"
      )
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch order statistics", err.message);
    return apiError.send(res);
  }
});

// =============================
// ✅ DELETE ORDER (ADMIN)
// =============================
export const deleteOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      const apiError = new ApiError(404, "Order not found");
      return apiError.send(res);
    }

    // Restock products if order was processing
    if (order.orderStatus === 'processing') {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity }
        });
      }
    }

    await Order.findByIdAndDelete(orderId);

    return res.status(200).json(
      new ApiResponse(200, {}, "Order deleted successfully")
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to delete order", err.message);
    return apiError.send(res);
  }
});
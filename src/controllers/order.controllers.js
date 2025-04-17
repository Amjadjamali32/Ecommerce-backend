import Order from "../models/orders.models.js";
import Product from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Stripe from "stripe";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: '../.env' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ==================================
// ✅ CREATE ORDER(USER)
// ==================================
export const createOrder = asyncHandler(async (req, res) => {
  const {
    shippingInfo,
    orderItems,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  } = req.body;


  // Validate required fields
  if (!shippingInfo || !orderItems || orderItems.length === 0 || !paymentMethod) {
    const apiError = new ApiError(400, "Required fields are missing!");
    return apiError.send(res);
  }

  // Validate and process order items
  const items = [];
  for (const item of orderItems) {
    const product = await Product.findById(item.product);
    if (!product) {
      const apiError = new ApiError(404, `Product not found: ${item.product}!`);
      return apiError.send(res);
    }

    if (product.stock < item.quantity) {
      const apiError = new ApiError(400, `Insufficient stock for product: ${product.name}!`);
      return apiError.send(res);
    }

    items.push({
      name: product.name,
      price: product.price,
      image: product.images[0],
      product: product._id,
      quantity: item.quantity,
    });
  }

  // Create order with temporary paymentInfo.id
  let order = await Order.create({
    user: req.user._id,
    shippingInfo,
    orderItems: items,
    paymentInfo: {
      id: 'temp', // temporary value
      method: paymentMethod,
      status: 'pending',
    },
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  });

  // Handle card payments
  if (paymentMethod === 'card') {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        orderId: order._id.toString(),
        userId: req.user._id.toString(),
      },
    });

    // Update order with Stripe paymentIntent ID
    order.paymentInfo.id = paymentIntent.id;
    await order.save();

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          order,
          clientSecret: paymentIntent.client_secret,
        },
        'Order created successfully. Please complete payment.'
      )
    );
  }

  // For COD orders, update paymentInfo.id to 'manual'
  order.paymentInfo.id = 'manual';
  await order.save();

  return res
  .status(201)
  .json(
    new ApiResponse(201, order, 'Order created successfully. Payment will be collected on delivery.')
  );
});

// ==================================
// ✅ CONFIRM STRIPE PAYMENT (USER)
// ==================================
export const confirmStripePayment = asyncHandler(async (req, res) => {
  const { paymentIntentId, orderId } = req.body;
  if (!paymentIntentId || !orderId) {
    const apiError = new ApiError(404, "Payment intent ID and order ID are required!");
    return apiError.send(res);
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  console.log(paymentIntent.status); // Debugging line

  if (paymentIntent.status !== 'succeeded') {
    const apiError = new ApiError(400, "Payment not succeeded!");
    return apiError.send(res);
  }

  const order = await Order.findById(orderId).populate('user', 'name email');
  if (!order) {
    const apiError = new ApiError(404, "Order not found!");
    return apiError.send(res);
  } 

  if (order.user._id.toString() !== req.user._id.toString()) {
    const apiError = new ApiError(403, "Not authorized to update this order!");
    return apiError.send(res);
  }

  if (order.paymentInfo.status === 'succeeded') {
    const apiError = new ApiError(400, "Order is already paid!");
    return apiError.send(res);
  }

  // Update order status
  order.paymentInfo = {
    id: paymentIntentId,
    status: 'succeeded',
    method: 'card',
    paidAt: Date.now()
  };
  order.orderStatus = 'processing';

  for (const item of order.orderItems) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.quantity }
    });
  }

  await order.save();

  console.log(order);
  
  // ✅ Generate receipt
  const receiptPath = await generateReceipt(order, order.user);

  return res
  .status(200)
  .json(
    new ApiResponse(200, {
      order,
      receiptDownloadLink: `/api/orders/receipt/${order._id}`
    }, "Payment confirmed and receipt generated")
  );
});

// ==================================
// ✅ DOWNLOAD RECEIPT (USER)
// ==================================
export const downloadReceipt = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const receiptPath = path.join('receipts', `receipt-${orderId}.pdf`);

  if (!fs.existsSync(receiptPath)) {
    const apiError = new ApiError(400, "Receipt does not exist!");
    return apiError.send(res);
  }

  return res.download(receiptPath, `OrderReceipt-${orderId}.pdf`);
});

// ==================================
// ✅ GET ORDER DETAILS (USER/ADMIN)
// ==================================
export const getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId)
    .populate('user', 'name email')
    .populate('orderItems.product', 'name images price');

  if (!order) {
    throw new ApiError(404, "Order not found!");
  }

  // Check if user is order owner or admin
  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, "Not authorized to view this order");
  }

  return res.status(200).json(
    new ApiResponse(200, order, "Order details fetched successfully")
  );
});

// =============================
// ✅ GET USER ORDERS (USER)
// =============================
export const getUserOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .sort('-createdAt')
    .populate('orderItems.product', 'name images price');

  if(!orders || orders.length === 0) {
    const apiError = new ApiError(404, "No orders found for this user!");
    return apiError.send(res);
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200, orders, "User orders fetched successfully")
  );
});

// =============================
// ✅ GET ALL ORDERS (ADMIN)
// =============================
export const getAllOrders = asyncHandler(async (req, res) => {
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

  if(!orders || orders.length === 0) {
    const apiError = new ApiError(404, "No orders found!");
    return apiError.send(res);
  }

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
});

// ===============================
// ✅ UPDATE ORDER STATUS (ADMIN)
// ===============================
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!status) {
    const apiError = new ApiError(400, "Status is required!");
    return apiError.send(res);
  }

  const order = await Order.findById(orderId);
  if (!order) {
    const apiError = new ApiError(404, "Order not found!");
    return apiError.send(res);
  }

  // Validate status transition
  const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled', 'succeeded'];
  if (!validStatuses.includes(status)) {
    const apiError = new ApiError(400, "Invalid order status!");
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
  return res
  .status(200)
  .json(
    new ApiResponse(200, order, "Order status updated successfully")
  );
});

// ===============================
// ✅ ADMIN DASHBOARD ORDER STATS
// ===============================
export const adminOrderStats = asyncHandler(async (req, res) => {
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
});

// =============================
// ✅ DELETE ORDER (ADMIN)
// =============================
export const deleteOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) {
    const apiError = new ApiError(404, "Order not found!");
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
});
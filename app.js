import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from 'passport';
import setupPassport from './config/passport.config.js';

const app = express();

// For CORS errors we use this middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}));

app.use(express.json({ limit: "16kb"}))
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("Public"));
app.use(cookieParser());

// After app initialization but before routes
app.use(passport.initialize());
setupPassport();

// Routes 
import authRouter from './routes/auth.routes.js'
import userRouter from './routes/user.routes.js'
import productRouter from './routes/product.routes.js'
import orderRouter from "./routes/order.routes.js";

// Routes declaration
app.use("/api/v1/auth" , authRouter);
app.use("/api/v1/users" , userRouter);
app.use("/api/v1/products" , productRouter);
app.use("/api/v1/orders" , orderRouter);

export default app 
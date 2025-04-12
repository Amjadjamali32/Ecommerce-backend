import Product from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";

// =============================
// ✅ GET ALL PRODUCTS (PUBLIC)
// =============================
export const getAllProducts = asyncHandler(async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filtering
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    let query = Product.find(JSON.parse(queryStr));

    // Sorting
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Field limiting
    if (req.query.fields) {
      const fields = req.query.fields.split(',').join(' ');
      query = query.select(fields);
    } else {
      query = query.select('-__v');
    }

    // Execute query
    const products = await query.skip(skip).limit(limit);

    // Count total products for pagination
    const totalProducts = await Product.countDocuments(JSON.parse(queryStr));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          products,
          page,
          totalPages: Math.ceil(totalProducts / limit),
          totalProducts
        },
        "Products fetched successfully"
      )
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch products", err.message);
    return apiError.send(res);
  }
});

// ================================
// ✅ GET PRODUCT DETAILS (PUBLIC)
// ================================
export const getProductDetails = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await Product.findById(productId).populate('seller', 'name email');

    if (!product) {
      const apiError = new ApiError(404, "Product not found");
      return apiError.send(res);
    }

    return res.status(200).json(
      new ApiResponse(200, product, "Product details fetched successfully")
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch product details", err.message);
    return apiError.send(res);
  }
});

// ================================
// ✅ CREATE PRODUCT REVIEW (USER)
// ================================
export const createProductReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { rating, comment } = req.body;

  try {
    if (!rating || !comment) {
      const apiError = new ApiError(400, "Rating and comment are required");
      return apiError.send(res);
    }

    const product = await Product.findById(productId);

    if (!product) {
      const apiError = new ApiError(404, "Product not found");
      return apiError.send(res);
    }

    // Check if user already reviewed
    const alreadyReviewed = product.reviews.find(
      review => review.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      const apiError = new ApiError(400, "You have already reviewed this product");
      return apiError.send(res);
    }

    // Add review
    const review = {
      user: req.user._id,
      name: req.user.name,
      rating: Number(rating),
      comment
    };

    product.reviews.push(review);
    product.numOfReviews = product.reviews.length;

    // Calculate average rating
    product.rating = product.reviews.reduce(
      (acc, item) => item.rating + acc, 0
    ) / product.reviews.length;

    await product.save();

    return res.status(201).json(
      new ApiResponse(201, {}, "Review added successfully")
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to add review", err.message);
    return apiError.send(res);
  }
});

// ================================
// ✅ GET PRODUCT REVIEWS (PUBLIC)
// ================================
export const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await Product.findById(productId);

    if (!product) {
      const apiError = new ApiError(404, "Product not found");
      return apiError.send(res);
    }

    return res.status(200).json(
      new ApiResponse(200, product.reviews, "Reviews fetched successfully")
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch reviews", err.message);
    return apiError.send(res);
  }
});

// =====================================
// ✅ DELETE PRODUCT REVIEW (USER/ADMIN) 
// =====================================
export const deleteProductReview = asyncHandler(async (req, res) => {
  const { productId, reviewId } = req.params;
  console.log(req.user);
  

  // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(reviewId)) {
    return new ApiError(400, "Invalid product or review ID").send(res);
  }

  console.log("Deleting review:", { productId, reviewId, requestedBy: req.user._id });

  try {
    const product = await Product.findById(productId);

    if (!product) {
      return new ApiError(404, "Product not found").send(res);
    }

    const review = product.reviews.find(
      item => item._id.toString() === reviewId
    );

    if (!review) {
      return new ApiError(404, "Review not found").send(res);
    }

    // Check if user is review owner or admin
    if (
      review.user.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return new ApiError(403, "You are not authorized to delete this review").send(res);
    }

    // Remove the review
    product.reviews = product.reviews.filter(
      item => item._id.toString() !== reviewId
    );

    // Update product stats
    product.numOfReviews = product.reviews.length;

    const totalRating = product.reviews.reduce((acc, item) => acc + item.rating, 0);
    product.rating = product.numOfReviews > 0
      ? totalRating / product.numOfReviews
      : 0;

    await product.save();

    return res.status(200).json(
      new ApiResponse(200, {}, "Review deleted successfully")
    );

  } catch (err) {
    console.error("Error deleting review:", err);
    return new ApiError(500, "Failed to delete review", err.message).send(res);
  }
});

// ================================
// ✅ GET SELLER PRODUCTS (SELLER)  
// ================================
export const getSellerProducts = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user._id });

    return res.status(200).json(
      new ApiResponse(200, products, "Seller products fetched successfully")
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch seller products", err.message);
    return apiError.send(res);
  }
});

// =============================
// ✅ GET ALL PRODUCTS (ADMIN)
// =============================
export const adminGetAllProducts = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find().populate('seller', 'name email');

    return res.status(200).json(
      new ApiResponse(200, products, "All products fetched successfully")
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch all products", err.message);
    return apiError.send(res);
  }
});

// ==================================
// ✅ ADMIN DASHBOARD PRODUCTS STATS
// ==================================
export const adminProductStats = asyncHandler(async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();

    const distinctCategories = await Product.distinct('category');
    const totalCategories = distinctCategories.length;

    const newestProducts = await Product.find()
      .sort('-createdAt')
      .limit(5)
      .select('name price images createdAt');

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalProducts,
          totalCategories,
          newestProducts
        },
        "Product statistics fetched successfully"
      )
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to fetch product statistics", err.message);
    return apiError.send(res);
  }
});

// =====================================
// ✅ FEATURE/UNFEATURE PRODUCT (ADMIN)
// =====================================
export const toggleProductFeature = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await Product.findById(productId);

    if (!product) {
      const apiError = new ApiError(404, "Product not found");
      return apiError.send(res);
    }

    product.isFeatured = !product.isFeatured;
    await product.save();

    return res.status(200).json(
      new ApiResponse(
        200,
        { isFeatured: product.isFeatured },
        `Product ${product.isFeatured ? 'featured' : 'unfeatured'} successfully`
      )
    );
  } catch (err) {
    const apiError = new ApiError(500, "Failed to toggle product feature", err.message);
    return apiError.send(res);
  }
});

// =================================
// ✅ CREATE PRODUCT (ADMIN/SELLER)
// =================================
export const createProduct = asyncHandler(async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      stock,
      condition,
      year,
      mileage,
      make,
      model,
      engineType,
      color,
      transmission,
      fuelType,
      location,
      features,
      topSpeed
    } = req.body;

    // Validate required fields
    if (!name || !description || !price || !category || !make || !model) {
      const apiError = new ApiError(400, "Required fields are missing");
      return apiError.send(res);
    }

    // Handle image uploads
    const images = [];
    if (req.files) {
      for (const file of req.files) {
        const cloudinaryResponse = await uploadOnCloudinary(file.path);
        if (cloudinaryResponse) {
          images.push(cloudinaryResponse.secure_url);
        }
      }
    }

    if (!images.length) {
      return new ApiError(400, "At least one product image is required").send(res);
    }

    // Normalize features
    let featureList = [];
    if (typeof features === 'string') {
      featureList = features.split(',').map(f => f.trim());
    } else if (Array.isArray(features)) {
      featureList = features;
    }

    // Create product
    const product = await Product.create({
      name,
      description,
      price,
      images,
      category,
      stock,
      condition,
      year,
      mileage,
      make,
      model,
      engineType,
      color,
      transmission,
      fuelType,
      location,
      seller: req.user._id,
      features: featureList,
      topSpeed
    });

    return res.status(201).json(
      new ApiResponse(201, product, "Product created successfully")
    );

  } catch (err) {
    const apiError = new ApiError(500, "Failed to create product", err.message);
    return apiError.send(res);
  }
});

// =================================
// ✅ UPDATE PRODUCT (ADMIN/SELLER)  
// =================================
export const updateProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    try {
      const product = await Product.findById(productId);
  
      if (!product) {
        const apiError = new ApiError(404, "Product not found");
        return apiError.send(res);
      }
  
      // Check if user is seller or admin
      if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        const apiError = new ApiError(403, "You are not authorized to update this product");
        return apiError.send(res);
      }
  
      // Handle image updates
      if (req.files && req.files) {
        // Delete old images from Cloudinary
        for (const imageUrl of product.images) {
          try {
            const publicId = imageUrl.split('/').pop().split('.')[0];
            await deleteFromCloudinary(publicId);
          } catch (deleteError) {
            console.error("Error deleting old image:", deleteError);
          }
        }
  
        // Upload new images
        const newImages = [];
        for (const file of req.files) {
          const cloudinaryResponse = await uploadOnCloudinary(file.path);
          if (cloudinaryResponse) {
            newImages.push(cloudinaryResponse.secure_url);
          }
        }
        req.body.images = newImages;
      }
  
      // Update product
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        req.body,
        { new: true, runValidators: true }
      );
  
      return res.status(200).json(
        new ApiResponse(200, updatedProduct, "Product updated successfully")
      );
    } catch (err) {
      const apiError = new ApiError(500, "Failed to update product", err.message);
      return apiError.send(res);
    }
});
  
// =================================
// ✅ DELETE PRODUCT (ADMIN/SELLER) 
// =================================
export const deleteProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    console.log("Deleting product:", productId);
    
  
    try {
      const product = await Product.findById(productId);
  
      if (!product) {
        const apiError = new ApiError(404, "Product not found");
        return apiError.send(res);
      }
  
      // Check if user is seller or admin
      if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        const apiError = new ApiError(403, "You are not authorized to delete this product");
        return apiError.send(res);
      }
  
      // Delete images from Cloudinary
      for (const imageUrl of product.images) {
        try {
          const publicId = imageUrl.split('/').pop().split('.')[0];
          await deleteFromCloudinary(publicId);
        } catch (deleteError) {
          console.error("Error deleting image:", deleteError);
        }
      }
  
      await Product.findByIdAndDelete(productId);
  
      return res.status(200).json(
        new ApiResponse(200, {}, "Product deleted successfully")
      );
    } catch (err) {
      const apiError = new ApiError(500, "Failed to delete product", err.message);
      return apiError.send(res);
    }
});  
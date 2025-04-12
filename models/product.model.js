import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter product name'],
  },
  description: {
    type: String,
    required: [true, 'Please enter product description'],
  },
  price: {
    type: Number,
    required: [true, 'Please enter product price'],
  },
  images: {  
    type: [String],
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['Sedan', 'SUV', 'Truck', 'Coupe', 'Hatchback'],
  },
  stock: {
    type: Number,
    required: true,
    default: 1,
  },
  condition: {
    type: String,
    required: true,
    enum: ['New', 'Used', 'Certified Pre-Owned'],
  },
  year: {
    type: Number,
    required: true,
  },
  mileage: {
    type: Number,
    required: function() { return this.condition !== 'New'; },
  },
  make: {
    type: String,
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  engineType: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  transmission: {
    type: String,
    required: true,
  },
  fuelType: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  features: {
    type: [String],
    default: [],
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 5,
  },
  discount: {
    type: Number,
    default: 0,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  topSpeed: {
    type: Number,
    required: true,
  },
  // Added fields for better e-commerce functionality
  numOfReviews: {
    type: Number,
    default: 0,
  },
  reviews: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      rating: {
        type: Number,
        required: true,
      },
      comment: {
        type: String,
        required: true,
      },
    },
  ],
}, {
  timestamps: true,
});

const Product = mongoose.model('Product', productSchema);
export default Product;
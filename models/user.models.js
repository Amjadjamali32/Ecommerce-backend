import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter your name!'],
    index: true,
    trim: true,
  },
  email: {
    trim: true,
    index: true,
    type: String,
    required: [true, 'Please enter your email!'],
    unique: true,
  },
  password: {
    trim: true, 
    type: String,
    required: [true, 'Please enter your password!'],
    minlength: 8,
    validate: {
      validator: function (value) {
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/.test(value);
      },
      message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.',
    },
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  profileImage: {
    type: String,
    default: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
  },
  phone: {
    type: String,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: String,
    required: [true, 'Please enter your OTP!'],
    validate: {
      validator: function (value) {
        return /^\d{6}$/.test(value);
      },
      message: 'OTP must be a 6-digit number.',
    },
  },
  otpExpiry: {
    type: Date,
    required: [true, 'Please enter OTP expiry date!'],
  },
  refreshToken: String,
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;

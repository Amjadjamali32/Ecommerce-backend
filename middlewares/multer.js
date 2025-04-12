import multer from "multer";
import path from "path";

// 🔹 Common file filter for image validation
const fileFilter = function (req, file, cb) {
  const allowedTypes = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp)'), false);
  }
  cb(null, true);
};

// 🔹 Profile Image Storage
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp"); // Folder for profile images
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

// 🔹 Product Image Storage
const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp"); // Folder for product images
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${ext}`);
  }
});

// 🔹 Profile Image Upload Middleware (single image)
export const profileImageUpload = multer({
  storage: profileStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('profileImage');

// 🔹 Product Images Upload Middleware (multiple images)
export const productImageUpload = multer({
  storage: productStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).array('images', 5); 

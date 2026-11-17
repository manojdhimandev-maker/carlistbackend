const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const MAX_FILE_SIZE_MB = 200; // Allow large images up to 200 MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Store temporary upload files in system tmp directory to protect server memory (RAM)
const tempUploadDir = path.join(os.tmpdir(), 'carlist-uploads');
if (!fs.existsSync(tempUploadDir)) {
  try {
    fs.mkdirSync(tempUploadDir, { recursive: true });
  } catch (err) {
    console.error('[Upload Middleware] Failed to create temp upload directory:', err.message);
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempUploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'temp-car-' + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/avif',
  ];
  const allowedExts = /\.(jpeg|jpg|png|webp|avif)$/i;

  const extOk = allowedExts.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowedMimes.includes(file.mimetype.toLowerCase());

  if (extOk && mimeOk) {
    return cb(null, true);
  }

  const err = new Error(
    `Invalid file type "${file.originalname}". Only image files (JPEG, JPG, PNG, WEBP, AVIF) are allowed.`
  );
  err.code = 'INVALID_FILE_TYPE';
  cb(err);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 15,
  },
  fileFilter,
});

/**
 * Safely delete temporary files created during upload
 */
const cleanupTempFiles = (files) => {
  if (!files) return;
  const list = Array.isArray(files) ? files : [files];
  list.forEach((f) => {
    const filePath = typeof f === 'string' ? f : f?.path;
    if (filePath) {
      fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.warn(`[Upload Middleware] Failed to delete temp file ${filePath}:`, err.message);
        }
      });
    }
  });
};

/**
 * Error handler middleware for upload errors
 */
const handleUploadError = (err, req, res, next) => {
  if (!err) return next();

  // Clean up any partially-written files on error
  cleanupTempFiles([
    ...(req.files || []),
    ...(req.file ? [req.file] : []),
  ]);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_MB} MB per image.`,
    });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      message: 'Too many files. Maximum 15 images per upload.',
    });
  }
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected upload field name. Expected field: "images".',
    });
  }

  return res.status(400).json({
    success: false,
    message: err.message || 'File upload error',
  });
};

/**
 * Middleware chain helper: [upload.array(field, maxCount), handleUploadError]
 */
const uploadArray = (fieldName = 'images', maxCount = 15) => [
  upload.array(fieldName, maxCount),
  handleUploadError,
];

module.exports = {
  upload,
  uploadArray,
  handleUploadError,
  cleanupTempFiles,
  MAX_FILE_SIZE_MB,
};

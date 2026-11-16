const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB per file
const MAX_FILES = 10;                    // max images per request
const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp)$/;
const ALLOWED_EXT  = /\.(jpeg|jpg|png|webp)$/i;

// ─── Upload Directory ─────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ─── Storage: write original to a /tmp buffer first, process via Sharp ───────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'car-' + uniqueSuffix + ext);
  },
});

// ─── File Type Filter ─────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const extOk  = ALLOWED_EXT.test(path.extname(file.originalname));
  const mimeOk = ALLOWED_MIME.test(file.mimetype);

  if (extOk && mimeOk) {
    return cb(null, true);
  }
  // Reject with a typed error so the error handler can send 415
  const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
  err.message = `Unsupported file type "${file.mimetype}". Allowed formats: JPEG, JPG, PNG, WebP`;
  err.status  = 415;
  cb(err);
};

// ─── Multer Instance ──────────────────────────────────────────────────────────
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE, // 20 MB per file
    files:    MAX_FILES,     // max 10 files per request
  },
  fileFilter,
});

// ─── Sharp Post-Processing Middleware ─────────────────────────────────────────
// Called AFTER multer writes the file to disk.
// Re-encodes the image to keep quality high while normalising the format.
const processImages = async (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) return next();

  try {
    await Promise.all(
      files.map(async (file) => {
        const tmpPath  = file.path + '.tmp';

        // Rename original → tmp, re-encode → original path
        fs.renameSync(file.path, tmpPath);

        try {
          await sharp(tmpPath)
            .withMetadata()          // keep EXIF orientation
            .jpeg({ quality: 85, mozjpeg: true }) // sensible default; Sharp auto-converts format
            .toFile(file.path);

          // Update mimetype to reflect the re-encoded format (always JPEG output)
          file.mimetype = 'image/jpeg';
          if (!file.path.endsWith('.jpg') && !file.path.endsWith('.jpeg')) {
            // Rename on disk so the extension matches JPEG
            const jpgPath = file.path.replace(/\.(png|webp)$/i, '.jpg');
            fs.renameSync(file.path, jpgPath);
            file.path     = jpgPath;
            file.filename = path.basename(jpgPath);
          }
        } finally {
          // Always clean up the tmp file
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        }
      })
    );
    next();
  } catch (err) {
    // Clean up any files already written
    cleanupFiles(files);
    err.message = `Image processing failed: ${err.message}`;
    err.status  = 422;
    next(err);
  }
};

// ─── Cleanup Helper ───────────────────────────────────────────────────────────
const cleanupFiles = (files = []) => {
  files.forEach((file) => {
    if (file && file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }
  });
};

// ─── Multer Error Handler ─────────────────────────────────────────────────────
// Wraps a multer middleware so its errors surface as proper HTTP responses
// and partially-uploaded files are cleaned up automatically.
const handleMulterError = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (!err) return next();

    // Clean up any files that were already saved before the error
    const uploaded = req.files || (req.file ? [req.file] : []);
    cleanupFiles(uploaded);

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: `File too large. Maximum allowed size is ${MAX_FILE_SIZE / 1024 / 1024} MB per image.`,
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: `Too many files. Maximum ${MAX_FILES} images allowed per request.`,
        });
      }
      return res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Upload error',
      });
    }

    // Non-multer errors (e.g. file-filter rejection)
    return res.status(err.status || 400).json({
      success: false,
      message: err.message || 'Upload failed',
    });
  });
};

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // Raw multer instance (kept for backward compat if anything imports it directly)
  upload,

  // Ready-to-use route-level middlewares
  uploadArray:  (fieldName = 'images', maxCount = MAX_FILES) => [
    handleMulterError(upload.array(fieldName, maxCount)),
    processImages,
  ],
  uploadSingle: (fieldName = 'image') => [
    handleMulterError(upload.single(fieldName)),
    processImages,
  ],

  // Shared helpers
  cleanupFiles,
  MAX_FILE_SIZE,
  MAX_FILES,
};


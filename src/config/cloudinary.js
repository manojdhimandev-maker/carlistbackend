const cloudinary = require('cloudinary').v2;
const fs = require('fs');

/**
 * Check if Cloudinary credentials are present in env vars.
 * Evaluated lazily (at call time) so it works regardless of when
 * dotenv populates process.env relative to this module being loaded.
 */
const isConfigured = () =>
  Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME) &&
    (process.env.CLOUDINARY_API_KEY   || process.env.API_KEY_CLOUDINARY) &&
    (process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET_CLOUDINARY)
  );

/**
 * Apply Cloudinary config lazily – called once before the first upload.
 * This avoids reading env vars at module-load time (before dotenv runs).
 */
let _configured = false;
const ensureCloudinaryConfig = () => {
  if (_configured) return;
  const cloudName  = process.env.CLOUDINARY_CLOUD_NAME  || process.env.CLOUD_NAME;
  const apiKey     = process.env.CLOUDINARY_API_KEY     || process.env.API_KEY_CLOUDINARY;
  const apiSecret  = process.env.CLOUDINARY_API_SECRET  || process.env.API_SECRET_CLOUDINARY;

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key:    apiKey,
      api_secret: apiSecret,
      secure:     true,
    });
    _configured = true;
  } else {
    console.warn(
      '[Cloudinary] Missing configuration. ' +
      'Ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set in .env'
    );
  }
};

/**
 * Upload a local file to Cloudinary with chunked upload support for large files.
 * @param {string} filePath - Absolute path to temporary file
 * @param {object} options  - Optional Cloudinary upload options
 * @returns {Promise<{ secure_url, public_id, bytes, format, width, height }>}
 */
const uploadToCloudinary = async (filePath, options = {}) => {
  ensureCloudinaryConfig();

  if (!isConfigured()) {
    throw new Error(
      'Cloudinary is not configured. ' +
      'Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your backend .env file.'
    );
  }

  const uploadOptions = {
    folder: options.folder || 'fawmond-galaxy/vehicles',
    resource_type: 'image',
    chunk_size: 20 * 1024 * 1024, // 20 MB chunks
    ...options,
  };

  const startTime = Date.now();
  console.log(`[Cloudinary] Starting upload: ${filePath} → ${uploadOptions.folder}`);

  try {
     const result = await cloudinary.uploader.upload(filePath, uploadOptions);

      console.log("========== CLOUDINARY DEBUG ==========");
      console.log("Full Result:", result);
      console.log("Secure URL:", result?.secure_url);
      console.log("Public ID:", result?.public_id);
      console.log("======================================");

      if (!result?.secure_url || !result?.public_id) {
        throw new Error("Cloudinary upload succeeded but secure_url or public_id is missing.");
}
    const duration = Date.now() - startTime;
    console.log(
      `[Cloudinary] Upload complete in ${duration}ms | ` +
      `Public ID: ${result.public_id} | ` +
      `Size: ${(result.bytes / (1024 * 1024)).toFixed(2)} MB`
    );

    return {
      secure_url: result.secure_url,
      public_id:  result.public_id,
      bytes:      result.bytes,
      format:     result.format,
      width:      result.width,
      height:     result.height,
    };
  } catch (error) {
    console.error(`[Cloudinary] Upload error for ${filePath}:`, error.message);
    throw error;
  }
};

/**
 * Safely delete an asset from Cloudinary by public ID
 * @param {string} publicId
 * @returns {Promise<any>}
 */
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return null;
  ensureCloudinaryConfig();
  if (!isConfigured()) return null;
  try {
    console.log(`[Cloudinary] Deleting asset: ${publicId}`);
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`[Cloudinary] Deletion error for ${publicId}:`, error.message);
    return null;
  }
};

/**
 * Extract public_id from Cloudinary secure_url if stored without explicit public_id
 * Example: https://res.cloudinary.com/vo7myczi/image/upload/v12345/fawmond-galaxy/vehicles/car-123.jpg
 * Returns: fawmond-galaxy/vehicles/car-123
 */
const extractPublicId = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    let pathPart = parts[1];
    // Strip version prefix if present (e.g. v1234567890/)
    pathPart = pathPart.replace(/^v\d+\//, '');
    // Strip file extension
    const dotIdx = pathPart.lastIndexOf('.');
    if (dotIdx !== -1) {
      pathPart = pathPart.substring(0, dotIdx);
    }
    return pathPart;
  } catch {
    return null;
  }
};

module.exports = {
  cloudinary,
  isConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
};

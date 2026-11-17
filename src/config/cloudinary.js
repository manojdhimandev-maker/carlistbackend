const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary supporting both naming conventions
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY || process.env.API_KEY_CLOUDINARY;
const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET_CLOUDINARY;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
} else {
  console.warn(
    '[Cloudinary] Missing configuration. Ensure CLOUD_NAME, API_KEY_CLOUDINARY, and CLOUDINARY_API_SECRET are set in .env'
  );
}

/**
 * Check if Cloudinary is configured
 */
const isConfigured = () => {
  return Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME) &&
    (process.env.CLOUDINARY_API_KEY || process.env.API_KEY_CLOUDINARY) &&
    (process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET_CLOUDINARY)
  );
};

/**
 * Upload a local file to Cloudinary with chunked upload support for large files.
 * @param {string} filePath - Absolute path to temporary file
 * @param {object} options - Optional Cloudinary upload options
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
const uploadToCloudinary = async (filePath, options = {}) => {
  if (!isConfigured()) {
    throw new Error(
      'Cloudinary is not fully configured. Please set CLOUDINARY_API_SECRET in your backend environment variables.'
    );
  }

  const uploadOptions = {
    folder: options.folder || 'fawmond-galaxy/vehicles',
    resource_type: 'image',
    chunk_size: 20 * 1024 * 1024, // 20 MB chunks for handling large images up to 100MB-200MB
    ...options,
  };

  const startTime = Date.now();
  console.log(`[Cloudinary] Starting upload: ${filePath} (${uploadOptions.folder})`);

  try {
    // upload_large automatically splits large files into chunks
    const result = await cloudinary.uploader.upload_large(filePath, uploadOptions);
    const duration = Date.now() - startTime;
    console.log(
      `[Cloudinary] Upload complete in ${duration}ms | Public ID: ${result.public_id} | Size: ${(result.bytes / (1024 * 1024)).toFixed(2)} MB`
    );

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
      bytes: result.bytes,
      format: result.format,
      width: result.width,
      height: result.height,
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
  if (!publicId || !isConfigured()) return null;
  try {
    console.log(`[Cloudinary] Deleting asset: ${publicId}`);
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
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

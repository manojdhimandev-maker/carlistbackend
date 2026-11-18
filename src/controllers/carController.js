const Car = require('../models/Car');
const mongoose = require('mongoose');
const {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
  isConfigured,
} = require('../config/cloudinary');
const { cleanupTempFiles } = require('../middleware/upload');

// ─── Helper: format car for API response ─────────────────────────────────────
const formatCar = (car) => {
  const obj = car.toObject ? car.toObject({ virtuals: true }) : car;
  return {
    ...obj,
    id: obj.slug || obj._id.toString(),
  };
};

// ─── Helper: upload an array of multer temp-files to Cloudinary ───────────────
// Returns an array of { secure_url, public_id } objects.
// Always cleans up the local temp files whether upload succeeds or fails.
const uploadFilesToCloudinary = async (files) => {
  const results = await Promise.allSettled(
    files.map((file) =>
      uploadToCloudinary(file.path, { folder: 'fawmond-galaxy/vehicles' })
    )
  );

  // Always remove temp files from disk
  cleanupTempFiles(files);

  // Surface any rejection as a thrown error so callers can handle it
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    const reasons = failed.map((r) => r.reason?.message || 'Unknown error').join('; ');
    throw new Error(`Cloudinary upload failed for ${failed.length} file(s): ${reasons}`);
  }

  return results.map((r) => ({
    secure_url: r.value.secure_url,
    public_id: r.value.public_id,
  }));
};

// ─── Helper: determine whether a stored URL is a Cloudinary URL ───────────────
const isCloudinaryUrl = (url) =>
  typeof url === 'string' && url.includes('res.cloudinary.com');

// ─── @desc  Get all cars with search and filtering
// ─── @route GET /api/cars
exports.getCars = async (req, res) => {
  try {
    const {
      search,
      make,
      fuel,
      minPrice,
      maxPrice,
      minYear,
      maxMileage,
      featured,
      sort,
    } = req.query;

    const query = {};

    if (search && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term, 'i');
      query.$or = [
        { make: regex },
        { model: regex },
        { fuel: regex },
        { body: regex },
        { description: regex },
      ];
      const num = Number(term);
      if (!isNaN(num) && num > 1900 && num < 2100) {
        query.$or.push({ year: num });
      }
    }

    if (make)       query.make  = new RegExp(`^${make.trim()}$`, 'i');
    if (fuel)       query.fuel  = new RegExp(`^${fuel.trim()}$`, 'i');

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (minYear)    query.year    = { ...(query.year || {}), $gte: Number(minYear) };
    if (maxMileage) query.mileage = { $lte: Number(maxMileage) };
    if (featured !== undefined && featured !== '') {
      query.featured = featured === 'true' || featured === true;
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc')    sortOption = { price: 1 };
    if (sort === 'price_desc')   sortOption = { price: -1 };
    if (sort === 'year_desc')    sortOption = { year: -1 };
    if (sort === 'mileage_asc')  sortOption = { mileage: 1 };

    const cars = await Car.find(query).sort(sortOption);

    res.status(200).json({
      success: true,
      count: cars.length,
      data: cars.map(formatCar),
    });
  } catch (error) {
    console.error('Error in getCars:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cars',
      error: error.message,
    });
  }
};

// ─── @desc  Get single car by id or slug
// ─── @route GET /api/cars/:id
exports.getCarById = async (req, res) => {
  try {
    const { id } = req.params;
    let car = null;

    if (mongoose.Types.ObjectId.isValid(id)) car = await Car.findById(id);
    if (!car) car = await Car.findOne({ slug: id.toLowerCase() });

    if (!car) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.status(200).json({ success: true, data: formatCar(car) });
  } catch (error) {
    console.error('Error in getCarById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve vehicle details',
      error: error.message,
    });
  }
};

// ─── @desc  Create new car (Admin only)
// ─── @route POST /api/cars
exports.createCar = async (req, res) => {
  const tempFiles = [...(req.files || []), ...(req.file ? [req.file] : [])];

  try {
    const carData = { ...req.body };

    // Parse numeric / boolean fields sent as form-data strings
    if (carData.year)     carData.year     = Number(carData.year);
    if (carData.mileage)  carData.mileage  = Number(carData.mileage);
    if (carData.price)    carData.price    = Number(carData.price);
    if (typeof carData.featured === 'string') {
      carData.featured = carData.featured === 'true';
    }

    // ── Upload newly selected files to Cloudinary ──────────────────────────
    if (tempFiles.length > 0) {
      if (!isConfigured()) {
        cleanupTempFiles(tempFiles);
        return res.status(503).json({
          success: false,
          message: 'Image storage is not configured on the server. Please contact the administrator.',
        });
      }

      const uploaded = await uploadFilesToCloudinary(tempFiles);
      // secure_url values become the canonical image URLs
      const cloudUrls    = uploaded.map((u) => u.secure_url);
      const cloudPubIds  = uploaded.map((u) => u.public_id);

      carData.image              = cloudUrls[0];
      carData.images             = cloudUrls;
      carData.image_public_id    = cloudPubIds[0];
      carData.images_public_ids  = cloudPubIds;
    }

    // ── Validate that an image was provided one way or another ─────────────
    // (frontend may also send pre-uploaded Cloudinary URLs in req.body.images)
    if (!carData.image && (!carData.images || carData.images.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle image is required',
      });
    }
    if (!carData.image && carData.images?.length > 0) {
      carData.image = carData.images[0];
    }
    if (!carData.images || carData.images.length === 0) {
      carData.images = [carData.image];
    }

    // ── Auto-generate slug ─────────────────────────────────────────────────
    if (!carData.slug) {
      const base = `${carData.make}-${carData.model}-${carData.year}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      carData.slug = `${base}-${Date.now().toString(36)}`;
    }

    const newCar = await Car.create(carData);

    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      data: formatCar(newCar),
    });
  } catch (error) {
    // Ensure temp files are cleaned up on any unexpected error
    cleanupTempFiles(tempFiles);
    console.error('Error in createCar:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create vehicle',
    });
  }
};

// ─── @desc  Update car (Admin only)
// ─── @route PUT /api/cars/:id
exports.updateCar = async (req, res) => {
  const tempFiles = [...(req.files || []), ...(req.file ? [req.file] : [])];

  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { slug: id.toLowerCase() };

    const existingCar = await Car.findOne(query);
    if (!existingCar) {
      cleanupTempFiles(tempFiles);
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found to update',
      });
    }

    const updateData = { ...req.body };
    if (updateData.year)    updateData.year    = Number(updateData.year);
    if (updateData.mileage) updateData.mileage = Number(updateData.mileage);
    if (updateData.price)   updateData.price   = Number(updateData.price);
    if (typeof updateData.featured === 'string') {
      updateData.featured = updateData.featured === 'true';
    }

    // ── Upload newly selected files to Cloudinary ──────────────────────────
    if (tempFiles.length > 0) {
      if (!isConfigured()) {
        cleanupTempFiles(tempFiles);
        return res.status(503).json({
          success: false,
          message: 'Image storage is not configured on the server. Please contact the administrator.',
        });
      }

      const uploaded = await uploadFilesToCloudinary(tempFiles);
      const cloudUrls    = uploaded.map((u) => u.secure_url);
      const cloudPubIds  = uploaded.map((u) => u.public_id);

      // New images prepended; existing images kept for backward compat
      updateData.image             = cloudUrls[0];
      updateData.images            = [...cloudUrls, ...(existingCar.images || [])];
      updateData.image_public_id   = cloudPubIds[0];
      updateData.images_public_ids = [
        ...cloudPubIds,
        ...(existingCar.images_public_ids || []),
      ];
    }

    const updatedCar = await Car.findOneAndUpdate(query, updateData, {
      returnDocument: 'after',
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Vehicle updated successfully',
      data: formatCar(updatedCar),
    });
  } catch (error) {
    cleanupTempFiles(tempFiles);
    console.error('Error in updateCar:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update vehicle',
    });
  }
};

// ─── @desc  Delete car (Admin only)
// ─── @route DELETE /api/cars/:id
exports.deleteCar = async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { slug: id.toLowerCase() };

    const car = await Car.findOneAndDelete(query);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found to delete',
      });
    }

    // Best-effort: remove Cloudinary assets so you don't accumulate orphans
    if (isConfigured()) {
      const pubIds = car.images_public_ids?.length
        ? car.images_public_ids
        : car.images
            .map(extractPublicId)
            .filter(Boolean);

      if (pubIds.length) {
        // Fire-and-forget — don't block the response
        Promise.allSettled(pubIds.map(deleteFromCloudinary)).then((results) => {
          const failed = results.filter((r) => r.status === 'rejected');
          if (failed.length) {
            console.warn(`[deleteCar] ${failed.length} Cloudinary asset(s) could not be deleted for car ${id}`);
          }
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Vehicle deleted successfully',
      data: { id: car.slug || car._id.toString() },
    });
  } catch (error) {
    console.error('Error in deleteCar:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vehicle',
      error: error.message,
    });
  }
};

// ─── @desc  Upload vehicle images (standalone endpoint)
// ─── @route POST /api/cars/upload-images
// Returns Cloudinary secure_urls so the frontend can preview immediately
// and attach the URLs when submitting the car form.
exports.uploadImages = async (req, res) => {
  const tempFiles = [...(req.files || []), ...(req.file ? [req.file] : [])];

  try {
    if (tempFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image files provided',
      });
    }

    if (!isConfigured()) {
      cleanupTempFiles(tempFiles);
      return res.status(503).json({
        success: false,
        message: 'Image storage is not configured on the server. Please contact the administrator.',
      });
    }

    const uploaded = await uploadFilesToCloudinary(tempFiles);
    // Return full objects so the frontend has both url and public_id
    const data = uploaded.map((u) => ({
      url: u.secure_url,
      public_id: u.public_id,
    }));

    res.status(200).json({
      success: true,
      message: `${data.length} image(s) uploaded successfully`,
      data,
    });
  } catch (error) {
    cleanupTempFiles(tempFiles);
    console.error('Error in uploadImages:', error);
    res.status(500).json({
      success: false,
      message: 'Image upload failed',
      error: error.message,
    });
  }
};

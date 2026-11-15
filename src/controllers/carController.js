const Car = require('../models/Car');
const mongoose = require('mongoose');

// Helper to format car response
const formatCar = (car) => {
  const obj = car.toObject ? car.toObject({ virtuals: true }) : car;
  return {
    ...obj,
    id: obj.slug || obj._id.toString(),
  };
};

// @desc    Get all cars with search and filtering
// @route   GET /api/cars
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
      // If term is numeric, allow matching year as well
      const num = Number(term);
      if (!isNaN(num) && num > 1900 && num < 2100) {
        query.$or.push({ year: num });
      }
    }

    if (make) {
      query.make = new RegExp(`^${make.trim()}$`, 'i');
    }

    if (fuel) {
      query.fuel = new RegExp(`^${fuel.trim()}$`, 'i');
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (minYear) {
      query.year = { ...(query.year || {}), $gte: Number(minYear) };
    }

    if (maxMileage) {
      query.mileage = { $lte: Number(maxMileage) };
    }

    if (featured !== undefined && featured !== '') {
      query.featured = featured === 'true' || featured === true;
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };
    if (sort === 'year_desc') sortOption = { year: -1 };
    if (sort === 'mileage_asc') sortOption = { mileage: 1 };

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

// @desc    Get single car by id or slug
// @route   GET /api/cars/:id
exports.getCarById = async (req, res) => {
  try {
    const { id } = req.params;
    let car = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      car = await Car.findById(id);
    }
    if (!car) {
      car = await Car.findOne({ slug: id.toLowerCase() });
    }

    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found',
      });
    }

    res.status(200).json({
      success: true,
      data: formatCar(car),
    });
  } catch (error) {
    console.error('Error in getCarById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve vehicle details',
      error: error.message,
    });
  }
};

// @desc    Create new car (Admin only)
// @route   POST /api/cars
exports.createCar = async (req, res) => {
  try {
    const carData = { ...req.body };

    // Format numbers
    if (carData.year) carData.year = Number(carData.year);
    if (carData.mileage) carData.mileage = Number(carData.mileage);
    if (carData.price) carData.price = Number(carData.price);
    if (typeof carData.featured === 'string') {
      carData.featured = carData.featured === 'true';
    }

    // Handle uploaded file if single file was uploaded in this request
    if (req.file) {
      const fileUrl = `/uploads/${req.file.filename}`;
      carData.image = fileUrl;
      carData.images = [fileUrl];
    } else if (req.files && req.files.length > 0) {
      const fileUrls = req.files.map((f) => `/uploads/${f.filename}`);
      carData.image = fileUrls[0];
      carData.images = fileUrls;
    }

    if (!carData.image && (!carData.images || carData.images.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle image is required',
      });
    }

    if (!carData.image && carData.images && carData.images.length > 0) {
      carData.image = carData.images[0];
    }

    if (!carData.images || carData.images.length === 0) {
      carData.images = [carData.image];
    }

    // Auto-generate slug if not explicitly set
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
    console.error('Error in createCar:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create vehicle',
    });
  }
};

// @desc    Update car (Admin only)
// @route   PUT /api/cars/:id
exports.updateCar = async (req, res) => {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else {
      query = { slug: id.toLowerCase() };
    }

    const existingCar = await Car.findOne(query);
    if (!existingCar) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found to update',
      });
    }

    const updateData = { ...req.body };
    if (updateData.year) updateData.year = Number(updateData.year);
    if (updateData.mileage) updateData.mileage = Number(updateData.mileage);
    if (updateData.price) updateData.price = Number(updateData.price);
    if (typeof updateData.featured === 'string') {
      updateData.featured = updateData.featured === 'true';
    }

    if (req.file) {
      const fileUrl = `/uploads/${req.file.filename}`;
      updateData.image = fileUrl;
      updateData.images = [fileUrl, ...(existingCar.images || [])];
    } else if (req.files && req.files.length > 0) {
      const fileUrls = req.files.map((f) => `/uploads/${f.filename}`);
      updateData.image = fileUrls[0];
      updateData.images = [...fileUrls, ...(existingCar.images || [])];
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
    console.error('Error in updateCar:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update vehicle',
    });
  }
};

// @desc    Delete car (Admin only)
// @route   DELETE /api/cars/:id
exports.deleteCar = async (req, res) => {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else {
      query = { slug: id.toLowerCase() };
    }

    const car = await Car.findOneAndDelete(query);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found to delete',
      });
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

// @desc    Upload multiple vehicle images
// @route   POST /api/cars/upload-images
exports.uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image files provided',
      });
    }

    const fileUrls = req.files.map((f) => `/uploads/${f.filename}`);

    res.status(200).json({
      success: true,
      message: `${fileUrls.length} image(s) uploaded successfully`,
      data: fileUrls,
    });
  } catch (error) {
    console.error('Error in uploadImages:', error);
    res.status(500).json({
      success: false,
      message: 'Image upload failed',
      error: error.message,
    });
  }
};

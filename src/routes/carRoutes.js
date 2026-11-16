const express = require('express');
const router = express.Router();
const carController = require('../controllers/carController');
const { protect } = require('../middleware/auth');
const { uploadArray } = require('../middleware/upload');

// Public routes
router.get('/', carController.getCars);
router.get('/:id', carController.getCarById);

// Protected Admin routes – upload middleware handles size limits, type checks,
// cleanup on error, and Sharp post-processing before the controller runs.
router.post('/', protect, ...uploadArray('images', 10), carController.createCar);
router.put('/:id', protect, ...uploadArray('images', 10), carController.updateCar);
router.delete('/:id', protect, carController.deleteCar);

// Dedicated image-upload endpoint (returns URLs; frontend attaches them on submit)
router.post('/upload-images', protect, ...uploadArray('images', 10), carController.uploadImages);

module.exports = router;


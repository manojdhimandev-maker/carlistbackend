const express = require('express');
const router = express.Router();
const carController = require('../controllers/carController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', carController.getCars);
router.get('/:id', carController.getCarById);

// Protected Admin routes
router.post('/', protect, upload.array('images', 10), carController.createCar);
router.put('/:id', protect, upload.array('images', 10), carController.updateCar);
router.delete('/:id', protect, carController.deleteCar);
router.post('/upload-images', protect, upload.array('images', 10), carController.uploadImages);

module.exports = router;


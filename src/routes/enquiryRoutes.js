const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiryController');
const { protect } = require('../middleware/auth');

// Public: customer can submit enquiry
router.post('/', enquiryController.createEnquiry);

// Protected Admin: view and manage enquiries
router.get('/', protect, enquiryController.getEnquiries);
router.get('/:id', protect, enquiryController.getEnquiryById);
router.delete('/:id', protect, enquiryController.deleteEnquiry);

module.exports = router;


const Enquiry = require('../models/Enquiry');

// @desc    Submit new enquiry
// @route   POST /api/enquiries
exports.createEnquiry = async (req, res) => {
  try {
    const { name, phone, email, vehicle, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address',
        });
      }
    }

    const enquiry = await Enquiry.create({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      vehicle: vehicle ? vehicle.trim() : '',
      message: message.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Thank you! Your enquiry has been received and saved.',
      data: enquiry,
    });
  } catch (error) {
    console.error('Error in createEnquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit enquiry. Please try again.',
      error: error.message,
    });
  }
};

// @desc    Get all enquiries (Admin only)
// @route   GET /api/enquiries
exports.getEnquiries = async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: enquiries.length,
      data: enquiries,
    });
  } catch (error) {
    console.error('Error in getEnquiries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve enquiries',
      error: error.message,
    });
  }
};

// @desc    Get single enquiry (Admin only)
// @route   GET /api/enquiries/:id
exports.getEnquiryById = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found',
      });
    }
    res.status(200).json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    console.error('Error in getEnquiryById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve enquiry',
      error: error.message,
    });
  }
};

// @desc    Delete enquiry (Admin only)
// @route   DELETE /api/enquiries/:id
exports.deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found',
      });
    }
    res.status(200).json({
      success: true,
      message: 'Enquiry removed successfully',
    });
  } catch (error) {
    console.error('Error in deleteEnquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete enquiry',
      error: error.message,
    });
  }
};


const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (admin) => {
  const secret = process.env.JWT_SECRET || 'fawmond_galaxy_jwt_secret_key_2026_super_secure';
  return jwt.sign(
    { id: admin._id, email: admin.email, role: admin.role },
    secret,
    { expiresIn: '7d' }
  );
};

// @desc    Admin login
// @route   POST /api/admin/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(admin);

    // Set HTTP-only cookie
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
    });

    res.status(200).json({
      success: true,
      message: 'Admin authenticated successfully',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Error in admin login:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed due to a server error',
      error: error.message,
    });
  }
};

// @desc    Admin logout
// @route   POST /api/admin/logout
exports.logout = (req, res) => {
  res.clearCookie('adminToken');
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

// @desc    Get current logged in admin
// @route   GET /api/admin/me
exports.getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    admin: req.admin,
  });
};


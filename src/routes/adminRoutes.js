const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/auth');

router.post('/login', adminController.login);
router.post('/logout', adminController.logout);
router.get('/me', protect, adminController.getMe);

module.exports = router;


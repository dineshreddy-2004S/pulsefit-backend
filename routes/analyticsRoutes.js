const express = require('express');
const router = express.Router();
const { getDashboardAnalytics } = require('../controllers/analyticsController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, getDashboardAnalytics);

module.exports = router;
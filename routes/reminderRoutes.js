const express = require('express');
const router = express.Router();
const { sendSingleDueReminder, sendBulkDueReminders } = require('../controllers/reminderController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/email/:memberId', verifyToken, sendSingleDueReminder);
router.post('/email-bulk', verifyToken, sendBulkDueReminders);

module.exports = router;
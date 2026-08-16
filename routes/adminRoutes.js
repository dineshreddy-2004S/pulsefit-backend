const express = require('express');
const router = express.Router();

const { 
  getPendingUsers, 
  createUserByOwner,
  updateUserStatus, 
  deleteUser, 
  getActivityLogs 
} = require('../controllers/adminController');

const { verifyToken, verifyAdminOrOwner } = require('../middleware/authMiddleware');

router.get('/logs', verifyToken, verifyAdminOrOwner, getActivityLogs);
router.get('/users', verifyToken, verifyAdminOrOwner, getPendingUsers);
router.post('/users/create', verifyToken, verifyAdminOrOwner, createUserByOwner);
router.put('/users/:userId', verifyToken, verifyAdminOrOwner, updateUserStatus);
router.delete('/users/:userId', verifyToken, verifyAdminOrOwner, deleteUser);

module.exports = router;
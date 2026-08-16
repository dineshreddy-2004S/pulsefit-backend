const express = require('express');
const router = express.Router();

const { 
  getMembersStatusList,
  verifyMemberByQR,
  getAllMembers,
  addMember, 
  updateMember, 
  deleteMember 
} = require('../controllers/memberController');

const { verifyToken } = require('../middleware/authMiddleware');

router.get('/status-summary', verifyToken, getMembersStatusList);
router.get('/verify-qr/:memberId', verifyMemberByQR);

router.get('/', verifyToken, getAllMembers);
router.post('/', verifyToken, addMember);
router.put('/:memberId', verifyToken, updateMember);
router.delete('/:memberId', verifyToken, deleteMember);

module.exports = router;
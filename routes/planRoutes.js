const express = require('express');
const router = express.Router();
const { 
  getGymPlans, 
  addGymPlan, 
  updateGymPlan, 
  deleteGymPlan 
} = require('../controllers/planController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, getGymPlans);
router.post('/', verifyToken, addGymPlan);
router.put('/:planId', verifyToken, updateGymPlan);
router.delete('/:planId', verifyToken, deleteGymPlan);

module.exports = router;
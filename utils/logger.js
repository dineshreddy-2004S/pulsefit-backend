const pool = require('../config/db');

const logActivity = async ({ req, gymOwnerId, actionType, targetName, targetId = null, details = '' }) => {
  try {
    let ownerId = gymOwnerId;
    if (!ownerId && req?.user) {
      ownerId = req.user.role === 'GYM_OWNER' ? req.user.id : (req.user.gym_owner_id || req.user.id);
    }

    if (!ownerId || !req?.user) {
      return;
    }

    const userId = req.user.id || 0;
    const userName = req.user.name || 'System User';
    const userEmail = req.user.email || 'N/A';
    const userRole = req.user.role || 'STAFF';

    await pool.query(
      `INSERT INTO activity_logs 
       (gym_owner_id, performed_by_id, performed_by_name, performed_by_email, performed_by_role, action_type, target_name, target_id, details) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        userId,
        userName,
        userEmail,
        userRole,
        actionType,
        targetName,
        targetId,
        details
      ]
    );
  } catch (error) {
    console.error('Audit Logging Error:', error.message);
  }
};

module.exports = { logActivity };
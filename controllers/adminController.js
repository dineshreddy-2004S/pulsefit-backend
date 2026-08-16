const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { logActivity } = require('../utils/logger');

const getPendingUsers = async (req, res) => {
  try {
    let query = '';
    let params = [];

    if (req.user.role === 'ADMIN') {
      query = `SELECT id, name, email, phone, role, status, gym_name, gym_logo, 
                      gym_address, city, state, pincode, gst_number, created_at 
               FROM users 
               WHERE role = 'GYM_OWNER' 
               ORDER BY created_at DESC`;
    } else if (req.user.role === 'GYM_OWNER') {
      query = `SELECT id, name, email, phone, COALESCE(plain_password, '') AS plain_password, 
                      role, status, created_at 
               FROM users 
               WHERE gym_owner_id = ? AND role IN ('TRAINER', 'STAFF') 
               ORDER BY created_at DESC`;
      params = [req.user.id];
    } else {
      return res.status(403).json({ message: 'Access Denied.' });
    }

    const [users] = await pool.query(query, params);
    res.json(users);
  } catch (error) {
    console.error('Error in getPendingUsers:', error);
    res.status(500).json({ message: error.message });
  }
};

const createUserByOwner = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (req.user.role !== 'GYM_OWNER') {
    return res.status(403).json({ message: 'Only Gym Owners can create staff accounts.' });
  }

  if (!['TRAINER', 'STAFF'].includes(role)) {
    return res.status(400).json({ message: 'Role must be TRAINER or STAFF.' });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email address is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, plain_password, role, status, gym_owner_id) 
       VALUES (?, ?, ?, ?, ?, 'APPROVED', ?)`,
      [name, email, hashedPassword, password, role, req.user.id]
    );

    await logActivity({
      req,
      gymOwnerId: req.user.id,
      actionType: 'CREATED_STAFF',
      targetName: name,
      targetId: result.insertId,
      details: `Generated login credentials for new ${role} (${email})`
    });

    res.status(201).json({ message: `${role === 'TRAINER' ? 'Trainer' : 'Staff'} account created successfully!` });
  } catch (error) {
    console.error('Error in createUserByOwner:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { status, role } = req.body;

  try {
    const [targetUsers] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (targetUsers.length === 0) return res.status(404).json({ message: 'User not found' });
    const targetUser = targetUsers[0];

    if (req.user.role === 'ADMIN') {
      if (targetUser.role !== 'GYM_OWNER') return res.status(403).json({ message: 'Unauthorized' });
      await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
    } else if (req.user.role === 'GYM_OWNER') {
      if (targetUser.gym_owner_id !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

      await pool.query('UPDATE users SET status = ?, role = ? WHERE id = ?', [status, role, userId]);

      await logActivity({
        req,
        gymOwnerId: req.user.id,
        actionType: 'UPDATED_STAFF',
        targetName: targetUser.name,
        targetId: userId,
        details: `Updated permissions to Role: ${role}, Status: ${status}`
      });
    }

    res.json({ message: 'Status updated successfully.' });
  } catch (error) {
    console.error('Error in updateUserStatus:', error);
    res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const [targetUsers] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (targetUsers.length === 0) return res.status(404).json({ message: 'User not found' });
    const targetUser = targetUsers[0];

    if (req.user.role === 'GYM_OWNER' && targetUser.gym_owner_id === req.user.id) {
      await pool.query('DELETE FROM users WHERE id = ?', [userId]);

      await logActivity({
        req,
        gymOwnerId: req.user.id,
        actionType: 'DELETED_STAFF',
        targetName: targetUser.name,
        targetId: userId,
        details: `Removed ${targetUser.role} account (${targetUser.email})`
      });
    } else if (req.user.role === 'ADMIN' && targetUser.role === 'GYM_OWNER') {
      await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    } else {
      return res.status(403).json({ message: 'Unauthorized action.' });
    }

    res.json({ message: 'Account removed successfully.' });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({ message: error.message });
  }
};

const getActivityLogs = async (req, res) => {
  if (req.user.role !== 'GYM_OWNER') {
    return res.status(403).json({ message: 'Access restricted to Gym Owners.' });
  }

  const { action, staffId } = req.query;

  try {
    let query = 'SELECT * FROM activity_logs WHERE gym_owner_id = ?';
    const params = [req.user.id];

    if (action && action !== 'ALL') {
      query += ' AND action_type = ?';
      params.push(action);
    }

    if (staffId && staffId !== 'ALL') {
      query += ' AND performed_by_id = ?';
      params.push(staffId);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const [logs] = await pool.query(query, params);
    res.json(logs);
  } catch (error) {
    console.error('Error in getActivityLogs:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPendingUsers,
  createUserByOwner,
  updateUserStatus,
  deleteUser,
  getActivityLogs
};
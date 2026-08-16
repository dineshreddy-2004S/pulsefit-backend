const pool = require('../config/db');
const { logActivity } = require('../utils/logger');

// 1. Get Gym Plans with self-healing fallback
const getGymPlans = async (req, res) => {
  try {
    const ownerId = req.user.role === 'GYM_OWNER' ? req.user.id : (req.user.gym_owner_id || req.user.id);

    const [plans] = await pool.query(
      `SELECT * FROM gym_plans WHERE gym_owner_id = ? ORDER BY price ASC`,
      [ownerId]
    );

    // Auto-seed default packages if none exist for this gym owner
    if (plans.length === 0 && req.user.role === 'GYM_OWNER') {
      const defaults = [
        [ownerId, 'Daily Workout Pass', 'DAILY', 0, 1, 150.00, 0.00, 'Single day full facility pass with locker access.', 'Full Gym Access, Locker Access, Shower Facility'],
        [ownerId, 'Standard Monthly', 'MONTHLY', 1, 30, 1499.00, 500.00, 'Standard monthly floor access & fitness training.', 'Full Floor Access, Free Locker, General Trainer Support'],
        [ownerId, '2-Month Booster', '2_MONTHS', 2, 60, 2799.00, 300.00, 'Two months complete conditioning package.', 'Floor Access, Diet Consultation, Locker Access'],
        [ownerId, 'Quarterly Pro (3 Mos)', 'QUARTERLY', 3, 90, 3999.00, 0.00, 'Most popular 90-day transformation tier.', 'Full Facility Access, Diet Plan, Trainer Support, Steam/Sauna Access'],
        [ownerId, 'Half-Yearly Elite (6 Mos)', 'HALF_YEARLY', 6, 180, 7499.00, 0.00, 'Six months VIP bodybuilding & cross-training.', 'Priority Access, Custom Workout Chart, Steam Bath, Diet Support'],
        [ownerId, 'Annual VIP Champion (1 Yr)', 'ANNUAL', 12, 365, 12999.00, 0.00, 'All-inclusive 365 days VIP access.', 'Unlimited Cross-Training, VIP Locker, Sauna & Steam, 2 Free Guest Passes']
      ];

      await pool.query(
        `INSERT INTO gym_plans (gym_owner_id, plan_name, plan_type, duration_months, duration_days, price, admission_fee, description, features) 
         VALUES ?`,
        [defaults]
      );

      const [seededPlans] = await pool.query(`SELECT * FROM gym_plans WHERE gym_owner_id = ? ORDER BY price ASC`, [ownerId]);
      return res.json(seededPlans);
    }

    res.json(plans);
  } catch (error) {
    console.error('Error in getGymPlans:', error.message);
    res.status(500).json({ message: 'Database connection issue. Please retry: ' + error.message });
  }
};

// 2. Add New Plan
const addGymPlan = async (req, res) => {
  if (req.user.role !== 'GYM_OWNER') {
    return res.status(403).json({ message: 'Access Denied: Only Gym Owners can create membership fees.' });
  }

  const { plan_name, plan_type, duration_months, duration_days, price, admission_fee, description, features } = req.body;

  try {
    const [result] = await pool.query(
      `INSERT INTO gym_plans (gym_owner_id, plan_name, plan_type, duration_months, duration_days, price, admission_fee, description, features) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        plan_name,
        plan_type,
        Number(duration_months) || 1,
        Number(duration_days) || 0,
        Number(price) || 0.00,
        Number(admission_fee) || 0.00,
        description || '',
        features || ''
      ]
    );

    if (logActivity) {
      await logActivity({
        req,
        gymOwnerId: req.user.id,
        actionType: 'UPDATED_STAFF',
        targetName: plan_name,
        targetId: result.insertId,
        details: `Created new membership package: ${plan_name} (Price: ₹${price})`
      });
    }

    res.status(201).json({ message: 'Membership plan created successfully!', planId: result.insertId });
  } catch (error) {
    console.error('Error in addGymPlan:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// 3. Update Plan
const updateGymPlan = async (req, res) => {
  if (req.user.role !== 'GYM_OWNER') {
    return res.status(403).json({ message: 'Access Denied: Only Gym Owners can update membership fees.' });
  }

  const { planId } = req.params;
  const { plan_name, plan_type, duration_months, duration_days, price, admission_fee, description, features, is_active } = req.body;

  try {
    const [existing] = await pool.query('SELECT * FROM gym_plans WHERE id = ? AND gym_owner_id = ?', [planId, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Plan not found or unauthorized.' });
    }

    await pool.query(
      `UPDATE gym_plans 
       SET plan_name = ?, plan_type = ?, duration_months = ?, duration_days = ?, price = ?, admission_fee = ?, description = ?, features = ?, is_active = ? 
       WHERE id = ? AND gym_owner_id = ?`,
      [
        plan_name,
        plan_type,
        Number(duration_months) || 1,
        Number(duration_days) || 0,
        Number(price) || 0.00,
        Number(admission_fee) || 0.00,
        description || '',
        features || '',
        is_active !== undefined ? is_active : 1,
        planId,
        req.user.id
      ]
    );

    if (logActivity) {
      await logActivity({
        req,
        gymOwnerId: req.user.id,
        actionType: 'UPDATED_STAFF',
        targetName: plan_name,
        targetId: planId,
        details: `Updated package fees: ${plan_name} -> Price: ₹${price}`
      });
    }

    res.json({ message: 'Plan details updated successfully!' });
  } catch (error) {
    console.error('Error in updateGymPlan:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// 4. Delete Plan
const deleteGymPlan = async (req, res) => {
  if (req.user.role !== 'GYM_OWNER') {
    return res.status(403).json({ message: 'Access Denied: Only Gym Owners can delete membership fees.' });
  }

  const { planId } = req.params;

  try {
    const [existing] = await pool.query('SELECT plan_name FROM gym_plans WHERE id = ? AND gym_owner_id = ?', [planId, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Plan not found or unauthorized.' });
    }

    const planTitle = existing[0].plan_name;
    await pool.query('DELETE FROM gym_plans WHERE id = ? AND gym_owner_id = ?', [planId, req.user.id]);

    if (logActivity) {
      await logActivity({
        req,
        gymOwnerId: req.user.id,
        actionType: 'DELETED_STAFF',
        targetName: planTitle,
        targetId: planId,
        details: `Deleted membership package: ${planTitle}`
      });
    }

    res.json({ message: 'Plan removed successfully!' });
  } catch (error) {
    console.error('Error in deleteGymPlan:', error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getGymPlans,
  addGymPlan,
  updateGymPlan,
  deleteGymPlan
};
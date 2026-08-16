const pool = require('../config/db');
const { logActivity } = require('../utils/logger');

// 1. Get Status and Financial Dues Summary
const getMembersStatusList = async (req, res) => {
  if (req.user.role === 'ADMIN') {
    return res.status(403).json({ message: 'Access restricted.' });
  }

  try {
    const ownerId = req.user.role === 'GYM_OWNER' ? req.user.id : (req.user.gym_owner_id || req.user.id);
    const [members] = await pool.query(
      `SELECT * FROM members WHERE gym_owner_id = ? ORDER BY expiry_date ASC`,
      [ownerId]
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeList = [];
    const expiredList = [];
    const expiringSoonList = [];
    let totalDuesAmount = 0;
    let dueMembersCount = 0;

    members.forEach((member) => {
      const exp = new Date(member.expiry_date);
      exp.setHours(0, 0, 0, 0);
      const daysRemaining = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

      const memberData = {
        ...member,
        daysRemaining,
        isExpired: daysRemaining < 0,
        computedStatus: daysRemaining >= 0 ? 'ACTIVE' : 'EXPIRED'
      };

      // Calculate dues
      const balance = Number(member.balance_due) || 0;
      if (balance > 0) {
        totalDuesAmount += balance;
        dueMembersCount += 1;
      }

      if (daysRemaining < 0) {
        expiredList.push(memberData);
      } else {
        activeList.push(memberData);
        if (daysRemaining <= 7) expiringSoonList.push(memberData);
      }
    });

    res.json({
      summary: {
        total: members.length,
        activeCount: activeList.length,
        expiredCount: expiredList.length,
        expiringSoonCount: expiringSoonList.length,
        totalDuesAmount,
        dueMembersCount
      },
      activeMembers: activeList,
      expiredMembers: expiredList,
      expiringSoonMembers: expiringSoonList
    });
  } catch (error) {
    console.error('Error in getMembersStatusList:', error);
    res.status(500).json({ message: error.message });
  }
};

// 2. Verify Member QR Pass
const verifyMemberByQR = async (req, res) => {
  const { memberId } = req.params;
  try {
    const [members] = await pool.query(
      `SELECT m.*, u.name AS gym_owner_name, u.gym_name, u.gym_logo 
       FROM members m 
       LEFT JOIN users u ON m.gym_owner_id = u.id 
       WHERE m.id = ?`,
      [memberId]
    );

    if (members.length === 0) return res.status(404).json({ message: 'Invalid QR Pass' });

    const member = members[0];
    const isExpired = new Date(member.expiry_date) < new Date();
    res.json({ 
      ...member, 
      isExpired, 
      status: isExpired ? 'EXPIRED' : member.status 
    });
  } catch (error) {
    console.error('Error in verifyMemberByQR:', error);
    res.status(500).json({ message: error.message });
  }
};

// 3. Get All Members
const getAllMembers = async (req, res) => {
  try {
    let query = '';
    let params = [];

    if (req.user.role === 'ADMIN') {
      query = 'SELECT * FROM members ORDER BY id DESC';
    } else {
      const ownerId = req.user.role === 'GYM_OWNER' ? req.user.id : (req.user.gym_owner_id || req.user.id);
      query = 'SELECT * FROM members WHERE gym_owner_id = ? ORDER BY id DESC';
      params = [ownerId];
    }

    const [members] = await pool.query(query, params);
    res.json(members);
  } catch (error) {
    console.error('Error in getAllMembers:', error);
    res.status(500).json({ message: error.message });
  }
};

// 4. Add Member (with Partial Payment & Custom Plans)
const addMember = async (req, res) => {
  if (req.user.role === 'ADMIN') {
    return res.status(403).json({ message: 'Super Admins cannot add members directly.' });
  }

  const { 
    full_name, email, phone, gender, dob, 
    plan_type, custom_months, total_amount, amount_paid, 
    start_date, expiry_date, photo_url 
  } = req.body;

  const gymOwnerId = req.user.role === 'GYM_OWNER' ? req.user.id : (req.user.gym_owner_id || req.user.id);

  const totalFee = Number(total_amount) || 0;
  const paidFee = Number(amount_paid) || 0;
  const balanceDue = Math.max(0, totalFee - paidFee);

  let paymentStatus = 'PAID';
  if (paidFee === 0 && totalFee > 0) {
    paymentStatus = 'DUE';
  } else if (balanceDue > 0) {
    paymentStatus = 'PARTIAL';
  }

  try {
    const [existing] = await pool.query('SELECT id FROM members WHERE email = ? AND email IS NOT NULL AND email != ""', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'A member with this email already exists.' });
    }

    const [result] = await pool.query(
      `INSERT INTO members (
        full_name, email, phone, gender, dob, 
        plan_type, custom_months, total_amount, amount_paid, balance_due, payment_status,
        start_date, expiry_date, photo_url, gym_owner_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name, email || null, phone, gender, dob, 
        plan_type, custom_months || null, totalFee, paidFee, balanceDue, paymentStatus,
        start_date, expiry_date, photo_url || null, gymOwnerId
      ]
    );

    await logActivity({
      req,
      gymOwnerId,
      actionType: 'ADDED_MEMBER',
      targetName: full_name,
      targetId: result.insertId,
      details: `Enrolled (${plan_type}). Total: ₹${totalFee}, Paid: ₹${paidFee}, Due: ₹${balanceDue} [${paymentStatus}]`
    });

    res.status(201).json({ message: 'Member registered successfully', memberId: result.insertId });
  } catch (error) {
    console.error('Error in addMember:', error);
    res.status(500).json({ message: error.message });
  }
};

// 5. Update Member (including clearing Due Balance)
const updateMember = async (req, res) => {
  const { memberId } = req.params;
  const { 
    full_name, email, phone, gender, dob, 
    plan_type, custom_months, total_amount, amount_paid, 
    start_date, expiry_date, status, photo_url 
  } = req.body;

  const gymOwnerId = req.user.role === 'GYM_OWNER' ? req.user.id : (req.user.gym_owner_id || req.user.id);

  const totalFee = Number(total_amount) || 0;
  const paidFee = Number(amount_paid) || 0;
  const balanceDue = Math.max(0, totalFee - paidFee);

  let paymentStatus = 'PAID';
  if (paidFee === 0 && totalFee > 0) {
    paymentStatus = 'DUE';
  } else if (balanceDue > 0) {
    paymentStatus = 'PARTIAL';
  }

  try {
    const [existing] = await pool.query('SELECT * FROM members WHERE id = ?', [memberId]);
    if (existing.length === 0) return res.status(404).json({ message: 'Member not found' });

    const old = existing[0];
    const updatedPhoto = photo_url !== undefined ? photo_url : old.photo_url;

    await pool.query(
      `UPDATE members 
       SET full_name = ?, email = ?, phone = ?, gender = ?, dob = ?, 
           plan_type = ?, custom_months = ?, total_amount = ?, amount_paid = ?, balance_due = ?, payment_status = ?,
           start_date = ?, expiry_date = ?, status = ?, photo_url = ? 
       WHERE id = ?`,
      [
        full_name, email || null, phone, gender, dob, 
        plan_type, custom_months || null, totalFee, paidFee, balanceDue, paymentStatus,
        start_date, expiry_date, status, updatedPhoto, memberId
      ]
    );

    const changes = [];
    if (old.plan_type !== plan_type) changes.push(`Plan: ${old.plan_type} ➔ ${plan_type}`);
    if (old.amount_paid !== paidFee) changes.push(`Paid: ₹${old.amount_paid} ➔ ₹${paidFee}`);
    if (old.balance_due !== balanceDue) changes.push(`Due: ₹${old.balance_due} ➔ ₹${balanceDue}`);
    if (old.status !== status) changes.push(`Status: ${old.status} ➔ ${status}`);

    await logActivity({
      req,
      gymOwnerId,
      actionType: 'UPDATED_MEMBER',
      targetName: full_name,
      targetId: memberId,
      details: changes.length > 0 ? changes.join(', ') : 'Updated profile information'
    });

    res.json({ message: 'Member details updated successfully' });
  } catch (error) {
    console.error('Error in updateMember:', error);
    res.status(500).json({ message: error.message });
  }
};

// 6. Delete Member
const deleteMember = async (req, res) => {
  const { memberId } = req.params;
  const gymOwnerId = req.user.role === 'GYM_OWNER' ? req.user.id : (req.user.gym_owner_id || req.user.id);

  try {
    const [existing] = await pool.query('SELECT * FROM members WHERE id = ?', [memberId]);
    if (existing.length === 0) return res.status(404).json({ message: 'Member not found' });

    const memberName = existing[0].full_name;
    await pool.query('DELETE FROM members WHERE id = ?', [memberId]);

    await logActivity({
      req,
      gymOwnerId,
      actionType: 'DELETED_MEMBER',
      targetName: memberName,
      targetId: memberId,
      details: `Removed member (${existing[0].phone})`
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error in deleteMember:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMembersStatusList,
  verifyMemberByQR,
  getAllMembers,
  addMember,
  updateMember,
  deleteMember
};
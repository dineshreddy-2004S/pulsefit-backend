const pool = require('../config/db');
const { sendDueReminderEmail } = require('../utils/emailService');

// 1. Send Single Email Reminder to a Member
const sendSingleDueReminder = async (req, res) => {
  const { memberId } = req.params;
  const ownerId = req.user.role === 'GYM_OWNER' ? req.user.id : (req.user.gym_owner_id || req.user.id);

  try {
    const [members] = await pool.query(
      `SELECT m.*, u.gym_name, u.phone AS owner_phone 
       FROM members m 
       LEFT JOIN users u ON m.gym_owner_id = u.id 
       WHERE m.id = ? AND m.gym_owner_id = ?`,
      [memberId, ownerId]
    );

    if (members.length === 0) {
      return res.status(404).json({ message: 'Member not found or unauthorized.' });
    }

    const member = members[0];
    const balance = Number(member.balance_due) || 0;

    if (balance <= 0) {
      return res.status(400).json({ message: 'This member has already cleared all dues.' });
    }

    if (!member.email) {
      return res.status(400).json({ message: 'No email address registered for this member.' });
    }

    await sendDueReminderEmail({
      memberEmail: member.email,
      memberName: member.full_name,
      gymName: member.gym_name,
      gymPhone: member.owner_phone,
      planType: member.plan_type,
      totalAmount: member.total_amount || member.amount_paid,
      amountPaid: member.amount_paid,
      balanceDue: member.balance_due,
      expiryDate: member.expiry_date
    });

    res.json({ message: `Due reminder email successfully dispatched to ${member.email}!` });
  } catch (error) {
    console.error('Error sending single reminder:', error);
    res.status(500).json({ message: 'Failed to send reminder email: ' + error.message });
  }
};

// 2. Send Bulk Due Reminders to All Members with Pending Balance
const sendBulkDueReminders = async (req, res) => {
  const ownerId = req.user.role === 'GYM_OWNER' ? req.user.id : (req.user.gym_owner_id || req.user.id);

  try {
    const [dueMembers] = await pool.query(
      `SELECT m.*, u.gym_name, u.phone AS owner_phone 
       FROM members m 
       LEFT JOIN users u ON m.gym_owner_id = u.id 
       WHERE m.gym_owner_id = ? AND m.balance_due > 0 AND m.email IS NOT NULL AND m.email != ''`,
      [ownerId]
    );

    if (dueMembers.length === 0) {
      return res.status(400).json({ message: 'No members with pending dues and valid email addresses found.' });
    }

    let sentCount = 0;
    for (const member of dueMembers) {
      try {
        await sendDueReminderEmail({
          memberEmail: member.email,
          memberName: member.full_name,
          gymName: member.gym_name,
          gymPhone: member.owner_phone,
          planType: member.plan_type,
          totalAmount: member.total_amount || member.amount_paid,
          amountPaid: member.amount_paid,
          balanceDue: member.balance_due,
          expiryDate: member.expiry_date
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send reminder to ${member.email}:`, err.message);
      }
    }

    res.json({ 
      message: `Dispatched ${sentCount} reminder emails out of ${dueMembers.length} members with pending dues!` 
    });
  } catch (error) {
    console.error('Error sending bulk reminders:', error);
    res.status(500).json({ message: 'Failed to send bulk reminders: ' + error.message });
  }
};

module.exports = {
  sendSingleDueReminder,
  sendBulkDueReminders
};
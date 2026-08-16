const pool = require('../config/db');

const getDashboardAnalytics = async (req, res) => {
  if (req.user.role === 'ADMIN') {
    return res.status(403).json({ message: 'Access restricted for Super Admin.' });
  }

  const ownerId = req.user.role === 'GYM_OWNER' ? req.user.id : (req.user.gym_owner_id || req.user.id);

  try {
    // 1. Overall Financial Totals
    const [financeRows] = await pool.query(
      `SELECT 
        SUM(amount_paid) AS total_collected, 
        SUM(balance_due) AS total_pending_dues,
        SUM(total_amount) AS total_billed
       FROM members WHERE gym_owner_id = ?`,
      [ownerId]
    );

    // 2. Fetch all members records
    const [membersRows] = await pool.query(
      `SELECT id, full_name, phone, email, plan_type, total_amount, amount_paid, balance_due, payment_status, start_date, expiry_date, created_at 
       FROM members 
       WHERE gym_owner_id = ? 
       ORDER BY created_at DESC`,
      [ownerId]
    );

    const now = new Date();
    
    const toLocalDateString = (dateObj) => {
      if (!dateObj) return '';
      const d = new Date(dateObj);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayLocalStr = toLocalDateString(now);

    const isToday = (dateVal) => toLocalDateString(dateVal) === todayLocalStr;

    const isWithinDays = (dateVal, days) => {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return false;
      const diffTime = now.getTime() - d.getTime();
      return diffTime >= 0 && diffTime <= days * 24 * 60 * 60 * 1000;
    };

    // Time-Series Revenue Breakdown
    let periodRevenue = {
      daily: { label: 'Today', collected: 0, dues: 0, billed: 0, count: 0 },
      weekly: { label: 'Last 7 Days', collected: 0, dues: 0, billed: 0, count: 0 },
      monthly: { label: 'Last 30 Days', collected: 0, dues: 0, billed: 0, count: 0 },
      quarterly: { label: 'Last 90 Days', collected: 0, dues: 0, billed: 0, count: 0 },
      halfYearly: { label: 'Last 180 Days', collected: 0, dues: 0, billed: 0, count: 0 },
      annually: { label: 'Last 365 Days', collected: 0, dues: 0, billed: 0, count: 0 }
    };

    let activeCount = 0;
    let expiredCount = 0;
    let planDistribution = { DAILY: 0, MONTHLY: 0, '2_MONTHS': 0, QUARTERLY: 0, HALF_YEARLY: 0, ANNUAL: 0, CUSTOM: 0 };
    let planRevenueMap = { DAILY: 0, MONTHLY: 0, '2_MONTHS': 0, QUARTERLY: 0, HALF_YEARLY: 0, ANNUAL: 0, CUSTOM: 0 };

    // 6-Month Rolling Historical Growth Buckets
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyGrowthMap = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      monthlyGrowthMap[key] = { month: key, revenue: 0, dues: 0, newMembers: 0 };
    }

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    membersRows.forEach(m => {
      const joinDate = m.start_date || m.created_at;
      const joinObj = new Date(joinDate);
      const paid = Number(m.amount_paid) || 0;
      const due = Number(m.balance_due) || 0;
      const total = Number(m.total_amount) || (paid + due);

      // Active vs Expired Status
      const exp = new Date(m.expiry_date);
      exp.setHours(0, 0, 0, 0);
      if (exp >= todayDate) activeCount++;
      else expiredCount++;

      // Plan Counts and Revenue Share
      const pKey = planDistribution[m.plan_type] !== undefined ? m.plan_type : 'CUSTOM';
      planDistribution[pKey]++;
      planRevenueMap[pKey] = (planRevenueMap[pKey] || 0) + paid;

      // Populate 6-Month Growth Trends
      if (!isNaN(joinObj.getTime())) {
        const monthKey = `${monthNames[joinObj.getMonth()]} ${joinObj.getFullYear().toString().slice(-2)}`;
        if (monthlyGrowthMap[monthKey]) {
          monthlyGrowthMap[monthKey].revenue += paid;
          monthlyGrowthMap[monthKey].dues += due;
          monthlyGrowthMap[monthKey].newMembers += 1;
        }
      }

      // Period Aggregation
      if (isToday(joinDate) || isToday(m.created_at)) {
        periodRevenue.daily.collected += paid;
        periodRevenue.daily.dues += due;
        periodRevenue.daily.billed += total;
        periodRevenue.daily.count++;
      }
      if (isWithinDays(joinDate, 7)) {
        periodRevenue.weekly.collected += paid;
        periodRevenue.weekly.dues += due;
        periodRevenue.weekly.billed += total;
        periodRevenue.weekly.count++;
      }
      if (isWithinDays(joinDate, 30)) {
        periodRevenue.monthly.collected += paid;
        periodRevenue.monthly.dues += due;
        periodRevenue.monthly.billed += total;
        periodRevenue.monthly.count++;
      }
      if (isWithinDays(joinDate, 90)) {
        periodRevenue.quarterly.collected += paid;
        periodRevenue.quarterly.dues += due;
        periodRevenue.quarterly.billed += total;
        periodRevenue.quarterly.count++;
      }
      if (isWithinDays(joinDate, 180)) {
        periodRevenue.halfYearly.collected += paid;
        periodRevenue.halfYearly.dues += due;
        periodRevenue.halfYearly.billed += total;
        periodRevenue.halfYearly.count++;
      }
      if (isWithinDays(joinDate, 365)) {
        periodRevenue.annually.collected += paid;
        periodRevenue.annually.dues += due;
        periodRevenue.annually.billed += total;
        periodRevenue.annually.count++;
      }
    });

    const growthTrend = Object.values(monthlyGrowthMap);

    // Calculate Month-over-Month (MoM) Growth %
    const lastMonthRev = growthTrend.length >= 2 ? growthTrend[growthTrend.length - 2].revenue : 0;
    const currentMonthRev = growthTrend.length >= 1 ? growthTrend[growthTrend.length - 1].revenue : 0;
    const momGrowthPercentage = lastMonthRev > 0 
      ? Math.round(((currentMonthRev - lastMonthRev) / lastMonthRev) * 100)
      : currentMonthRev > 0 ? 100 : 0;

    const totalCollected = Number(financeRows[0].total_collected) || 0;
    const totalPendingDues = Number(financeRows[0].total_pending_dues) || 0;
    const totalBilled = Number(financeRows[0].total_billed) || (totalCollected + totalPendingDues);
    const collectionEfficiency = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

    res.json({
      overall: {
        totalCollected,
        totalPendingDues,
        totalBilled,
        totalMembers: membersRows.length,
        activeMembers: activeCount,
        expiredMembers: expiredCount,
        momGrowthPercentage,
        collectionEfficiency
      },
      growthTrend,
      periodRevenue,
      planDistribution,
      planRevenueMap,
      membersList: membersRows
    });
  } catch (error) {
    console.error('Error in getDashboardAnalytics:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDashboardAnalytics };
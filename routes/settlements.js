const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Group = require('../models/Group');
const Settlement = require('../models/Settlement');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Debug email configuration
const emailConfig = {
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS,
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true'
};

console.log('Email Configuration Debug:');
console.log('EMAIL_USER:', emailConfig.user || 'Not set');
console.log('EMAIL_PASS:', emailConfig.pass ? 'Set' : 'Not set');
console.log('EMAIL_HOST:', emailConfig.host);
console.log('EMAIL_PORT:', emailConfig.port);
console.log('EMAIL_SECURE:', emailConfig.secure);

// Create email transporter with secure configuration
const transporter = nodemailer.createTransport({
  host: emailConfig.host,
  port: emailConfig.port,
  secure: emailConfig.secure,
  auth: {
    user: emailConfig.user,
    pass: emailConfig.pass
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify email configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response
    });
  } else {
    console.log('Email server is ready to send messages');
  }
});

// @route   POST /api/settlements
// @desc    Create a new group settlement
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { group, status } = req.body;

    // Check if group exists and user is a member
    const groupDoc = await Group.findById(group)
      .populate('members.user', 'name email');
    
    if (!groupDoc) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isMember = groupDoc.members.some(
      member => member.user._id.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Create settlement
    const settlement = new Settlement({
      group,
      type: 'group',
      createdBy: req.user.id,
      status: status || 'pending'
    });

    await settlement.save();
    res.json(settlement);
  } catch (err) {
    console.error('Error creating settlement:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/settlements/:id/notify
// @desc    Send settlement notification emails
// @access  Private
router.post('/:id/notify', protect, async (req, res) => {
  try {
    // Check email configuration first
    if (!emailConfig.user || !emailConfig.pass) {
      console.warn('Email credentials not configured. Skipping email notifications.');
      return res.json({ 
        message: 'Settlement created but email notifications are disabled',
        reason: 'Email credentials not configured',
        config: {
          user: emailConfig.user ? 'Set' : 'Not set',
          pass: emailConfig.pass ? 'Set' : 'Not set'
        }
      });
    }

    const settlement = await Settlement.findById(req.params.id)
      .populate('group')
      .populate('createdBy', 'name email');

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    const group = await Group.findById(settlement.group)
      .populate('members.user', 'name email')
      .populate('expenses');

    // Calculate balances for each member
    const balances = {};
    group.members.forEach(member => {
      balances[member.user._id] = 0;
    });

    // Calculate balances from expenses
    group.expenses.forEach(expense => {
      // Add to paidBy's balance
      balances[expense.paidBy._id] = (balances[expense.paidBy._id] || 0) + expense.amount;
      
      // Subtract from splitAmong's balances
      const splitAmount = expense.amount / expense.splitAmong.length;
      expense.splitAmong.forEach(user => {
        balances[user._id] = (balances[user._id] || 0) - splitAmount;
      });
    });

    // Track email sending results
    const emailResults = {
      total: group.members.length,
      sent: 0,
      failed: 0,
      errors: []
    };

    // Send emails to all members
    const emailPromises = group.members.map(async (member) => {
      if (member.user.email) {
        try {
          // Calculate what this member owes or is owed
          const memberBalance = balances[member.user._id];
          const owesTo = [];
          const owedBy = [];

          // Calculate who owes whom
          Object.entries(balances).forEach(([userId, balance]) => {
            if (userId !== member.user._id) {
              const otherMember = group.members.find(m => m.user._id.toString() === userId);
              if (otherMember) {
                if (balance > 0 && memberBalance < 0) {
                  // This member owes to others
                  const amount = Math.min(Math.abs(memberBalance), balance);
                  owesTo.push({
                    name: otherMember.user.name,
                    amount: amount.toFixed(2)
                  });
                } else if (balance < 0 && memberBalance > 0) {
                  // Others owe to this member
                  const amount = Math.min(memberBalance, Math.abs(balance));
                  owedBy.push({
                    name: otherMember.user.name,
                    amount: amount.toFixed(2)
                  });
                }
              }
            }
          });

          const mailOptions = {
            from: `"BillBuddy" <${emailConfig.user}>`,
            to: member.user.email,
            subject: `Settlement Notification - ${group.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <h1 style="color: #2c3e50; margin-bottom: 10px;">💰 BillBuddy Settlement</h1>
                  <p style="color: #7f8c8d; font-size: 16px;">Time to settle up with your friends!</p>
                </div>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h2 style="color: #2c3e50; margin-bottom: 15px;">Group: ${group.name}</h2>
                  
                  <div style="margin-bottom: 20px;">
                    <h3 style="color: #34495e; margin-bottom: 10px;">📊 Your Balance Summary</h3>
                    <p style="margin: 5px 0; font-size: 18px;">
                      <strong>Total Balance:</strong> 
                      <span style="color: ${memberBalance >= 0 ? '#27ae60' : '#e74c3c'}">
                        ${memberBalance >= 0 ? '+' : ''}₹${Math.abs(memberBalance).toFixed(2)}
                      </span>
                    </p>
                  </div>

                  ${owesTo.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                      <h3 style="color: #e74c3c; margin-bottom: 10px;">💸 You Need to Pay</h3>
                      <ul style="list-style: none; padding: 0;">
                        ${owesTo.map(payment => `
                          <li style="margin: 10px 0; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
                            <strong>${payment.name}</strong>: ₹${payment.amount}
                          </li>
                        `).join('')}
                      </ul>
                    </div>
                  ` : ''}

                  ${owedBy.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                      <h3 style="color: #27ae60; margin-bottom: 10px;">💰 You Will Receive</h3>
                      <ul style="list-style: none; padding: 0;">
                        ${owedBy.map(payment => `
                          <li style="margin: 10px 0; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
                            <strong>${payment.name}</strong>: ₹${payment.amount}
                          </li>
                        `).join('')}
                      </ul>
                    </div>
                  ` : ''}

                  <div style="margin-bottom: 20px;">
                    <h3 style="color: #34495e; margin-bottom: 10px;">💡 Next Steps</h3>
                    <p style="margin: 5px 0;">1. Log in to your BillBuddy account</p>
                    <p style="margin: 5px 0;">2. Go to the Settlements section</p>
                    <p style="margin: 5px 0;">3. Review and confirm your balances</p>
                    <p style="margin: 5px 0;">4. Complete the settlement process</p>
                  </div>

                  <div style="text-align: center; margin-top: 30px;">
                    <a href="https://your-billbuddy-url.com/settlements" 
                       style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                      Go to Settlements
                    </a>
                  </div>
                </div>

                <div style="text-align: center; margin-top: 20px; color: #7f8c8d; font-size: 12px;">
                  <p>This is an automated message from BillBuddy. Please do not reply to this email.</p>
                  <p>If you have any questions, please contact support at support@billbuddy.com</p>
                </div>
              </div>
            `
          };

          await transporter.sendMail(mailOptions);
          emailResults.sent++;
          console.log(`Email sent successfully to ${member.user.email}`);
        } catch (emailError) {
          emailResults.failed++;
          emailResults.errors.push({
            email: member.user.email,
            error: emailError.message
          });
          console.error(`Failed to send email to ${member.user.email}:`, emailError);
        }
      }
    });

    await Promise.all(emailPromises);

    // Prepare response based on email results
    if (emailResults.sent === emailResults.total) {
      res.json({ 
        message: 'Settlement created and all emails sent successfully',
        emailResults
      });
    } else if (emailResults.sent > 0) {
      res.json({ 
        message: 'Settlement created and some emails sent successfully',
        emailResults
      });
    } else {
      res.json({ 
        message: 'Settlement created but no emails were sent',
        emailResults
      });
    }
  } catch (err) {
    console.error('Error in settlement notification:', err);
    res.status(500).json({ 
      message: 'Error processing settlement notification',
      error: err.message,
      config: {
        user: emailConfig.user ? 'Set' : 'Not set',
        pass: emailConfig.pass ? 'Set' : 'Not set'
      }
    });
  }
});

// @route   GET /api/settlements/group/:groupId
// @desc    Get all settlements for a group
// @access  Private
router.get('/group/:groupId', protect, async (req, res) => {
  try {
    const { groupId } = req.params;

    // Check if group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isMember = group.members.some(
      member => member.user.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const settlements = await Settlement.find({ group: groupId })
      .populate('createdBy', 'name email');

    res.json(settlements);
  } catch (err) {
    console.error('Error fetching settlements:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/settlements/:id/status
// @desc    Update settlement status
// @access  Private
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const settlement = await Settlement.findById(id);
    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    // Check if user is the creator
    if (settlement.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    settlement.status = status;
    await settlement.save();

    res.json(settlement);
  } catch (err) {
    console.error('Error updating settlement:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 
const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const { protect } = require('../middleware/auth');

// @route   GET /api/expenses/recent
// @desc    Get recent expenses for the user
// @access  Private
router.get('/recent', protect, async (req, res) => {
  try {
    const expenses = await Expense.find({
      $or: [
        { paidBy: req.user.id },
        { splitAmong: req.user.id }
      ]
    })
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .populate('group', 'name')
      .sort('-date')
      .limit(10);

    res.json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/expenses
// @desc    Create a new expense
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { description, amount, group, splitAmong, category } = req.body;

    // Create new expense
    const expense = new Expense({
      description,
      amount,
      paidBy: req.user.id,
      group,
      splitAmong,
      category
    });

    await expense.save();

    // Add expense to group
    await Group.findByIdAndUpdate(group, {
      $push: { expenses: expense._id }
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/expenses/group/:groupId
// @desc    Get all expenses for a group
// @access  Private
router.get('/group/:groupId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member of the group
    const isMember = group.members.some(
      member => member.user.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized to access this group' });
    }

    const expenses = await Expense.find({ group: req.params.groupId })
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .sort('-date');

    res.json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/expenses/:id
// @desc    Get single expense
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is part of the expense
    const isInvolved = expense.splitAmong.some(
      user => user._id.toString() === req.user.id
    ) || expense.paidBy._id.toString() === req.user.id;

    if (!isInvolved) {
      return res.status(403).json({ message: 'Not authorized to access this expense' });
    }

    res.json(expense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/expenses/:id
// @desc    Update expense
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { description, amount, splitAmong, category } = req.body;

    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is the one who paid
    if (expense.paidBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this expense' });
    }

    // Update expense
    expense.description = description || expense.description;
    expense.amount = amount || expense.amount;
    expense.splitAmong = splitAmong || expense.splitAmong;
    expense.category = category || expense.category;

    await expense.save();

    res.json(expense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete expense
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is the one who paid
    if (expense.paidBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this expense' });
    }

    // Remove expense from group
    await Group.findByIdAndUpdate(expense.group, {
      $pull: { expenses: expense._id }
    });

    await expense.remove();

    res.json({ message: 'Expense removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/expenses/settle/:groupId
// @desc    Settle up group expenses
// @access  Private
router.post('/settle/:groupId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('members.user', 'name email')
      .populate('expenses');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member of the group
    const isMember = group.members.some(
      member => member.user._id.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized to settle this group' });
    }

    // Calculate balances
    const balances = group.calculateBalances();

    // Mark group as settled
    group.isSettled = true;
    await group.save();

    // TODO: Send email summary to all members

    res.json({
      message: 'Group settled successfully',
      balances
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 
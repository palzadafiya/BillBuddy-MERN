const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a group name'],
    trim: true,
    maxlength: [50, 'Group name cannot be more than 50 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    balance: {
      type: Number,
      default: 0
    }
  }],
  expenses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expense'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isSettled: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Method to calculate member balances
GroupSchema.methods.calculateBalances = function() {
  const balances = {};
  
  // Initialize balances for all members
  this.members.forEach(member => {
    balances[member.user.toString()] = 0;
  });

  // Calculate balances from expenses
  this.expenses.forEach(expense => {
    const paidBy = expense.paidBy.toString();
    const amount = expense.amount;
    const splitCount = expense.splitAmong.length;
    const perPersonShare = amount / splitCount;

    // Add to paidBy's balance
    balances[paidBy] = (balances[paidBy] || 0) + amount;

    // Subtract from each person's share
    expense.splitAmong.forEach(userId => {
      const id = userId.toString();
      if (id !== paidBy) {
        balances[id] = (balances[id] || 0) - perPersonShare;
      }
    });
  });

  return balances;
};

module.exports = mongoose.model('Group', GroupSchema); 
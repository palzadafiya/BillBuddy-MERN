const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    trim: true,
    maxlength: [100, 'Description cannot be more than 100 characters']
  },
  amount: {
    type: Number,
    required: [true, 'Please provide an amount'],
    min: [0, 'Amount cannot be negative']
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  splitAmong: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  category: {
    type: String,
    enum: ['Food', 'Travel', 'Shopping', 'Entertainment', 'Utilities', 'Other'],
    default: 'Other'
  }
});

// Method to calculate per person share
ExpenseSchema.methods.calculatePerPersonShare = function() {
  return this.amount / this.splitAmong.length;
};

module.exports = mongoose.model('Expense', ExpenseSchema); 
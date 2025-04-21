const mongoose = require('mongoose');

const SettlementSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  type: {
    type: String,
    enum: ['individual', 'group'],
    required: true
  },
  // For individual settlements
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  amount: {
    type: Number
  },
  // For group settlements
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add validation for required fields based on type
SettlementSchema.pre('validate', function(next) {
  if (this.type === 'individual') {
    if (!this.from || !this.to || !this.amount) {
      this.invalidate('type', 'Individual settlements require from, to, and amount fields');
    }
  }
  next();
});

module.exports = mongoose.model('Settlement', SettlementSchema); 
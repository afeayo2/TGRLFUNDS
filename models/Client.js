
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  dateOfBirth: { type: String, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  maritalStatus: { type: String, required: true },
  phone: { type: String, unique: true, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },

  balance: { type: Number, default: 0 },

  withdrawals: [{
    amount: Number,
    bankName: String,
    accountNumber: String,
    status: String,
    date: { type: Date, default: Date.now }
  }],

  address: {
    street: String,
    city: String,
    lga: String,
    state: String,
    landmark: String,
  },

  idType: String,
  idNumber: String,
  passportUrl: String,
  faceUrl: String,
  bvn: String,

  savings: {
    type: {
      type: String,
      enum: ['Daily', 'Weekly', 'Monthly'],
      required: true
    },
    days: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    duration: { type: String, required: true },
    method: { type: String, required: true }
  },

  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },
  onboardedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },
  onboardedAt: {
    type: Date,
    default: Date.now,
  },

  nextOfKin: {
    fullName: { type: String, required: true },
    relationship: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true }
  }

}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);





/*
  payments: [{
    amount: Number,
    method: String,
    reference: String,
    date: { type: Date, default: Date.now }
  }],
  */






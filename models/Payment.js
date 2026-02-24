const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
  amount: Number,
    charge:Number,
      totalPaid: Number,
  method: {
    type: String,
    enum: ["cash", "card", "loan-disbursement","loan-cash", "loan-repayment"],
    required: true
  },
  reference: String,
  date: { type: Date, default: Date.now }, 
}, { timestamps: true }); 


module.exports = mongoose.model('Payment', paymentSchema);

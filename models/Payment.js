const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
  amount: Number,
  method: String,
  reference: String,
  date: { type: Date, default: Date.now }, 
}, { timestamps: true }); 


module.exports = mongoose.model('Payment', paymentSchema);

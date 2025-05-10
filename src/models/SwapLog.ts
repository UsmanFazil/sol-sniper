import mongoose from 'mongoose';

const swapLogSchema = new mongoose.Schema({
  step: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed,
});

export const SwapLog = mongoose.model('SwapLog', swapLogSchema);

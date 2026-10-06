import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true
    },
    orderNumber: {
      type: String,
      trim: true,
      index: true
    },
    orderId: {
      type: String,
      trim: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    customerName: {
      type: String,
      default: '',
      trim: true
    },
    customerEmail: {
      type: String,
      default: '',
      trim: true
    },
    customerPhone: {
      type: String,
      default: '',
      trim: true
    },
    method: {
      type: String,
      enum: ['mpesa', 'card', 'cash'],
      default: 'mpesa'
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded', 'Pending', 'Processing', 'Paid', 'Failed', 'Refunded'],
      default: 'pending',
      index: true
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: 0
    },
    currency: {
      type: String,
      default: 'KES'
    },
    transactionId: {
      type: String,
      sparse: true,
      index: true
    },
    payheroReference: {
      type: String,
      sparse: true,
      index: true
    },
    phoneNumber: {
      type: String,
      default: '',
      trim: true
    },
    failureReason: {
      type: String,
      default: null
    },
    gatewayMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    paidAt: {
      type: Date,
      default: null
    },
    failedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export default Payment;

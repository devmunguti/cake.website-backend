import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Promotion code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Promotion title is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: 0
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    maxDiscountAmount: {
      type: Number,
      default: null
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    usageLimit: {
      type: Number,
      default: 100
    },
    usageCount: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

promotionSchema.methods.isValid = function (orderAmount = 0) {
  const now = new Date();
  if (!this.isActive) return false;
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  if (this.usageLimit && this.usageCount >= this.usageLimit) return false;
  if (this.minOrderAmount && orderAmount < this.minOrderAmount) return false;
  return true;
};

const Promotion = mongoose.models.Promotion || mongoose.model('Promotion', promotionSchema);
export default Promotion;

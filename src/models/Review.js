import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    orderNumber: {
      type: String,
      required: true,
      index: true
    },
    cake: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cake',
      default: null,
      index: true
    },
    cakeName: {
      type: String,
      default: 'Artisanal Cake',
      trim: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    customerName: {
      type: String,
      required: true,
      trim: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1500
    },
    images: {
      type: [String],
      default: []
    },
    occasion: {
      type: String,
      default: 'Birthday',
      trim: true
    },
    adminReply: {
      text: { type: String, default: null },
      repliedAt: { type: Date, default: null }
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

reviewSchema.index({ cake: 1, isPublished: 1, createdAt: -1 });
reviewSchema.index({ isPublished: 1, createdAt: -1 });

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
export default Review;

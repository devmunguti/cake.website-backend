import mongoose from 'mongoose';

const customCakeRequestSchema = new mongoose.Schema(
  {
    requestRef: {
      type: String,
      unique: true,
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
      required: [true, 'Customer name is required'],
      trim: true
    },
    customerEmail: {
      type: String,
      required: [true, 'Customer email is required'],
      lowercase: true,
      trim: true
    },
    customerPhone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    eventType: {
      type: String,
      default: 'Birthday',
      trim: true
    },
    numberOfGuests: {
      type: Number,
      default: 20,
      min: 1
    },
    preferredSize: {
      type: String,
      default: '2.0 KG',
      trim: true
    },
    preferredFlavour: {
      type: String,
      default: 'Vanilla & Chocolate',
      trim: true
    },
    preferredFillings: {
      type: String,
      default: '',
      trim: true
    },
    preferredColors: {
      type: String,
      default: '',
      trim: true
    },
    designRequirements: {
      type: String,
      required: [true, 'Design requirements and description are required'],
      trim: true
    },
    eventDate: {
      type: Date,
      required: [true, 'Event date is required']
    },
    budget: {
      type: Number,
      default: 0
    },
    referenceImages: {
      type: [String],
      default: []
    },
    specialInstructions: {
      type: String,
      default: '',
      trim: true
    },
    deliveryMethod: {
      type: String,
      enum: ['DELIVERY', 'PICKUP'],
      default: 'DELIVERY'
    },
    deliveryAddress: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'REVIEWING', 'QUOTE_SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED_TO_ORDER'],
      default: 'PENDING',
      index: true
    },
    quoteAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    quoteNotes: {
      type: String,
      default: '',
      trim: true
    },
    quoteExpiresAt: {
      type: Date,
      default: null
    },
    convertedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    adminNotes: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

customCakeRequestSchema.index({ status: 1, createdAt: -1 });

// Helper to generate sequential custom cake request reference
export async function generateNextCustomCakeRef() {
  try {
    const Model = mongoose.models.CustomCakeRequest || mongoose.model('CustomCakeRequest');
    const count = await Model.countDocuments();
    return `CCR-${String(count + 1).padStart(4, '0')}`;
  } catch (e) {
    return `CCR-${Date.now().toString().slice(-6)}`;
  }
}

customCakeRequestSchema.pre('save', async function () {
  if (!this.requestRef) {
    this.requestRef = await generateNextCustomCakeRef();
  }
});

const CustomCakeRequest = mongoose.models.CustomCakeRequest || mongoose.model('CustomCakeRequest', customCakeRequestSchema);
export default CustomCakeRequest;

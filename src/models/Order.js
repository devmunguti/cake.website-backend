import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    cake: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cake',
      required: true
    },
    cakeNameSnapshot: {
      type: String,
      required: true,
      trim: true
    },
    cakeImageSnapshot: {
      type: String,
      default: ''
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    size: {
      name: { type: String, default: '1.0 KG' },
      weightKg: { type: Number, default: 1.0 },
      priceAdjustment: { type: Number, default: 0 }
    },
    flavour: {
      name: { type: String, default: 'Classic Vanilla' },
      priceAdjustment: { type: Number, default: 0 }
    },
    filling: {
      name: { type: String, default: 'Vanilla Buttercream' },
      priceAdjustment: { type: Number, default: 0 }
    },
    decoration: {
      name: { type: String, default: 'Standard Piping' },
      priceAdjustment: { type: Number, default: 0 }
    },
    customMessage: {
      type: String,
      default: '',
      trim: true
    },
    specialInstructions: {
      type: String,
      default: '',
      trim: true
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: true }
);

const customerDetailsSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true }
  },
  { _id: false }
);

const addressSnapshotSchema = new mongoose.Schema(
  {
    street: { type: String, default: '' },
    city: { type: String, default: 'Nairobi' },
    houseNumber: { type: String, default: '' },
    landmark: { type: String, default: '' },
    instructions: { type: String, default: '' },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    }
  },
  { _id: false }
);

const orderTimelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true
    },
    // Alias for backward compatibility with older route references
    orderRef: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    customerDetails: {
      type: customerDetailsSchema,
      required: true
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [v => Array.isArray(v) && v.length > 0, 'Order must contain at least one cake.']
    },
    deliveryMethod: {
      type: String,
      enum: ['DELIVERY', 'PICKUP'],
      default: 'DELIVERY',
      index: true
    },
    deliveryAddress: {
      type: addressSnapshotSchema,
      default: () => ({})
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date (delivery or pickup) is required']
    },
    scheduledTimeSlot: {
      type: String,
      default: '10:00 AM - 12:00 PM',
      trim: true
    },
    pricing: {
      subtotal: { type: Number, default: 0, min: 0 },
      deliveryFee: { type: Number, default: 0, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      promoCode: { type: String, default: '' },
      grandTotal: { type: Number, default: 0, min: 0 }
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true
    },
    orderStatus: {
      type: String,
      enum: [
        'PENDING_PAYMENT',
        'PAYMENT_CONFIRMED',
        'ORDER_CONFIRMED',
        'PREPARING',
        'BAKING',
        'DECORATING',
        'READY',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'PICKUP_READY',
        'PICKED_UP',
        'COMPLETED',
        'CANCELLED'
      ],
      default: 'PENDING_PAYMENT',
      index: true
    },
    // Legacy status field bridge for older UI bindings
    status: {
      type: String,
      default: 'PENDING_PAYMENT'
    },
    notes: {
      type: String,
      default: '',
      trim: true
    },
    timeline: [orderTimelineSchema]
  },
  {
    timestamps: true
  }
);

// Compound Indexes for fast queries
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });

/**
 * Calculates next sequential order number: ORD-001, ORD-002, etc.
 */
export async function generateNextOrderRef() {
  try {
    const OrderModel = mongoose.models.Order || mongoose.model('Order');
    const count = await OrderModel.countDocuments();
    return `ORD-${String(count + 1).padStart(4, '0')}`;
  } catch (err) {
    return `ORD-${Date.now().toString().slice(-6)}`;
  }
}

// Pre-save hook: sync orderNumber, orderRef, status, and recalculate grandTotal
orderSchema.pre('save', async function () {
  if (!this.orderNumber) {
    const nextRef = await generateNextOrderRef();
    this.orderNumber = nextRef;
    this.orderRef = nextRef;
  } else if (!this.orderRef) {
    this.orderRef = this.orderNumber;
  }

  // Keep legacy status in sync with orderStatus
  if (this.orderStatus && (!this.status || this.isModified('orderStatus'))) {
    this.status = this.orderStatus;
  }

  // Authoritative server-side subtotal summation
  let calculatedSubtotal = 0;
  if (this.items && this.items.length > 0) {
    this.items.forEach(item => {
      item.totalPrice = Math.round((item.unitPrice * item.quantity) * 100) / 100;
      calculatedSubtotal += item.totalPrice;
    });
  }

  this.pricing.subtotal = calculatedSubtotal;
  const deliveryCost = this.deliveryMethod === 'DELIVERY' ? (this.pricing.deliveryFee || 0) : 0;
  const discountCost = this.pricing.discount || 0;
  this.pricing.grandTotal = Math.max(0, calculatedSubtotal + deliveryCost - discountCost);
});

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
export default Order;

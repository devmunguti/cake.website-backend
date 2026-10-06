import mongoose from 'mongoose';

const sizeOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g., "1.0 KG", "2.0 KG"
    weightKg: { type: Number, default: 1.0 },
    priceAdjustment: { type: Number, default: 0, min: 0 }, // Additional price relative to basePrice
    serves: { type: String, default: '6-8 people', trim: true },
    isDefault: { type: Boolean, default: false }
  },
  { _id: true }
);

const flavourOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Chocolate Ganache", "Red Velvet"
    priceAdjustment: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
    isDefault: { type: Boolean, default: false }
  },
  { _id: true }
);

const fillingOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Strawberry Compote", "Salted Caramel"
    priceAdjustment: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
    isDefault: { type: Boolean, default: false }
  },
  { _id: true }
);

const decorationOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Fresh Flowers & Macarons", "Standard Piping"
    priceAdjustment: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' }
  },
  { _id: true }
);

const cakeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Cake name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true
    },
    categoryName: {
      type: String,
      default: 'General Cakes',
      trim: true
    },
    images: {
      type: [String],
      default: []
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: 0
    },
    sizes: {
      type: [sizeOptionSchema],
      default: [
        { name: '0.5 KG', weightKg: 0.5, priceAdjustment: 0, serves: '2-4 people', isDefault: true },
        { name: '1.0 KG', weightKg: 1.0, priceAdjustment: 800, serves: '6-8 people', isDefault: false },
        { name: '1.5 KG', weightKg: 1.5, priceAdjustment: 1600, serves: '10-12 people', isDefault: false },
        { name: '2.0 KG', weightKg: 2.0, priceAdjustment: 2400, serves: '14-18 people', isDefault: false },
        { name: '3.0 KG', weightKg: 3.0, priceAdjustment: 4000, serves: '20-25 people', isDefault: false }
      ]
    },
    flavours: {
      type: [flavourOptionSchema],
      default: [
        { name: 'Classic Vanilla Bean', priceAdjustment: 0, isDefault: true },
        { name: 'Rich Belgian Chocolate', priceAdjustment: 150, isDefault: false },
        { name: 'Signature Red Velvet', priceAdjustment: 200, isDefault: false },
        { name: 'Decadent Black Forest', priceAdjustment: 250, isDefault: false },
        { name: 'Zesty Lemon Blueberry', priceAdjustment: 200, isDefault: false },
        { name: 'Caramel Butterscotch', priceAdjustment: 150, isDefault: false }
      ]
    },
    fillings: {
      type: [fillingOptionSchema],
      default: [
        { name: 'Vanilla Buttercream', priceAdjustment: 0, isDefault: true },
        { name: 'Dark Chocolate Ganache', priceAdjustment: 150, isDefault: false },
        { name: 'Fresh Strawberry Puree', priceAdjustment: 150, isDefault: false },
        { name: 'Salted Caramel Cream', priceAdjustment: 150, isDefault: false },
        { name: 'Cream Cheese Frosting', priceAdjustment: 200, isDefault: false }
      ]
    },
    decorationOptions: {
      type: [decorationOptionSchema],
      default: [
        { name: 'Standard Buttercream Swirls & Pearls', priceAdjustment: 0 },
        { name: 'Fresh Berry Crown & Edible Flowers', priceAdjustment: 400 },
        { name: 'Gold Leaf & Macaron Elegance', priceAdjustment: 650 },
        { name: 'Custom 3D Fondant Figurine / Theme Topper', priceAdjustment: 1200 }
      ]
    },
    preparationTimeHours: {
      type: Number,
      default: 24, // e.g. 24 hours lead time
      min: 1
    },
    preparationTimeText: {
      type: String,
      default: '24-48 hours'
    },
    available: {
      type: Boolean,
      default: true,
      index: true
    },
    featured: {
      type: Boolean,
      default: false,
      index: true
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5
    },
    reviewsCount: {
      type: Number,
      default: 0
    },
    tags: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Indexes
cakeSchema.index({ slug: 1, available: 1 });
cakeSchema.index({ featured: 1, available: 1 });
cakeSchema.index({ category: 1, available: 1 });
cakeSchema.index({ name: 'text', description: 'text', tags: 'text' });

const Cake = mongoose.models.Cake || mongoose.model('Cake', cakeSchema);
export default Cake;

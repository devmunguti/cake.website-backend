import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Cake from '../models/Cake.js';
import Promotion from '../models/Promotion.js';
import SystemSetting from '../models/SystemSetting.js';
import Review from '../models/Review.js';
import Order from '../models/Order.js';

dotenv.config();

const categories = [
  {
    name: 'Birthday Cakes',
    slug: 'birthday-cakes',
    description: 'Vibrant, celebratory cakes handcrafted to make every birthday unforgettable.',
    image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
    icon: 'cake',
    displayOrder: 1,
    isActive: true
  },
  {
    name: 'Wedding & Anniversary',
    slug: 'wedding-anniversary',
    description: 'Elegant multi-tiered architectural masterpieces adorned with edible lace and fresh blossoms.',
    image: 'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=800&q=80',
    icon: 'celebration',
    displayOrder: 2,
    isActive: true
  },
  {
    name: 'Chocolate & Truffle',
    slug: 'chocolate-truffle',
    description: 'Intensely rich, multi-layered cakes made with imported Belgian and Valrhona cocoa.',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80',
    icon: 'cookie',
    displayOrder: 3,
    isActive: true
  },
  {
    name: 'Signature Velvet & Fruits',
    slug: 'signature-velvet-fruits',
    description: 'Moist red velvet, lemon berry, and tropical fruit medleys layered with silky buttercream.',
    image: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80',
    icon: 'spa',
    displayOrder: 4,
    isActive: true
  },
  {
    name: 'Cupcakes & Mini Treats',
    slug: 'cupcakes-mini-treats',
    description: 'Bite-sized artisanal perfection for parties, corporate events, and gift boxes.',
    image: 'https://images.unsplash.com/photo-1587668178277-295251f900ce?auto=format&fit=crop&w=800&q=80',
    icon: 'bakery_dining',
    displayOrder: 5,
    isActive: true
  }
];

export async function seedBakeryDatabase() {
  try {
    await connectDB();
    console.log('🌱 Seeding Cake Bakery database...');

    // 1. Seed System Settings
    await SystemSetting.deleteMany({});
    const settings = await SystemSetting.create({
      general: {
        platformName: 'Sweet Delights Bakery',
        supportEmail: 'orders@sweetdelightsbakery.co.ke',
        adminAlertEmail: 'admin@sweetdelightsbakery.co.ke',
        supportPhone: '+254 700 123 456',
        whatsappNumber: '+254 700 123 456',
        storeAddress: '1st Avenue, Parklands / Westlands, Nairobi, Kenya',
        currency: 'KES'
      },
      bakeryOperations: {
        defaultDeliveryFee: 350,
        freeDeliveryThreshold: 6000,
        minimumLeadTimeHours: 24,
        openingTime: '08:00 AM',
        closingTime: '07:00 PM',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        pickupInstructions: 'Pickups are ready at our main bakery shop between 9 AM and 6 PM. Please present your Order Reference upon arrival.',
        deliveryInstructions: 'We hand-deliver delicate cakes in temperature-controlled carriers across Nairobi and surrounding zones.'
      },
      operations: {
        maintenanceMode: false
      },
      paymentMethods: {
        mpesaTillNumber: '8995354',
        mpesaPaybillNumber: '522522',
        mpesaAccountNumber: 'SWEETCAKES',
        instructions: 'Make payment via M-Pesa STK Push prompt on your phone or use our Paybill/Till.'
      }
    });
    console.log('✅ System Settings seeded');

    // 2. Seed Users (Admin & Sample Customer)
    await User.deleteMany({});
    const adminUser = await User.create({
      firstName: 'Bakery',
      lastName: 'Admin',
      fullName: 'Bakery Owner & Master Chef',
      email: 'admin@sweetdelightsbakery.co.ke',
      phone: '+254700123456',
      passwordHash: 'Admin@12345',
      role: 'admin',
      status: 'Active',
      isActive: true,
      isEmailVerified: true
    });

    const customerUser = await User.create({
      firstName: 'Sarah',
      lastName: 'Mwangi',
      fullName: 'Sarah Mwangi',
      email: 'customer@sweetdelightsbakery.co.ke',
      phone: '+254712345678',
      passwordHash: 'Customer@12345',
      role: 'customer',
      status: 'Active',
      isActive: true,
      isEmailVerified: true,
      addresses: [
        {
          street: 'Apartment 4B, Kileleshwa Heights, Githunguri Rd',
          city: 'Nairobi',
          houseNumber: '4B',
          landmark: 'Near QuickMart Kileleshwa',
          isDefault: true
        }
      ]
    });
    console.log('✅ Admin & Customer accounts seeded');

    // 3. Seed Categories
    await Category.deleteMany({});
    const createdCategories = await Category.insertMany(categories);
    console.log(`✅ ${createdCategories.length} Categories seeded`);

    const catMap = {};
    createdCategories.forEach(c => {
      catMap[c.slug] = c._id;
    });

    // 4. Seed Cakes
    await Cake.deleteMany({});
    const cakesData = [
      {
        name: 'Royal Belgian Chocolate Ganache Cake',
        slug: 'royal-belgian-chocolate-ganache-cake',
        description: 'Layers of moist dark chocolate sponge enveloped in silky Belgian chocolate ganache, finished with artisan cocoa dust and chocolate shards.',
        category: catMap['chocolate-truffle'],
        categoryName: 'Chocolate & Truffle',
        images: [
          'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=1000&q=80'
        ],
        basePrice: 2800,
        sizes: [
          { name: '0.5 KG', weightKg: 0.5, priceAdjustment: 0, serves: '2-4 people', isDefault: false },
          { name: '1.0 KG', weightKg: 1.0, priceAdjustment: 1000, serves: '6-8 people', isDefault: true },
          { name: '1.5 KG', weightKg: 1.5, priceAdjustment: 2000, serves: '10-12 people', isDefault: false },
          { name: '2.0 KG', weightKg: 2.0, priceAdjustment: 3000, serves: '14-18 people', isDefault: false },
          { name: '3.0 KG', weightKg: 3.0, priceAdjustment: 5000, serves: '20-25 people', isDefault: false }
        ],
        flavours: [
          { name: 'Decadent Dark Truffle', priceAdjustment: 0, isDefault: true },
          { name: 'Espresso Mocha Infusion', priceAdjustment: 200, isDefault: false },
          { name: 'Hazelnut Nutella Swirl', priceAdjustment: 300, isDefault: false }
        ],
        fillings: [
          { name: 'Dark Chocolate Ganache', priceAdjustment: 0, isDefault: true },
          { name: 'Salted Caramel Silk', priceAdjustment: 200, isDefault: false },
          { name: 'Fresh Raspberry Compote', priceAdjustment: 250, isDefault: false }
        ],
        decorationOptions: [
          { name: 'Gold Leaf & Chocolate Shards', priceAdjustment: 0 },
          { name: 'Fresh Berry Crown & Edible Gold', priceAdjustment: 500 },
          { name: 'Custom Fondant Birthday Banner', priceAdjustment: 800 }
        ],
        preparationTimeHours: 24,
        preparationTimeText: '24 hours',
        available: true,
        featured: true,
        rating: 4.9,
        reviewsCount: 42,
        tags: ['chocolate', 'bestseller', 'birthday', 'gourmet']
      },
      {
        name: 'Signature Red Velvet Dream Cake',
        slug: 'signature-red-velvet-dream-cake',
        description: 'Velvety crimson sponge with subtle cocoa undertones, filled and frosted with traditional Madagascar vanilla cream cheese icing.',
        category: catMap['signature-velvet-fruits'],
        categoryName: 'Signature Velvet & Fruits',
        images: [
          'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&w=1000&q=80'
        ],
        basePrice: 2600,
        sizes: [
          { name: '0.5 KG', weightKg: 0.5, priceAdjustment: 0, serves: '2-4 people', isDefault: false },
          { name: '1.0 KG', weightKg: 1.0, priceAdjustment: 900, serves: '6-8 people', isDefault: true },
          { name: '1.5 KG', weightKg: 1.5, priceAdjustment: 1800, serves: '10-12 people', isDefault: false },
          { name: '2.0 KG', weightKg: 2.0, priceAdjustment: 2700, serves: '14-18 people', isDefault: false },
          { name: '3.0 KG', weightKg: 3.0, priceAdjustment: 4500, serves: '20-25 people', isDefault: false }
        ],
        flavours: [
          { name: 'Classic Red Velvet', priceAdjustment: 0, isDefault: true },
          { name: 'Red Velvet with White Choc Chips', priceAdjustment: 200, isDefault: false }
        ],
        fillings: [
          { name: 'Signature Cream Cheese Frosting', priceAdjustment: 0, isDefault: true },
          { name: 'White Chocolate Buttercream', priceAdjustment: 150, isDefault: false }
        ],
        decorationOptions: [
          { name: 'Velvet Crumbs & Red Rose Petals', priceAdjustment: 0 },
          { name: 'French Macarons & Floral Accents', priceAdjustment: 600 }
        ],
        preparationTimeHours: 24,
        preparationTimeText: '24 hours',
        available: true,
        featured: true,
        rating: 5.0,
        reviewsCount: 38,
        tags: ['red velvet', 'anniversary', 'bestseller', 'romantic']
      },
      {
        name: 'Festive Confetti Birthday Party Cake',
        slug: 'festive-confetti-birthday-party-cake',
        description: 'Joyful Madagascar vanilla bean sponge loaded with vibrant rainbow sprinkles, frosted with Swiss meringue buttercream and drip icing.',
        category: catMap['birthday-cakes'],
        categoryName: 'Birthday Cakes',
        images: [
          'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=1000&q=80'
        ],
        basePrice: 2400,
        sizes: [
          { name: '0.5 KG', weightKg: 0.5, priceAdjustment: 0, serves: '2-4 people', isDefault: false },
          { name: '1.0 KG', weightKg: 1.0, priceAdjustment: 800, serves: '6-8 people', isDefault: true },
          { name: '1.5 KG', weightKg: 1.5, priceAdjustment: 1600, serves: '10-12 people', isDefault: false },
          { name: '2.0 KG', weightKg: 2.0, priceAdjustment: 2400, serves: '14-18 people', isDefault: false }
        ],
        flavours: [
          { name: 'Funfetti Vanilla Bean', priceAdjustment: 0, isDefault: true },
          { name: 'Strawberry Funfetti', priceAdjustment: 150, isDefault: false }
        ],
        fillings: [
          { name: 'Sweet Vanilla Buttercream', priceAdjustment: 0, isDefault: true },
          { name: 'Strawberry Glaze', priceAdjustment: 150, isDefault: false }
        ],
        decorationOptions: [
          { name: 'Rainbow Drip & Lollipops', priceAdjustment: 0 },
          { name: 'Custom Name Cake Topper & Sparklers', priceAdjustment: 450 }
        ],
        preparationTimeHours: 24,
        preparationTimeText: '24 hours',
        available: true,
        featured: true,
        rating: 4.8,
        reviewsCount: 29,
        tags: ['birthday', 'kids', 'celebration', 'party']
      },
      {
        name: 'Cascading Fresh Floral Wedding Cake',
        slug: 'cascading-fresh-floral-wedding-cake',
        description: 'Multi-tiered centerpiece cake draped in smooth white fondant with cascading fresh pastel roses, eucalyptus sprigs, and edible gold leaf.',
        category: catMap['wedding-anniversary'],
        categoryName: 'Wedding & Anniversary',
        images: [
          'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=1000&q=80'
        ],
        basePrice: 6500,
        sizes: [
          { name: '2.0 KG (2-Tier)', weightKg: 2.0, priceAdjustment: 0, serves: '20-25 people', isDefault: true },
          { name: '3.5 KG (3-Tier)', weightKg: 3.5, priceAdjustment: 4500, serves: '40-50 people', isDefault: false },
          { name: '5.0 KG (3-Tier Grand)', weightKg: 5.0, priceAdjustment: 9000, serves: '70-90 people', isDefault: false }
        ],
        flavours: [
          { name: 'Almond Champagne & Vanilla', priceAdjustment: 0, isDefault: true },
          { name: 'Lemon Elderflower Bliss', priceAdjustment: 400, isDefault: false },
          { name: 'White Chocolate Raspberry', priceAdjustment: 500, isDefault: false }
        ],
        fillings: [
          { name: 'Madagascar Vanilla Bean Custard', priceAdjustment: 0, isDefault: true },
          { name: 'Passion Fruit Curd & White Ganache', priceAdjustment: 300, isDefault: false }
        ],
        decorationOptions: [
          { name: 'Fresh Roses & Gold Leaf Accents', priceAdjustment: 0 },
          { name: 'Full Cascading Botanical Installation', priceAdjustment: 1500 }
        ],
        preparationTimeHours: 48,
        preparationTimeText: '48 hours',
        available: true,
        featured: true,
        rating: 5.0,
        reviewsCount: 19,
        tags: ['wedding', 'luxury', 'anniversary', 'tiered']
      },
      {
        name: 'Artisan Gourmet Cupcake Platter (Box of 12)',
        slug: 'artisan-gourmet-cupcake-platter-box-of-12',
        description: 'An assorted dozen of our finest cupcakes: 3 Red Velvet, 3 Triple Chocolate, 3 Salted Caramel, and 3 Lemon Berry Bliss.',
        category: catMap['cupcakes-mini-treats'],
        categoryName: 'Cupcakes & Mini Treats',
        images: [
          'https://images.unsplash.com/photo-1587668178277-295251f900ce?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&w=1000&q=80'
        ],
        basePrice: 2400,
        sizes: [
          { name: 'Box of 12 Cupcakes', weightKg: 1.2, priceAdjustment: 0, serves: '12 people', isDefault: true },
          { name: 'Box of 24 Cupcakes', weightKg: 2.4, priceAdjustment: 2200, serves: '24 people', isDefault: false }
        ],
        flavours: [
          { name: 'Chef Assorted Best Sellers', priceAdjustment: 0, isDefault: true },
          { name: 'All Chocolate Obsession', priceAdjustment: 100, isDefault: false },
          { name: 'All Red Velvet Romance', priceAdjustment: 100, isDefault: false }
        ],
        fillings: [
          { name: 'Center Filled Surprise Assortment', priceAdjustment: 0, isDefault: true }
        ],
        decorationOptions: [
          { name: 'Elegant Swirls & Toppings', priceAdjustment: 0 }
        ],
        preparationTimeHours: 12,
        preparationTimeText: '12-24 hours',
        available: true,
        featured: false,
        rating: 4.9,
        reviewsCount: 22,
        tags: ['cupcakes', 'gift', 'platter', 'treats']
      }
    ];

    const createdCakes = await Cake.insertMany(cakesData);
    console.log(`✅ ${createdCakes.length} Artisanal Cakes seeded`);

    // 5. Seed Promotions
    await Promotion.deleteMany({});
    const promotionsData = [
      {
        code: 'SWEET10',
        title: '10% Welcome Discount',
        description: 'Enjoy 10% off your entire cake order today!',
        discountType: 'percentage',
        discountValue: 10,
        minOrderAmount: 2000,
        maxDiscountAmount: 1000,
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true
      },
      {
        code: 'PARTY500',
        title: 'KES 500 Off Party Cakes',
        description: 'Flat KES 500 discount for orders over KES 3,500',
        discountType: 'fixed',
        discountValue: 500,
        minOrderAmount: 3500,
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true
      }
    ];
    await Promotion.insertMany(promotionsData);
    console.log('✅ Promotions seeded');

    // 6. Seed Sample Completed Order & Reviews
    await Order.deleteMany({});
    await Review.deleteMany({});

    const sampleOrder = await Order.create({
      orderNumber: 'ORD-0001',
      orderRef: 'ORD-0001',
      customer: customerUser._id,
      customerDetails: {
        fullName: 'Sarah Mwangi',
        phone: '+254712345678',
        email: 'customer@sweetdelightsbakery.co.ke'
      },
      items: [
        {
          cake: createdCakes[0]._id,
          cakeNameSnapshot: createdCakes[0].name,
          cakeImageSnapshot: createdCakes[0].images[0],
          quantity: 1,
          size: { name: '1.0 KG', weightKg: 1.0, priceAdjustment: 1000 },
          flavour: { name: 'Decadent Dark Truffle', priceAdjustment: 0 },
          filling: { name: 'Dark Chocolate Ganache', priceAdjustment: 0 },
          decoration: { name: 'Gold Leaf & Chocolate Shards', priceAdjustment: 0 },
          customMessage: 'Happy 30th Birthday David!',
          unitPrice: 3800,
          totalPrice: 3800
        }
      ],
      deliveryMethod: 'DELIVERY',
      deliveryAddress: {
        street: 'Apartment 4B, Kileleshwa Heights',
        city: 'Nairobi'
      },
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      scheduledTimeSlot: '02:00 PM - 04:00 PM',
      pricing: {
        subtotal: 3800,
        deliveryFee: 350,
        discount: 0,
        grandTotal: 4150
      },
      paymentStatus: 'PAID',
      orderStatus: 'COMPLETED',
      status: 'COMPLETED',
      timeline: [
        { status: 'PENDING_PAYMENT', timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000), note: 'Order placed' },
        { status: 'PAYMENT_CONFIRMED', timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000), note: 'M-Pesa payment received' },
        { status: 'BAKING', timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000), note: 'Baking sponge layers' },
        { status: 'DECORATING', timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000), note: 'Decorating with gold leaf' },
        { status: 'COMPLETED', timestamp: new Date(), note: 'Hand-delivered to customer' }
      ]
    });

    await Review.create({
      order: sampleOrder._id,
      orderNumber: sampleOrder.orderNumber,
      cake: createdCakes[0]._id,
      cakeName: createdCakes[0].name,
      customer: customerUser._id,
      customerName: 'Sarah Mwangi',
      rating: 5,
      comment: 'Absolutely spectacular! The Belgian chocolate ganache was so rich, moist, and perfectly balanced. The gold leaf piping looked like a work of art. Highly recommend Sweet Delights!',
      occasion: '30th Birthday Party',
      isPublished: true,
      isFeatured: true,
      adminReply: {
        text: 'Thank you so much Sarah! It was an absolute delight baking for David’s milestone birthday.',
        repliedAt: new Date()
      }
    });

    console.log('✅ Sample Order & Review seeded');
    console.log('🎉 Cake Bakery Database seeding complete!');
  } catch (error) {
    console.error('❌ Seeding error:', error);
  } finally {
    process.exit(0);
  }
}

if (process.argv[1].endsWith('seedBakeryData.js')) {
  seedBakeryDatabase();
}

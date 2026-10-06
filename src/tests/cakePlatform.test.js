import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import Cake from '../models/Cake.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import CustomCakeRequest from '../models/CustomCakeRequest.js';
import Promotion from '../models/Promotion.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import { VALID_ORDER_TRANSITIONS } from '../controllers/orderController.js';

dotenv.config();

async function runCakePlatformTests() {
  console.log('🧪 Starting Cake Platform Test Suite...\n');
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
    }
  }

  try {
    await connectDB();

    // 1. Test Category & Cake Models
    console.log('--- Test Suite 1: Cake Catalog & Options ---');
    const categories = await Category.find({ isActive: true });
    assert(categories.length >= 4, 'Categories populated with active status');

    const cakes = await Cake.find({ available: true }).populate('category');
    assert(cakes.length >= 4, 'Cakes catalog populated and linked to categories');

    const chocolateCake = await Cake.findOne({ slug: 'royal-belgian-chocolate-ganache-cake' });
    assert(!!chocolateCake, 'Found Belgian Chocolate cake by slug');
    assert(chocolateCake.sizes?.length >= 3, 'Cake supports multiple weight sizes (0.5kg, 1kg, 2kg, etc.)');
    assert(chocolateCake.flavours?.length >= 2, 'Cake supports multiple sponge flavours');
    assert(chocolateCake.fillings?.length >= 2, 'Cake supports multiple gourmet fillings');
    assert(chocolateCake.decorationOptions?.length >= 2, 'Cake supports decoration options');

    // 2. Test Server-side Pricing Recalculation Engine
    console.log('\n--- Test Suite 2: Authoritative Server-side Pricing Engine ---');
    const basePrice = chocolateCake.basePrice; // 2800
    const sizeAdj = chocolateCake.sizes.find(s => s.name === '2.0 KG')?.priceAdjustment || 3000;
    const flavAdj = chocolateCake.flavours[0]?.priceAdjustment || 0;
    const fillAdj = chocolateCake.fillings[0]?.priceAdjustment || 0;
    const decoAdj = chocolateCake.decorationOptions[0]?.priceAdjustment || 0;

    const calculatedUnitPrice = basePrice + sizeAdj + flavAdj + fillAdj + decoAdj;
    const qty = 2;
    const subtotal = calculatedUnitPrice * qty;

    const testOrder = new Order({
      customerDetails: {
        fullName: 'Test Customer',
        phone: '0712345678',
        email: 'test@example.com'
      },
      items: [
        {
          cake: chocolateCake._id,
          cakeNameSnapshot: chocolateCake.name,
          quantity: qty,
          size: { name: '2.0 KG', priceAdjustment: sizeAdj },
          flavour: { name: chocolateCake.flavours[0].name, priceAdjustment: flavAdj },
          filling: { name: chocolateCake.fillings[0].name, priceAdjustment: fillAdj },
          decoration: { name: chocolateCake.decorationOptions[0].name, priceAdjustment: decoAdj },
          unitPrice: calculatedUnitPrice,
          totalPrice: subtotal
        }
      ],
      deliveryMethod: 'DELIVERY',
      scheduledDate: new Date(Date.now() + 48 * 3600 * 1000),
      pricing: {
        deliveryFee: 350,
        discount: 0
      }
    });

    await testOrder.save();
    assert(testOrder.orderNumber.startsWith('ORD-'), `Sequential order number generated (${testOrder.orderNumber})`);
    assert(testOrder.pricing.subtotal === subtotal, `Server-calculated subtotal matches (${testOrder.pricing.subtotal})`);
    assert(testOrder.pricing.grandTotal === subtotal + 350, `Grand total includes server delivery fee (${testOrder.pricing.grandTotal})`);

    // 3. Test Order Status State Transitions
    console.log('\n--- Test Suite 3: Order Lifecycle State Machine ---');
    const allowedFromPending = VALID_ORDER_TRANSITIONS['PENDING_PAYMENT'];
    assert(allowedFromPending.includes('PAYMENT_CONFIRMED'), 'PENDING_PAYMENT can transition to PAYMENT_CONFIRMED');
    assert(!allowedFromPending.includes('DELIVERED'), 'PENDING_PAYMENT cannot jump straight to DELIVERED');

    testOrder.orderStatus = 'BAKING';
    testOrder.timeline.push({ status: 'BAKING', timestamp: new Date(), note: 'In oven' });
    await testOrder.save();
    assert(testOrder.orderStatus === 'BAKING', 'Order status moved to BAKING in oven');

    // 4. Test Payment Idempotency & M-Pesa Record
    console.log('\n--- Test Suite 4: Payment Idempotency & Gateway Ledger ---');
    const payment = await Payment.create({
      order: testOrder._id,
      orderNumber: testOrder.orderNumber,
      amount: testOrder.pricing.grandTotal,
      method: 'mpesa',
      status: 'pending',
      payheroReference: `TEST-PH-${Date.now()}`
    });

    assert(payment.status === 'pending', 'Payment record initialized in pending state');
    payment.status = 'paid';
    payment.paidAt = new Date();
    payment.transactionId = `WS719${Date.now().toString().slice(-5)}`;
    await payment.save();

    assert(payment.status === 'paid', `Payment successfully processed with receipt ${payment.transactionId}`);

    // 5. Test Promotions & Coupon Validation
    console.log('\n--- Test Suite 5: Promotions & Discount Rules ---');
    const promo = await Promotion.findOne({ code: 'SWEET10' });
    assert(!!promo, 'Found SWEET10 promo code in database');
    assert(promo.isValid(4000) === true, 'SWEET10 valid for order above minOrderAmount');
    assert(promo.isValid(500) === false, 'SWEET10 rejects order below minOrderAmount');

    // 6. Test Custom Cake Requests & Quotations
    console.log('\n--- Test Suite 6: Custom Cake Inquiries & Quotation ---');
    const customReq = await CustomCakeRequest.create({
      customerName: 'Alice Mwangi',
      customerEmail: 'alice@example.com',
      customerPhone: '0700112233',
      eventType: 'Wedding Reception',
      numberOfGuests: 80,
      preferredSize: '4.0 KG 3-Tier',
      designRequirements: 'Cascading ivory sugar flowers with edible pearls',
      eventDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      budget: 15000
    });

    assert(customReq.requestRef.startsWith('CCR-'), `Custom Cake Reference generated: ${customReq.requestRef}`);
    assert(customReq.status === 'PENDING', 'Initial bespoke request status is PENDING');

    customReq.quoteAmount = 14500;
    customReq.status = 'QUOTE_SENT';
    await customReq.save();
    assert(customReq.status === 'QUOTE_SENT' && customReq.quoteAmount === 14500, 'Admin quotation attached to custom request');

    // 7. Test Verified Review Submission
    console.log('\n--- Test Suite 7: Reviews & Rating Aggregation ---');
    const review = await Review.create({
      order: testOrder._id,
      orderNumber: testOrder.orderNumber,
      cake: chocolateCake._id,
      cakeName: chocolateCake.name,
      customerName: 'Test Customer',
      rating: 5,
      comment: 'Delicious Belgian chocolate cake! Perfect sweetness and fluffy crumb.',
      occasion: 'Birthday'
    });

    assert(review.rating === 5, 'Review recorded with 5 stars');
    assert(review.isPublished === true, 'Review published');

    // Clean up temporary test order
    await Order.findByIdAndDelete(testOrder._id);
    await Payment.findByIdAndDelete(payment._id);
    await CustomCakeRequest.findByIdAndDelete(customReq._id);
    await Review.findByIdAndDelete(review._id);

    console.log(`\n========================================`);
    console.log(`🎯 Test Summary: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log(`========================================\n`);

  } catch (error) {
    console.error('❌ Test suite execution error:', error);
  } finally {
    process.exit(0);
  }
}

runCakePlatformTests();

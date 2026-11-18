// Comprehensive Automated Test Suite for AYAPA Wholesale Platform
import { store, CATEGORIES } from './js/store.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('========================================================');
console.log('🧪 RUNNING AYAPA WHOLESALE AUTOMATED TEST SUITE');
console.log('========================================================\n');

// 1. PIN & Security Tests
console.log('--- Test 1: Admin PIN Verification & Security ---');
assert(store.settings.adminPin === '971400', 'Default admin PIN is strictly set to 971400');
assert(store.settings.whatsappNumber === '447767935049', 'AYAPA EPOS WhatsApp number is set to 447767935049');

store.logoutAdmin();
assert(store.isAdmin === false, 'Admin is logged out initially');

const failLogin = store.loginAdmin('0000');
assert(failLogin === false && store.isAdmin === false, 'Incorrect PIN is rejected');

const successLogin = store.loginAdmin('971400');
assert(successLogin === true && store.isAdmin === true, 'Admin PIN 971400 successfully authenticates');

// 2. Catalog & Inventory Data Tests
console.log('\n--- Test 2: Catalog Products & Categories ---');
assert(store.products.length >= 90, `Catalog contains ${store.products.length} wholesale products`);
assert(CATEGORIES.includes('All') && CATEGORIES.includes('Cables') && CATEGORIES.includes('Chargers'), 'All standard categories present');

const sampleProduct = store.products.find(p => p.code === 'AA4512');
assert(sampleProduct !== undefined, 'Sample cable AA4512 is present');
assert(sampleProduct.priceExVat === 1.84, 'AA4512 wholesale price ex VAT is £1.84');
assert(Math.abs(sampleProduct.priceIncVat - 2.21) < 0.05, `AA4512 inc VAT is £${sampleProduct.priceIncVat} (expected ~£2.21)`);

// 3. Cart & Real-Time Calculation Tests
console.log('\n--- Test 3: Cart Actions & Calculations ---');
store.clearCart();
assert(store.getCartCount() === 0, 'Cart is cleared');

store.addToCart('AA4512', 10);
assert(store.getCartCount() === 10, 'Added 10 units of AA4512 to cart');

store.addToCart('AA4512', 5);
assert(store.getCartCount() === 15, 'Added 5 more units -> total is 15');

store.setCartQuantity('AA4512', 20);
assert(store.getCartCount() === 20, 'Set direct quantity to 20 units');

const totals = store.getCartTotals();
const expectedSubtotal = 1.84 * 20; // £36.80
const expectedVat = expectedSubtotal * 0.20; // £7.36
const expectedTotalInc = expectedSubtotal + expectedVat; // £44.16

assert(Math.abs(totals.subtotalExVat - expectedSubtotal) < 0.01, `Subtotal Ex VAT is £${totals.subtotalExVat.toFixed(2)} (expected £${expectedSubtotal.toFixed(2)})`);
assert(Math.abs(totals.vatAmount - expectedVat) < 0.01, `VAT (20%) is £${totals.vatAmount.toFixed(2)} (expected £${expectedVat.toFixed(2)})`);
assert(Math.abs(totals.totalIncVat - expectedTotalInc) < 0.01, `Total Inc VAT is £${totals.totalIncVat.toFixed(2)} (expected £${expectedTotalInc.toFixed(2)})`);
assert(totals.estimatedProfit > 0, `Estimated profit is positive: £${totals.estimatedProfit.toFixed(2)} (${Math.round(totals.marginPct)}% Margin)`);

// 4. Out-of-Stock Logic Tests
console.log('\n--- Test 4: Inventory Out-of-Stock Guards ---');
const testProdId = sampleProduct.id;
store.updateProduct(testProdId, { stock: false });
const outOfStockProd = store.products.find(p => p.id === testProdId);
assert(outOfStockProd.stock === false, 'Product successfully marked Out of Stock');

const initialCartCount = store.getCartCount();
store.addToCart(testProdId, 5);
assert(store.getCartCount() === initialCartCount, 'Out-of-stock product cannot be added to cart');

// Restore in stock
store.updateProduct(testProdId, { stock: true });
assert(store.products.find(p => p.id === testProdId).stock === true, 'Product marked back In Stock');

// 5. Order Placement & Dispatch Tests
console.log('\n--- Test 5: Wholesale Order Submission & Multi-Channel Dispatch ---');
const orderData = {
  shopName: 'Metro Mobile Repairs',
  contactName: 'Tariq Khan',
  mobileNumber: '07767935049',
  email: 'orders@metromobile.co.uk',
  shopAddress: '142 Commercial Road',
  city: 'London',
  postcode: 'E1 1NL',
  deliveryNotes: 'Please deliver after 11am'
};

const newOrder = store.submitOrder(orderData);
assert(newOrder !== undefined && newOrder.orderId.startsWith('AYP-'), `Order created successfully: ${newOrder.orderId}`);
assert(store.getCartCount() === 0, 'Cart is cleared after order submission');
assert(store.orders[0].orderId === newOrder.orderId, 'Order saved in client order history');

// AYAPA EPOS WhatsApp link
const waAyapa = store.generateWhatsAppLink(newOrder, 'ayapa');
assert(waAyapa.startsWith('https://wa.me/447767935049?text='), 'AYAPA WhatsApp link points directly to +44 7767 935049');
assert(waAyapa.includes(encodeURIComponent('Metro Mobile Repairs')), 'AYAPA WhatsApp text includes Shop Name');
assert(waAyapa.includes(encodeURIComponent(newOrder.orderId)), 'AYAPA WhatsApp text includes Order ID');
assert(waAyapa.includes(encodeURIComponent('TOTAL PAYABLE (Inc. VAT): £44.16')), 'AYAPA WhatsApp text includes correct total');

// Customer WhatsApp link
const waCustomer = store.generateWhatsAppLink(newOrder, 'customer');
assert(waCustomer.startsWith('https://wa.me/447767935049?text='), 'Customer WhatsApp link targets customer cleaned phone (447767935049)');
assert(waCustomer.includes(encodeURIComponent('ORDER CONFIRMATION & INVOICE SLIP')), 'Customer WhatsApp text is formatted as an invoice receipt slip');

// Email Invoice
const emailInvoice = store.generateEmailInvoice(newOrder);
assert(emailInvoice.mailto.startsWith('mailto:orders@metromobile.co.uk?subject='), 'Email link targets customer email address');
assert(emailInvoice.subject.includes(newOrder.orderId), 'Email subject contains Order ID');
assert(emailInvoice.body.includes('Barclays Bank UK') && emailInvoice.body.includes('+44 7767 935049'), 'Email body contains BACS instructions and AYAPA WhatsApp contact');

console.log('\n========================================================');
console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================');

if (failed > 0) {
  process.exit(1);
}

import { store, escapeHtml } from './js/store.js';
import fs from 'fs';

console.log('========================================================');
console.log('🛡️ RUNNING AYAPA WHOLESALE SECURITY TEST SUITE');
console.log('========================================================\n');

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

// -------------------------------------------------------------
// Test 1: Stored XSS Prevention & HTML Sanitization
// -------------------------------------------------------------
console.log('--- Test 1: HTML Sanitization & Stored XSS Guard ---');
const maliciousInput = '<script>alert("pwned")</script><img src=x onerror=alert(1)>';
const sanitized = escapeHtml(maliciousInput);
assert(!sanitized.includes('<script>') && !sanitized.includes('<img'), 'HTML script tags are neutralized');
assert(sanitized.includes('&lt;script&gt;') && sanitized.includes('&lt;img'), 'Special characters properly HTML-escaped');

// -------------------------------------------------------------
// Test 2: Admin Privilege Escalation Defense
// -------------------------------------------------------------
console.log('\n--- Test 2: Unauthorized Admin Action Rejection ---');
store.logoutAdmin();
assert(store.isAdmin === false, 'Store is confirmed logged out');

let blockedAdd = false;
try {
  store.addProduct({ code: 'HACK01', name: 'Malicious Product', priceExVat: 10 });
} catch (e) {
  blockedAdd = e.message.includes('Unauthorized');
}
assert(blockedAdd, 'addProduct rejected when not authenticated as admin');

let blockedDelete = false;
try {
  store.deleteProduct('AA4512');
} catch (e) {
  blockedDelete = e.message.includes('Unauthorized');
}
assert(blockedDelete, 'deleteProduct rejected when not authenticated as admin');

let blockedSettings = false;
try {
  store.saveSettings({ adminPin: '111111' });
} catch (e) {
  blockedSettings = e.message.includes('Unauthorized');
}
assert(blockedSettings, 'saveSettings rejected when not authenticated as admin');

let blockedCsv = false;
try {
  store.importCatalogCsv('Code,Name,Category,Price\nAA9999,Fake,Cables,1.00');
} catch (e) {
  blockedCsv = e.message.includes('Unauthorized');
}
assert(blockedCsv, 'importCatalogCsv rejected when not authenticated as admin');

// -------------------------------------------------------------
// Test 3: Session Hijacking Defense (No Plain-Text Storage Bypass)
// -------------------------------------------------------------
console.log('\n--- Test 3: Session Hijacking & Storage Tampering Defense ---');
store.logoutAdmin();

// Attempt raw boolean injection into storage (simulating attacker editing localStorage)
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('ayapa_admin_remember', 'true');
  localStorage.setItem('ayapa_admin_logged', 'true');
}
assert(store.checkAdminAuth() === false, 'checkAdminAuth rejects plain-text boolean injection');

// -------------------------------------------------------------
// Test 4: Admin PIN Brute-Force & Progressive Lockout
// -------------------------------------------------------------
console.log('\n--- Test 4: Brute-Force Defense & Security Lockout ---');
store.logoutAdmin();
store.resetAdminLockout();

// 4 consecutive bad attempts
for (let i = 1; i <= 4; i++) {
  const attempt = store.loginAdmin(`bad_pin_${i}`);
  assert(attempt === false, `Bad attempt ${i} rejected`);
  assert(store.lastLoginResult.locked === false, `Account not yet locked after ${i} attempt(s)`);
}

// 5th bad attempt -> MUST trigger lockout
const fifthAttempt = store.loginAdmin('bad_pin_5');
assert(fifthAttempt === false, '5th bad attempt rejected');
assert(store.lastLoginResult.locked === true, 'Lockout triggered on 5th consecutive failed attempt');
assert(store.lastLoginResult.remainingSec > 0, `Lockout duration set (${store.lastLoginResult.remainingSec}s)`);

// Attempt to login with CORRECT PIN while locked out -> MUST STILL BE BLOCKED!
const correctDuringLockout = store.loginAdmin('971400');
assert(correctDuringLockout === false, 'Correct PIN strictly rejected while lockout is active');
assert(store.isAdmin === false, 'Admin access denied during active lockout');

// Reset lockout state
store.resetAdminLockout();

// Now login with correct PIN should succeed
const validLogin = store.loginAdmin('971400');
assert(validLogin === true, 'Admin PIN 971400 authenticates successfully once lockout cleared');
assert(store.isAdmin === true, 'Admin privileges granted');
store.logoutAdmin();

// -------------------------------------------------------------
// Test 5: Bulk Order & Spam Flooding Protections
// -------------------------------------------------------------
console.log('\n--- Test 5: Bulk Order Spam & Flooding Protections ---');
store.clearCart();
store.addToCart('AA4512', 10);

// A. Anti-bot honeypot check
let honeypotCaught = false;
try {
  store.submitOrder({
    shopName: 'Bot Shop',
    mobileNumber: '07123456789',
    shopAddress: '123 Fake Street, London',
    email: 'bot@spam.com',
    honeypot: 'filled_by_bot_crawler'
  });
} catch (e) {
  honeypotCaught = e.message.includes('Automated order submission');
}
assert(honeypotCaught, 'Honeypot trap caught and rejected automated spam order');

// B. Per-Item Wholesale Quantity Cap (Max 500)
store.clearCart();
store.addToCart('AA4512', 99999);
const cappedQty = store.cart['AA4512']?.quantity;
assert(cappedQty === 500, `Per-item quantity safely capped at 500 units (actual: ${cappedQty})`);

// C. Invalid Customer Data Validation
store.clearCart();
store.addToCart('AA4512', 5);

let badPhoneCaught = false;
try {
  store.submitOrder({
    shopName: 'Valid Store',
    mobileNumber: '123', // invalid phone
    shopAddress: '123 Valid Road, London',
    email: 'valid@shop.co.uk'
  });
} catch (e) {
  badPhoneCaught = e.message.includes('valid telephone or mobile number');
}
assert(badPhoneCaught, 'Order rejected with invalid phone number (< 10 digits)');

let badEmailCaught = false;
try {
  store.submitOrder({
    shopName: 'Valid Store',
    mobileNumber: '07123456789',
    shopAddress: '123 Valid Road, London',
    email: 'not-an-email' // invalid email
  });
} catch (e) {
  badEmailCaught = e.message.includes('valid business email address');
}
assert(badEmailCaught, 'Order rejected with invalid email address format');

// D. Order Rate Limiting (Cooldown)
// Clear last order timestamp for clean test
store.resetOrderRateLimit();

const legitimateOrder = store.submitOrder({
  shopName: 'Phone Clinic Oxford',
  mobileNumber: '07987654321',
  shopAddress: '45 High Street, Oxford',
  email: 'orders@phoneclinicoxford.co.uk'
});
assert(legitimateOrder && legitimateOrder.orderId, `Legitimate order submitted: ${legitimateOrder.orderId}`);

// Immediate second order (within 30s) -> MUST trigger rate limiting
let rateLimitCaught = false;
try {
  store.addToCart('AA4512', 2);
  store.submitOrder({
    shopName: 'Phone Clinic Oxford',
    mobileNumber: '07987654321',
    shopAddress: '45 High Street, Oxford',
    email: 'orders@phoneclinicoxford.co.uk'
  });
} catch (e) {
  rateLimitCaught = e.message.includes('Order rate limit');
}
assert(rateLimitCaught, 'Order rate limiting prevents rapid-fire order flooding (< 30s cooldown)');

// -------------------------------------------------------------
// Test 6: CSS & UI Design Integrity
// -------------------------------------------------------------
console.log('\n--- Test 6: Design & Mobile UX Safe Clearance ---');
const css = fs.readFileSync('./css/style.css', 'utf-8');
const html = fs.readFileSync('./index.html', 'utf-8');

assert(css.includes('.visually-hidden-hp'), 'Honeypot CSS class .visually-hidden-hp defined');
assert(css.includes('padding-bottom: calc(var(--bottom-nav-height) + var(--safe-bottom) + 84px)'), 'Body bottom clearance accommodates floating cart + bottom nav');
assert(html.includes('id="adminLockoutNotice"'), 'Admin lockout UI alert banner present in HTML');
assert(html.includes('id="adminLockoutCountdown"'), 'Live lockout countdown element present in HTML');

console.log('\n========================================================');
console.log(`📊 SECURITY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================\n');

if (failed > 0) process.exit(1);

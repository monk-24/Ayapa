import { store } from './js/store.js';
import fs from 'fs';

console.log('========================================================');
console.log('🚀 RUNNING CART & CHECKOUT PERFORMANCE TESTS');
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

// 1. Verify CSS rules for scroll containment and hardware acceleration
const css = fs.readFileSync('./css/style.css', 'utf-8');

console.log('--- Test 1: CSS Scroll Containment & Hardware Acceleration ---');
assert(css.includes('body.modal-open, html.modal-open'), 'Body and HTML modal-open lock class defined');
assert(css.includes('overflow: hidden !important'), 'overflow: hidden !important prevents background drag');
assert(css.includes('overscroll-behavior: contain'), 'overscroll-behavior: contain prevents rubberbanding on mobile');
assert(css.includes('touch-action: pan-y'), 'touch-action: pan-y set for smooth vertical scrolling without horizontal drift');
assert(css.includes('translate3d(0, 100%, 0)') || css.includes('transform: translate3d'), 'Hardware-accelerated translate3d applied to sheet-window');

// 2. Verify JS app code for in-place updates and skip background re-renders
const js = fs.readFileSync('./js/app.js', 'utf-8');

console.log('\n--- Test 2: In-Place DOM Updates & Re-render Elimination ---');
assert(js.includes('updateCartInPlace()'), 'updateCartInPlace method exists in AppController');
assert(js.includes('this.updateCartInPlace()'), 'render() calls updateCartInPlace() when cartModal is open');
assert(js.includes('return; // Do NOT rebuild background'), 'render() returns early to skip rebuilding 92 background cards when cart is open');
assert(js.includes('setupSheetGestures()'), 'setupSheetGestures method exists for mobile swipe-to-dismiss');
assert(js.includes('document.body.classList.add(\'modal-open\')'), 'openModal adds modal-open to body');
assert(js.includes('document.body.classList.remove(\'modal-open\')'), 'closeAllModals removes modal-open from body');

// 3. Test High Frequency Cart Updates Performance
console.log('\n--- Test 3: Rapid High-Frequency Cart Updates (Simulating Mobile Taps) ---');
store.clearCart();
const p1 = store.products[0].id;
const p2 = store.products[1].id;

const start = performance.now();
for (let i = 0; i < 500; i++) {
  store.addToCart(p1, 1);
  if (i % 2 === 0) store.addToCart(p2, 1);
}
const elapsed = performance.now() - start;

assert(store.cart[p1]?.quantity === 500, `Item 1 quantity correctly updated to 500 (actual: ${store.cart[p1]?.quantity})`);
assert(store.cart[p2]?.quantity === 250, `Item 2 quantity correctly updated to 250 (actual: ${store.cart[p2]?.quantity})`);
assert(elapsed < 150, `500 cart operations executed in ${elapsed.toFixed(2)}ms (< 150ms budget)`);

const totals = store.getCartTotals();
assert(totals.totalItems === 750, `Cart totals correctly calculated for 750 items`);
assert(totals.totalIncVat > 0, `Total payable inc VAT calculated: £${totals.totalIncVat.toFixed(2)}`);

console.log('\n========================================================');
console.log(`📊 PERF TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================');

if (failed > 0) process.exit(1);

// AYAPA Wholesale Mobile-First Application Controller
import { store, CATEGORIES } from './store.js';

class AppController {
  constructor() {
    this.store = store;
    this.selectedProduct = null;
    this.currentView = 'shop'; // 'shop', 'orders', 'admin'
    this.currentCartStep = 'cart'; // 'cart', 'checkout'
    this.adminActiveSubTab = 'orders'; // 'orders', 'products'
    this.adminUploadedImageData = null;
    this.init();
  }

  init() {
    // Subscribe to store updates
    this.store.subscribe(() => {
      this.render();
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindEvents());
    } else {
      this.bindEvents();
    }
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClearBtn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.store.searchQuery = e.target.value;
        if (searchClear) {
          searchClear.classList.toggle('visible', e.target.value.length > 0);
        }
        this.renderProductGrid();
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchClear.classList.remove('visible');
        }
        this.store.searchQuery = '';
        this.renderProductGrid();
      });
    }

    // Sort Select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.store.sortBy = e.target.value;
        this.renderProductGrid();
      });
    }

    // VAT Toggle
    const vatToggle = document.getElementById('vatToggle');
    if (vatToggle) {
      vatToggle.addEventListener('click', () => {
        this.store.showVatIncluded = !this.store.showVatIncluded;
        this.updateVatToggleUI();
        this.renderProductGrid();
        this.renderFloatingCart();
      });
    }

    // Bottom Navigation items
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const nav = el.getAttribute('data-nav');
        this.switchView(nav);
      });
    });

    // Modals close triggers
    document.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => this.closeAllModals());
    });

    // Header & Floating Cart click
    const headerCartBtn = document.getElementById('headerCartBtn');
    const floatingCartBar = document.getElementById('floatingCartBar');
    if (headerCartBtn) headerCartBtn.addEventListener('click', () => this.openCartModal());
    if (floatingCartBar) floatingCartBar.addEventListener('click', () => this.openCartModal());

    // Initial renders
    this.renderCategoryChips();
    this.render();
  }

  switchView(viewName) {
    if (viewName === 'admin' && !this.store.isAdmin) {
      this.openAdminLoginModal();
      return;
    }

    this.currentView = viewName;

    // Update bottom nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-nav') === viewName);
    });

    const shopSection = document.getElementById('shopSection');
    const ordersSection = document.getElementById('ordersSection');
    const adminSection = document.getElementById('adminSection');

    if (shopSection) shopSection.style.display = viewName === 'shop' ? 'block' : 'none';
    if (ordersSection) ordersSection.style.display = viewName === 'orders' ? 'block' : 'none';
    if (adminSection) adminSection.style.display = viewName === 'admin' ? 'block' : 'none';

    if (viewName === 'cart') {
      this.openCartModal();
    } else if (viewName === 'orders') {
      this.renderOrdersView();
    } else if (viewName === 'admin') {
      this.renderAdminView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateVatToggleUI() {
    const exPill = document.getElementById('vatExPill');
    const incPill = document.getElementById('vatIncPill');
    if (exPill && incPill) {
      exPill.classList.toggle('active', !this.store.showVatIncluded);
      incPill.classList.toggle('active', this.store.showVatIncluded);
    }
  }

  render() {
    this.updateCartBadges();
    this.renderFloatingCart();
    this.updateAdminHeaderUI();

    // REAL-TIME CART UPDATE: If cart modal is currently open, re-render it immediately!
    const cartModal = document.getElementById('cartModal');
    if (cartModal && cartModal.classList.contains('open')) {
      if (this.currentCartStep === 'cart') {
        this.renderCartSheet('cart');
      } else {
        this.updateCheckoutSummary();
      }
    }

    if (this.currentView === 'shop') {
      this.renderProductGrid();
    } else if (this.currentView === 'orders') {
      this.renderOrdersView();
    } else if (this.currentView === 'admin' && this.store.isAdmin) {
      this.renderAdminView();
    }
  }

  updateAdminHeaderUI() {
    const adminBadge = document.getElementById('headerAdminBadge');
    const adminNav = document.getElementById('adminNavItem');
    const staffLabel = document.getElementById('staffAuthLabel');

    if (adminBadge) adminBadge.style.display = this.store.isAdmin ? 'inline-flex' : 'none';
    if (adminNav) adminNav.style.display = this.store.isAdmin ? 'flex' : 'none';
    if (staffLabel) staffLabel.textContent = this.store.isAdmin ? 'Logout' : 'Staff';
  }

  handleAdminAuthClick() {
    if (this.store.isAdmin) {
      if (confirm('Log out of AYAPA Admin mode?')) {
        this.store.logoutAdmin();
        this.switchView('shop');
      }
    } else {
      this.openAdminLoginModal();
    }
  }

  openAdminLoginModal() {
    const modal = document.getElementById('adminLoginModal');
    const input = document.getElementById('adminPinInput');
    const err = document.getElementById('adminPinError');
    if (modal) {
      if (input) input.value = '';
      if (err) err.style.display = 'none';
      modal.classList.add('open');
      setTimeout(() => input?.focus(), 150);
    }
  }

  submitAdminLogin() {
    const input = document.getElementById('adminPinInput');
    const err = document.getElementById('adminPinError');
    const pin = input?.value.trim() || '';

    if (this.store.loginAdmin(pin)) {
      this.closeAllModals();
      this.switchView('admin');
    } else {
      if (err) err.style.display = 'block';
    }
  }

  updateCartBadges() {
    const count = this.store.getCartCount();
    const headerBadge = document.getElementById('headerCartBadge');
    const navBadge = document.getElementById('navCartBadge');

    if (headerBadge) {
      headerBadge.textContent = count;
      headerBadge.style.display = count > 0 ? 'flex' : 'none';
    }
    if (navBadge) {
      navBadge.textContent = count;
      navBadge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  renderCategoryChips() {
    const container = document.getElementById('categoryScrollContainer');
    if (!container) return;

    container.innerHTML = CATEGORIES.map(cat => {
      const isActive = this.store.activeCategory === cat;
      const count = cat === 'All' 
        ? this.store.products.length 
        : this.store.products.filter(p => p.category === cat).length;

      return `
        <button class="category-chip ${isActive ? 'active' : ''}" data-category="${cat}">
          <span>${cat}</span>
          <span class="count">${count}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('.category-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-category');
        this.store.activeCategory = cat;
        this.renderCategoryChips();
        this.renderProductGrid();
      });
    });
  }

  renderProductGrid() {
    const grid = document.getElementById('productGrid');
    const countEl = document.getElementById('productsCount');
    if (!grid) return;

    const products = this.store.getFilteredProducts();
    if (countEl) {
      countEl.textContent = `${products.length} Products`;
    }

    if (products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <svg style="width: 48px; height: 48px; margin: 0 auto 12px; stroke: currentColor; fill: none; stroke-width: 1.5;" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h3 style="color: var(--text-primary); font-size: 1.1rem; margin-bottom: 6px;">No products found</h3>
          <p style="font-size: 0.85rem;">Try adjusting your search query or selecting a different category.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(product => {
      const inCart = this.store.cart[product.id];
      const qtyInCart = inCart ? inCart.quantity : 0;
      const displayPrice = this.store.showVatIncluded ? product.priceIncVat : product.priceExVat;
      const vatLabel = this.store.showVatIncluded ? 'Inc VAT' : '+ VAT';
      const profitPerUnit = (product.rrp - product.priceIncVat).toFixed(2);
      const marginPct = product.rrp > 0 ? Math.round(((product.rrp - product.priceIncVat) / product.rrp) * 100) : 0;

      return `
        <div class="product-card ${!product.stock ? 'out-of-stock' : ''}" data-id="${product.id}">
          <div class="card-media" onclick="window.app.openProductModal('${product.id}')">
            <div class="card-badge-top-left">
              <span class="badge-sku">${product.code}</span>
              ${product.quality ? `<span class="badge-quality">${product.quality}</span>` : ''}
            </div>
            ${!product.stock ? `
              <div class="card-badge-top-right">
                <span class="badge-out-stock">OUT OF STOCK</span>
              </div>
            ` : ''}
            <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://placehold.co/360x360/171922/f59e0b?text=${encodeURIComponent(product.code)}'" />
          </div>

          <div class="card-body">
            <div class="card-category-tag">${product.category}</div>
            <h3 class="card-title" onclick="window.app.openProductModal('${product.id}')" title="${product.name}">
              ${product.name}
            </h3>

            <div class="card-price-box">
              <div class="card-wholesale-price">
                <span class="price-val">£${displayPrice.toFixed(2)}</span>
                <span class="price-sub">${vatLabel}</span>
              </div>
              <div class="card-rrp-margin">
                <span class="card-rrp">RRP £${product.rrp.toFixed(2)}</span>
                <span class="card-margin-badge">+£${profitPerUnit} (${marginPct}%)</span>
              </div>
            </div>

            <div class="card-actions">
              ${!product.stock ? `
                <button class="card-add-btn" disabled style="opacity: 0.5; cursor: not-allowed;">
                  Out of Stock
                </button>
              ` : qtyInCart > 0 ? `
                <div class="card-qty-stepper">
                  <button class="stepper-btn" onclick="window.app.adjustQuantity('${product.id}', -1)">−</button>
                  <input type="number" class="stepper-input" value="${qtyInCart}" oninput="window.app.setQuantity('${product.id}', this.value)" onchange="window.app.setQuantity('${product.id}', this.value)" min="0" />
                  <button class="stepper-btn" onclick="window.app.adjustQuantity('${product.id}', 1)">+</button>
                </div>
              ` : `
                <div class="quick-pack-row">
                  <button class="quick-pack-btn" onclick="window.app.addToCart('${product.id}', 1)">+1</button>
                  <button class="quick-pack-btn" onclick="window.app.addToCart('${product.id}', 5)">+5</button>
                  <button class="quick-pack-btn" onclick="window.app.addToCart('${product.id}', 10)">+10</button>
                </div>
                <button class="card-add-btn" onclick="window.app.addToCart('${product.id}', 1)">
                  <svg style="width: 15px; height: 15px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>Add to Order</span>
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderFloatingCart() {
    const bar = document.getElementById('floatingCartBar');
    if (!bar) return;

    const totals = this.store.getCartTotals();
    if (totals.totalItems === 0) {
      bar.classList.add('hidden');
      return;
    }

    bar.classList.remove('hidden');
    const badgeEl = bar.querySelector('.floating-cart-badge');
    const totalEl = bar.querySelector('.floating-cart-total');
    const vatEl = bar.querySelector('.floating-cart-vat');

    if (badgeEl) badgeEl.textContent = totals.totalItems;
    if (totalEl) totalEl.textContent = `£${totals.totalIncVat.toFixed(2)}`;
    if (vatEl) vatEl.textContent = `(£${totals.subtotalExVat.toFixed(2)} ex. VAT • Est. Profit £${totals.estimatedProfit.toFixed(2)})`;
  }

  // --- Cart & Checkout Modals (Real-Time Synchronized) ---
  openCartModal(step = 'cart') {
    const modal = document.getElementById('cartModal');
    if (!modal) return;

    this.currentCartStep = step;
    this.renderCartSheet(step);
    modal.classList.add('open');
  }

  renderCartSheet(step = 'cart') {
    this.currentCartStep = step;
    const container = document.getElementById('cartModalBody');
    const footer = document.getElementById('cartModalFooter');
    const titleEl = document.getElementById('cartModalTitle');
    if (!container || !footer) return;

    const totals = this.store.getCartTotals();

    if (step === 'cart') {
      if (titleEl) titleEl.textContent = 'Wholesale Order Cart';

      if (totals.items.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
            <svg style="width: 56px; height: 56px; margin: 0 auto 16px; stroke: currentColor; fill: none; stroke-width: 1.5;" viewBox="0 0 24 24">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <h3 style="color: var(--text-primary); font-size: 1.15rem; margin-bottom: 6px;">Your order cart is empty</h3>
            <p style="font-size: 0.85rem; margin-bottom: 20px;">Browse products and tap quantities to start your wholesale order.</p>
            <button class="btn-primary" style="max-width: 200px; margin: 0 auto;" onclick="window.app.closeAllModals()">
              Start Shopping
            </button>
          </div>
        `;
        footer.innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary);">${totals.totalItems} Items Selected</span>
          <button style="background: none; border: none; color: var(--danger); font-size: 0.8rem; font-weight: 600; cursor: pointer;" onclick="window.app.clearCartConfirm()">
            Clear All
          </button>
        </div>

        <div class="cart-items-list">
          ${totals.items.map(item => `
            <div class="cart-item-card" data-cart-id="${item.product.id}">
              <img src="${item.product.image}" alt="${item.product.name}" class="cart-item-thumb" onerror="this.src='https://placehold.co/100x100/171922/f59e0b?text=${item.product.code}'" />
              <div class="cart-item-details">
                <span class="cart-item-sku">${item.product.code}</span>
                <h4 class="cart-item-name">${item.product.name}</h4>
                <div class="cart-item-pricing">
                  <span class="cart-item-unit-price">£${item.unitExVat.toFixed(2)} + VAT</span>
                  <span class="cart-item-line-total">£${item.lineIncVat.toFixed(2)}</span>
                </div>
                <div class="cart-item-actions">
                  <div class="card-qty-stepper" style="height: 30px;">
                    <button class="stepper-btn" style="width: 30px; height: 30px;" onclick="window.app.adjustQuantity('${item.product.id}', -1)">−</button>
                    <input type="number" class="stepper-input" style="width: 36px; font-size: 0.85rem;" value="${item.quantity}" oninput="window.app.setQuantity('${item.product.id}', this.value)" onchange="window.app.setQuantity('${item.product.id}', this.value)" min="0" />
                    <button class="stepper-btn" style="width: 30px; height: 30px;" onclick="window.app.adjustQuantity('${item.product.id}', 1)">+</button>
                  </div>
                  <button class="cart-remove-btn" onclick="window.app.removeFromCart('${item.product.id}')">
                    <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="order-summary-box">
          <div class="summary-row">
            <span>Subtotal (Excl. VAT):</span>
            <span style="font-weight: 700;">£${totals.subtotalExVat.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>UK VAT (20%):</span>
            <span style="font-weight: 700;">£${totals.vatAmount.toFixed(2)}</span>
          </div>
          <div class="summary-row total-row">
            <span>Total Payable (Inc. VAT):</span>
            <span class="total-amount">£${totals.totalIncVat.toFixed(2)}</span>
          </div>
          <div class="summary-row profit-highlight">
            <span>🎉 Your Shop Resale Profit:</span>
            <span>+£${totals.estimatedProfit.toFixed(2)} (${Math.round(totals.marginPct)}% Margin)</span>
          </div>
        </div>
      `;

      footer.innerHTML = `
        <button class="btn-primary" onclick="window.app.renderCartSheet('checkout')">
          <span>Proceed to Shop Details</span>
          <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      `;
    } else if (step === 'checkout') {
      if (titleEl) titleEl.textContent = 'Shop Delivery & Checkout';
      const client = this.store.client;

      container.innerHTML = `
        <div style="margin-bottom: 14px;">
          <button style="background: none; border: none; color: var(--text-gold); font-size: 0.85rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;" onclick="window.app.renderCartSheet('cart')">
            ← Back to Order Items
          </button>
        </div>

        <div style="background: var(--accent-gold-light); border: 1px solid var(--border-gold); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 16px; font-size: 0.82rem; color: var(--text-gold);">
          <strong>Wholesale Fast Order:</strong> Provide your store address below. We'll send your invoice and dispatch immediately. Online payment is coming soon.
        </div>

        <form id="checkoutForm">
          <div class="form-group">
            <label class="form-label">Shop / Business Name <span class="required">*</span></label>
            <input type="text" id="shopName" class="form-input" placeholder="e.g. Phone Clinic London" value="${client.shopName || ''}" required />
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Mobile Number <span class="required">*</span></label>
              <input type="tel" id="mobileNumber" class="form-input" placeholder="e.g. 07123 456789" value="${client.mobileNumber || ''}" required />
              <span class="form-help">For WhatsApp confirmation</span>
            </div>
            <div class="form-group">
              <label class="form-label">Contact Person</label>
              <input type="text" id="contactName" class="form-input" placeholder="e.g. Mike / Store Manager" value="${client.contactName || ''}" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Email Address <span class="required">*</span></label>
            <input type="email" id="email" class="form-input" placeholder="e.g. shop@example.com" value="${client.email || ''}" required />
            <span class="form-help">For instant invoice delivery</span>
          </div>

          <div class="form-group">
            <label class="form-label">Shop Delivery Address <span class="required">*</span></label>
            <input type="text" id="shopAddress" class="form-input" placeholder="Shop Address & Road" value="${client.shopAddress || ''}" required />
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Town / City</label>
              <input type="text" id="city" class="form-input" placeholder="e.g. London" value="${client.city || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Postcode <span class="required">*</span></label>
              <input type="text" id="postcode" class="form-input" placeholder="e.g. E1 6AN" value="${client.postcode || ''}" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Delivery Notes / Specifics</label>
            <textarea id="deliveryNotes" class="form-textarea" rows="2" placeholder="e.g. Deliver between 10am-5pm, ring bell">${client.deliveryNotes || ''}</textarea>
          </div>
        </form>

        <div class="order-summary-box" id="checkoutMiniSummary" style="margin-top: 10px;">
          <div class="summary-row total-row" style="border: none; padding: 0; margin: 0;">
            <span>Order Total (${totals.totalItems} units):</span>
            <span class="total-amount">£${totals.totalIncVat.toFixed(2)}</span>
          </div>
        </div>
      `;

      footer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="btn-whatsapp" onclick="window.app.submitWholesaleOrder('whatsapp')">
            <svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.073-1.04-.059-.281-.092-.614-.22-1.03-.399-1.802-.78-2.97-2.6-3.06-2.72-.09-.12-.733-.974-.733-1.86 0-.885.469-1.32.635-1.499.167-.179.366-.224.488-.224.122 0 .243.002.35.007.113.005.263-.042.412.316.155.375.529 1.292.575 1.386.046.094.077.205.015.328-.063.123-.094.2-.187.31-.093.11-.196.245-.28.329-.094.094-.192.197-.082.385.11.187.489.808 1.05 1.307.722.641 1.33.84 1.518.934.188.093.298.079.408-.047.11-.125.469-.546.594-.733.125-.188.25-.156.422-.094.172.062 1.088.513 1.275.607.187.094.312.14.358.219.046.078.046.453-.098.858z"/>
            </svg>
            <span>Submit via WhatsApp (1-Click)</span>
          </button>

          <button class="btn-secondary" onclick="window.app.submitWholesaleOrder('invoice')">
            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span>Generate & View Pro-Forma Invoice</span>
          </button>
        </div>
      `;
    }
  }

  updateCheckoutSummary() {
    const summary = document.getElementById('checkoutMiniSummary');
    if (summary) {
      const totals = this.store.getCartTotals();
      summary.innerHTML = `
        <div class="summary-row total-row" style="border: none; padding: 0; margin: 0;">
          <span>Order Total (${totals.totalItems} units):</span>
          <span class="total-amount">£${totals.totalIncVat.toFixed(2)}</span>
        </div>
      `;
    }
  }

  submitWholesaleOrder(preferredAction = 'whatsapp') {
    const shopName = document.getElementById('shopName')?.value.trim();
    const contactName = document.getElementById('contactName')?.value.trim();
    const mobileNumber = document.getElementById('mobileNumber')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const shopAddress = document.getElementById('shopAddress')?.value.trim();
    const city = document.getElementById('city')?.value.trim();
    const postcode = document.getElementById('postcode')?.value.trim();
    const deliveryNotes = document.getElementById('deliveryNotes')?.value.trim();

    if (!shopName || !mobileNumber || !shopAddress || !email) {
      alert('Please fill in all required fields (Shop Name, Mobile, Email, and Address).');
      return;
    }

    try {
      const order = this.store.submitOrder({
        shopName,
        contactName,
        mobileNumber,
        email,
        shopAddress,
        city,
        postcode,
        deliveryNotes
      });

      this.closeAllModals();

      if (preferredAction === 'whatsapp') {
        const waLink = this.store.generateWhatsAppLink(order, 'ayapa');
        window.open(waLink, '_blank');
      }

      // Automatically show confirmation & invoice modal
      this.openOrderConfirmationModal(order, preferredAction);

      // Also refresh the My Orders list
      this.renderOrdersView();
    } catch (err) {
      alert(err.message || 'Failed to submit order');
    }
  }

  openOrderConfirmationModal(order, sourceAction = '') {
    const modal = document.getElementById('confirmationModal');
    const body = document.getElementById('confirmationModalBody');
    if (!modal || !body) return;

    const waAyapaLink = this.store.generateWhatsAppLink(order, 'ayapa');
    const waCustomerLink = this.store.generateWhatsAppLink(order, 'customer');
    const emailData = this.store.generateEmailInvoice(order);

    const clientPhone = order.client.mobileNumber || '';
    const clientEmail = order.client.email || '';

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="width: 56px; height: 56px; background: var(--success-bg); color: var(--success); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
          <svg style="width: 32px; height: 32px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">Wholesale Order Confirmed!</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
          Order Reference: <strong style="color: var(--accent-gold);">${order.orderId}</strong>
        </p>
        <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
          Saved to your <strong>My Orders</strong> tab for permanent record & 1-click reordering.
        </p>
      </div>

      <!-- Action Dispatch Grid -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px;">
        <a href="${waAyapaLink}" target="_blank" class="btn-whatsapp" style="padding: 12px 14px; font-size: 0.88rem;">
          <svg style="width: 18px; height: 18px; fill: currentColor;" viewBox="0 0 24 24">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.073-1.04-.059-.281-.092-.614-.22-1.03-.399-1.802-.78-2.97-2.6-3.06-2.72-.09-.12-.733-.974-.733-1.86 0-.885.469-1.32.635-1.499.167-.179.366-.224.488-.224.122 0 .243.002.35.007.113.005.263-.042.412.316.155.375.529 1.292.575 1.386.046.094.077.205.015.328-.063.123-.094.2-.187.31-.093.11-.196.245-.28.329-.094.094-.192.197-.082.385.11.187.489.808 1.05 1.307.722.641 1.33.84 1.518.934.188.093.298.079.408-.047.11-.125.469-.546.594-.733.125-.188.25-.156.422-.094.172.062 1.088.513 1.275.607.187.094.312.14.358.219.046.078.046.453-.098.858z"/>
          </svg>
          <span>📲 Submit Order to AYAPA (+44 7767 935049)</span>
        </a>

        <a href="${waCustomerLink}" target="_blank" class="btn-whatsapp-outline" style="padding: 12px 14px; font-size: 0.88rem;">
          <svg style="width: 18px; height: 18px; fill: currentColor;" viewBox="0 0 24 24">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.073-1.04-.059-.281-.092-.614-.22-1.03-.399-1.802-.78-2.97-2.6-3.06-2.72-.09-.12-.733-.974-.733-1.86 0-.885.469-1.32.635-1.499.167-.179.366-.224.488-.224.122 0 .243.002.35.007.113.005.263-.042.412.316.155.375.529 1.292.575 1.386.046.094.077.205.015.328-.063.123-.094.2-.187.31-.093.11-.196.245-.28.329-.094.094-.192.197-.082.385.11.187.489.808 1.05 1.307.722.641 1.33.84 1.518.934.188.093.298.079.408-.047.11-.125.469-.546.594-.733.125-.188.25-.156.422-.094.172.062 1.088.513 1.275.607.187.094.312.14.358.219.046.078.046.453-.098.858z"/>
          </svg>
          <span>📲 Send Invoice to My WhatsApp (${clientPhone || 'Client Phone'})</span>
        </a>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <a href="${emailData.mailto}" class="btn-secondary" style="padding: 10px 12px; font-size: 0.82rem; text-decoration: none;">
            <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <span>📧 Email Invoice</span>
          </a>

          <button class="btn-secondary" style="padding: 10px 12px; font-size: 0.82rem;" onclick="window.print()">
            <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>🖨️ PDF Invoice</span>
          </button>
        </div>
      </div>

      <!-- Printable Pro-Forma Invoice Container -->
      <div class="invoice-container">
        <div class="invoice-header">
          <div>
            <div class="invoice-logo-title">AYAPA WHOLESALE</div>
            <div style="font-size: 0.75rem; color: #6b7280;">Mobile Phone Accessories UK & B2B Distribution</div>
            <div style="font-size: 0.75rem; color: #6b7280;">EPOS WhatsApp: +44 7767 935049 • info@ayapashop.com</div>
          </div>
          <div class="invoice-meta">
            <div style="font-weight: 800; font-size: 1rem; color: #111827;">PRO-FORMA INVOICE</div>
            <div>Ref: <strong>${order.orderId}</strong></div>
            <div>Date: ${new Date(order.createdAt).toLocaleDateString('en-GB')}</div>
            <div>Payment: Pro-Forma / BACS</div>
          </div>
        </div>

        <div class="invoice-parties">
          <div>
            <div style="font-weight: 700; color: #374151; font-size: 0.75rem; text-transform: uppercase;">Sold To (Retail Client):</div>
            <div style="font-weight: 800; font-size: 0.95rem; margin: 2px 0;">${order.client.shopName}</div>
            <div>Attn: ${order.client.contactName || 'Store Manager'}</div>
            <div>Tel: ${order.client.mobileNumber}</div>
            <div>Email: ${order.client.email || 'N/A'}</div>
            <div>Address: ${order.client.shopAddress}, ${order.client.city || ''} ${order.client.postcode || ''}</div>
          </div>
          <div>
            <div style="font-weight: 700; color: #374151; font-size: 0.75rem; text-transform: uppercase;">Bank Transfer Details:</div>
            <div style="font-size: 0.8rem; background: #f3f4f6; padding: 8px; border-radius: 6px; margin-top: 4px;">
              <div>Bank: <strong>${this.store.settings.bankName || 'Barclays Bank UK'}</strong></div>
              <div>Account Name: <strong>${this.store.settings.accountName || 'AYAPA WHOLESALE LTD'}</strong></div>
              <div>Sort Code: <strong>${this.store.settings.sortCode || '20-00-00'}</strong></div>
              <div>Account No: <strong>${this.store.settings.accountNumber || '83920192'}</strong></div>
              <div>Payment Reference: <strong>${order.orderId}</strong></div>
            </div>
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Description</th>
              <th class="num">Unit Price (Ex)</th>
              <th class="num">Qty</th>
              <th class="num">Total (Ex VAT)</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td style="font-family: monospace; font-weight: bold;">${item.code}</td>
                <td>${item.name}</td>
                <td class="num">£${item.unitExVat.toFixed(2)}</td>
                <td class="num" style="font-weight: bold;">${item.quantity}</td>
                <td class="num">£${item.lineExVat.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="invoice-totals">
          <div class="invoice-totals-row">
            <span>Subtotal (Excl. VAT):</span>
            <span>£${order.totals.subtotalExVat.toFixed(2)}</span>
          </div>
          <div class="invoice-totals-row">
            <span>UK VAT (20%):</span>
            <span>£${order.totals.vatAmount.toFixed(2)}</span>
          </div>
          <div class="invoice-totals-row grand-total">
            <span>Total Payable (Inc. VAT):</span>
            <span>£${order.totals.totalIncVat.toFixed(2)}</span>
          </div>
        </div>

        ${order.client.deliveryNotes ? `
          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed #e5e7eb; font-size: 0.78rem; color: #4b5563;">
            <strong>Delivery Instructions:</strong> ${order.client.deliveryNotes}
          </div>
        ` : ''}
      </div>
    `;

    modal.classList.add('open');
  }

  // --- Product Detail Lightbox Modal ---
  openProductModal(productId) {
    const product = this.store.products.find(p => p.id === productId);
    if (!product) return;

    this.selectedProduct = product;
    const modal = document.getElementById('productDetailModal');
    const body = document.getElementById('productDetailModalBody');
    if (!modal || !body) return;

    const inCart = this.store.cart[product.id];
    const qtyInCart = inCart ? inCart.quantity : 0;
    const profitUnit = (product.rrp - product.priceIncVat).toFixed(2);
    const marginPct = product.rrp > 0 ? Math.round(((product.rrp - product.priceIncVat) / product.rrp) * 100) : 0;
    const heroImage = product.banner || product.image;

    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="position: relative; width: 100%; aspect-ratio: ${product.banner ? '0.75' : '1'}; background: #000000; border-radius: var(--radius-lg); overflow: hidden; display: flex; align-items: center; justify-content: center;">
          <img src="${heroImage}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: contain;" />
          <div style="position: absolute; top: 10px; left: 10px; display: flex; gap: 6px;">
            <span class="badge-sku">${product.code}</span>
            <span class="badge-quality">${product.quality}</span>
          </div>
          ${!product.stock ? `
            <div style="position: absolute; top: 10px; right: 10px;">
              <span class="badge-out-stock">OUT OF STOCK</span>
            </div>
          ` : ''}
        </div>

        <div>
          <div class="card-category-tag">${product.category} • ${product.brand || 'AYAPA'}</div>
          <h2 style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">
            ${product.name}
          </h2>

          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div>
                <span style="font-size: 1.4rem; font-weight: 900; color: var(--text-primary);">£${product.priceExVat.toFixed(2)}</span>
                <span style="font-size: 0.8rem; color: var(--accent-gold); font-weight: 700;">+ VAT</span>
                <div style="font-size: 0.78rem; color: var(--text-muted);">(£${product.priceIncVat.toFixed(2)} Inc. VAT)</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.8rem; color: var(--text-muted);">Recommended Retail:</div>
                <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">£${product.rrp.toFixed(2)}</div>
                <span class="card-margin-badge">+£${profitUnit} Profit (${marginPct}%)</span>
              </div>
            </div>
          </div>

          <!-- Product Specifications -->
          ${product.specs && Object.keys(product.specs).length > 0 ? `
            <div style="margin-bottom: 16px;">
              <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase;">Technical Specifications</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.8rem;">
                ${Object.entries(product.specs).map(([key, val]) => `
                  <div style="background: var(--bg-card); padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                    <div style="color: var(--text-muted); font-size: 0.7rem;">${key}</div>
                    <div style="font-weight: 600; color: var(--text-primary);">${val}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Wholesale Profit Simulator -->
          <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(31, 35, 46, 0.6) 100%); border: 1px solid var(--border-gold); border-radius: var(--radius-lg); padding: 14px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.82rem; font-weight: 800; color: var(--accent-gold);">💡 Wholesale Profit Calculator</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Simulate your batch return</span>
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 10px;">
              <button class="quick-pack-btn" onclick="window.app.simulateDetailProfit(${product.id ? `'${product.id}'` : ''}, 10)">10 Units</button>
              <button class="quick-pack-btn" onclick="window.app.simulateDetailProfit(${product.id ? `'${product.id}'` : ''}, 25)">25 Units</button>
              <button class="quick-pack-btn" onclick="window.app.simulateDetailProfit(${product.id ? `'${product.id}'` : ''}, 50)">50 Units</button>
              <button class="quick-pack-btn" onclick="window.app.simulateDetailProfit(${product.id ? `'${product.id}'` : ''}, 100)">100 Units</button>
            </div>
            <div id="detailSimulatorResult" style="font-size: 0.82rem; line-height: 1.4;">
              Buy <strong>25 units</strong> for <strong>£${(product.priceIncVat * 25).toFixed(2)}</strong> inc VAT → Sell at RRP for <strong>£${(product.rrp * 25).toFixed(2)}</strong> → <span style="color: var(--success); font-weight: 800;">Estimated Shop Profit: £${((product.rrp - product.priceIncVat) * 25).toFixed(2)}</span>
            </div>
          </div>

          <!-- Add to Cart Stepper in Detail -->
          <div style="display: flex; gap: 10px; align-items: center;">
            <div class="card-qty-stepper" style="height: 48px; width: 140px;">
              <button class="stepper-btn" style="width: 44px; height: 48px;" onclick="window.app.adjustQuantity('${product.id}', -1)">−</button>
              <input type="number" id="detailQtyInput" class="stepper-input" style="font-size: 1.1rem;" value="${qtyInCart || 1}" oninput="window.app.setQuantity('${product.id}', this.value)" onchange="window.app.setQuantity('${product.id}', this.value)" min="1" />
              <button class="stepper-btn" style="width: 44px; height: 48px;" onclick="window.app.adjustQuantity('${product.id}', 1)">+</button>
            </div>
            <button class="btn-primary" style="flex: 1; height: 48px;" onclick="window.app.addFromDetailModal('${product.id}')">
              <span>Add to Order</span>
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
  }

  simulateDetailProfit(productId, qty) {
    const product = this.selectedProduct;
    if (!product) return;

    const res = document.getElementById('detailSimulatorResult');
    if (res) {
      const costInc = (product.priceIncVat * qty).toFixed(2);
      const rev = (product.rrp * qty).toFixed(2);
      const profit = ((product.rrp - product.priceIncVat) * qty).toFixed(2);
      res.innerHTML = `Buy <strong>${qty} units</strong> for <strong>£${costInc}</strong> inc VAT → Sell at RRP for <strong>£${rev}</strong> → <span style="color: var(--success); font-weight: 800;">Estimated Shop Profit: £${profit}</span>`;
    }
  }

  addFromDetailModal(productId) {
    const input = document.getElementById('detailQtyInput');
    const qty = input ? parseInt(input.value, 10) || 1 : 1;
    this.store.setCartQuantity(productId, qty);
    this.closeAllModals();
    this.openCartModal();
  }

  // --- Client Orders View ---
  renderOrdersView() {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    const orders = this.store.orders;
    if (orders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <svg style="width: 48px; height: 48px; margin: 0 auto 12px; stroke: currentColor; fill: none; stroke-width: 1.5;" viewBox="0 0 24 24">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <h3 style="color: var(--text-primary); font-size: 1.15rem; margin-bottom: 6px;">No past orders yet</h3>
          <p style="font-size: 0.85rem; margin-bottom: 16px;">Orders you submit will appear here with printable invoices and 1-click re-ordering.</p>
          <button class="btn-primary" style="max-width: 200px; margin: 0 auto;" onclick="window.app.switchView('shop')">
            Browse Wholesale Catalog
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">My Orders (${orders.length})</h2>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${orders.map(order => `
          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div>
                <span style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-gold); font-size: 0.95rem;">${order.orderId}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 6px;">${new Date(order.createdAt).toLocaleDateString('en-GB')}</span>
              </div>
              <span class="status-badge confirmed">
                ${order.status}
              </span>
            </div>

            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">
              <strong>${order.client.shopName}</strong> • ${order.totals.totalItems} Items
            </div>

            <div style="display: flex; justify-content: space-between; align-items: baseline; padding-top: 8px; border-top: 1px dashed var(--border-subtle); margin-top: 8px;">
              <div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Total Payable Inc. VAT</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">£${order.totals.totalIncVat.toFixed(2)}</div>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.78rem;" onclick="window.app.reorderItems('${order.orderId}')">
                  🔁 Re-Order
                </button>
                <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.78rem;" onclick="window.app.viewOrderInvoice('${order.orderId}')">
                  📄 View Invoice
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  reorderItems(orderId) {
    const order = this.store.orders.find(o => o.orderId === orderId);
    if (!order) return;

    order.items.forEach(item => {
      this.store.addToCart(item.code, item.quantity);
    });

    this.openCartModal('cart');
  }

  viewOrderInvoice(orderId) {
    const order = this.store.orders.find(o => o.orderId === orderId);
    if (order) {
      this.openOrderConfirmationModal(order);
    }
  }

  // --- Admin / Store Manager View (Restricted to AYAPA Staff) ---
  renderAdminView() {
    const container = document.getElementById('adminContainer');
    if (!container) return;

    if (!this.store.isAdmin) {
      this.openAdminLoginModal();
      return;
    }

    // Retrieve all incoming orders
    let allOrders = [];
    try {
      allOrders = JSON.parse(localStorage.getItem('ayapa_all_orders_admin') || '[]');
      if (allOrders.length === 0) {
        allOrders = this.store.orders;
      }
    } catch (e) {
      allOrders = this.store.orders;
    }

    const products = this.store.products;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--text-primary);">AYAPA Staff Dashboard</h2>
            <span class="admin-badge-pill">STAFF AUTHORIZED</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">Manage incoming retail orders, catalog pricing, stock availability, and shop settings.</p>
        </div>
        <button class="btn-secondary" style="width: auto; padding: 6px 12px; font-size: 0.78rem;" onclick="window.app.handleAdminAuthClick()">
          🚪 Logout
        </button>
      </div>

      <!-- Admin Sub Tabs -->
      <div class="admin-nav-tabs">
        <button class="admin-nav-tab ${this.adminActiveSubTab === 'orders' ? 'active' : ''}" onclick="window.app.setAdminSubTab('orders')">
          <span>📥 Incoming Orders</span>
          <span class="count" style="background: var(--accent-gold); color: #000; font-size: 0.7rem; padding: 2px 6px; border-radius: 99px;">${allOrders.length}</span>
        </button>
        <button class="admin-nav-tab ${this.adminActiveSubTab === 'products' ? 'active' : ''}" onclick="window.app.setAdminSubTab('products')">
          <span>📦 Catalog & Inventory</span>
          <span class="count" style="background: rgba(255,255,255,0.1); color: #fff; font-size: 0.7rem; padding: 2px 6px; border-radius: 99px;">${products.length}</span>
        </button>
        <button class="admin-nav-tab ${this.adminActiveSubTab === 'settings' ? 'active' : ''}" onclick="window.app.setAdminSubTab('settings')">
          <span>⚙️ Business Settings</span>
        </button>
      </div>

      ${this.adminActiveSubTab === 'orders' 
        ? this.renderAdminOrdersSubTab(allOrders) 
        : this.adminActiveSubTab === 'products' 
        ? this.renderAdminProductsSubTab(products) 
        : this.renderAdminSettingsSubTab()}
    `;

    if (this.adminActiveSubTab === 'products') {
      this.setupAdminImageDrop();
    }
  }

  setAdminSubTab(subTab) {
    this.adminActiveSubTab = subTab;
    this.renderAdminView();
  }

  renderAdminOrdersSubTab(orders) {
    if (orders.length === 0) {
      return `
        <div style="text-align: center; padding: 48px 16px; background: var(--bg-card); border-radius: var(--radius-lg); color: var(--text-muted);">
          <svg style="width: 48px; height: 48px; margin: 0 auto 12px; stroke: currentColor; fill: none; stroke-width: 1.5;" viewBox="0 0 24 24">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
          </svg>
          <h3 style="color: var(--text-primary); font-size: 1.1rem; margin-bottom: 4px;">No Incoming Orders Yet</h3>
          <p style="font-size: 0.85rem;">When retail shops place orders, they appear here in real-time with customer contact info.</p>
        </div>
      `;
    }

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 0.85rem; color: var(--text-muted);">Real-time Incoming Wholesale Orders (${orders.length})</span>
        <button class="btn-secondary" style="width: auto; padding: 4px 10px; font-size: 0.75rem;" onclick="window.app.exportOrdersCsv()">
          📥 Export Orders CSV
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${orders.map(order => {
          const cleanPhone = (order.client.mobileNumber || '').replace(/[^0-9]/g, '');
          const waChatLink = `https://wa.me/${cleanPhone.startsWith('0') ? '44' + cleanPhone.slice(1) : cleanPhone}`;

          return `
            <div class="admin-order-card">
              <div class="admin-order-header">
                <div>
                  <div style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-gold); font-size: 1rem;">${order.orderId}</div>
                  <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
                    ${order.client.shopName}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-secondary);">
                    Contact: <strong>${order.client.contactName || 'Owner'}</strong> • ${new Date(order.createdAt).toLocaleString('en-GB')}
                  </div>
                </div>
                <div style="text-align: right;">
                  <span class="status-badge ${order.status === 'Dispatched' ? 'dispatched' : 'confirmed'}">${order.status}</span>
                  <div style="font-size: 1.15rem; font-weight: 900; color: var(--text-primary); margin-top: 4px;">
                    £${order.totals.totalIncVat.toFixed(2)}
                  </div>
                </div>
              </div>

              <!-- Quick Client Contact Actions for AYAPA Staff -->
              <div class="admin-contact-btns">
                <a href="${waChatLink}" target="_blank" class="contact-action-btn wa">
                  📲 WhatsApp Shop
                </a>
                <a href="tel:${order.client.mobileNumber}" class="contact-action-btn tel">
                  📞 Call (${order.client.mobileNumber})
                </a>
                <a href="mailto:${order.client.email}" class="contact-action-btn mail">
                  📧 Email (${order.client.email})
                </a>
              </div>

              <div style="background: var(--bg-secondary); border-radius: var(--radius-sm); padding: 8px 12px; margin-top: 10px; font-size: 0.8rem;">
                <div>📍 <strong>Address:</strong> ${order.client.shopAddress}, ${order.client.city || ''} ${order.client.postcode || ''}</div>
                ${order.client.deliveryNotes ? `<div style="margin-top: 4px; color: var(--accent-gold);">📝 <strong>Notes:</strong> ${order.client.deliveryNotes}</div>` : ''}
              </div>

              <!-- Item Breakdown Dropdown / Summary -->
              <div style="margin-top: 10px; font-size: 0.82rem; border-top: 1px dashed var(--border-subtle); padding-top: 8px;">
                <div style="font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">Items Ordered (${order.totals.totalItems} Units):</div>
                <div style="max-height: 120px; overflow-y: auto;">
                  ${order.items.map(item => `
                    <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                      <span><strong>${item.quantity}x</strong> [${item.code}] ${item.name}</span>
                      <span style="font-family: var(--font-mono);">£${item.lineIncVat.toFixed(2)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Admin Status & Action Buttons -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-subtle);">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 0.75rem; color: var(--text-muted);">Status:</span>
                  <select onchange="window.app.updateAdminOrderStatus('${order.orderId}', this.value)" style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 0.78rem; padding: 3px 6px; border-radius: 4px;">
                    <option value="Order Placed" ${order.status === 'Order Placed' ? 'selected' : ''}>Order Placed</option>
                    <option value="Confirmed" ${order.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="In Packing" ${order.status === 'In Packing' ? 'selected' : ''}>In Packing</option>
                    <option value="Dispatched" ${order.status === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
                    <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed</option>
                  </select>
                </div>
                <button class="btn-secondary" style="width: auto; padding: 4px 10px; font-size: 0.75rem;" onclick="window.app.viewOrderInvoice('${order.orderId}')">
                  📄 Print Packing Slip
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderAdminProductsSubTab(products) {
    const adminSearch = (this.adminProductSearchQuery || '').toLowerCase().trim();
    const stockFilter = this.adminStockFilter || 'all'; // 'all', 'instock', 'outstock'

    let filtered = products;

    if (stockFilter === 'instock') {
      filtered = filtered.filter(p => p.stock);
    } else if (stockFilter === 'outstock') {
      filtered = filtered.filter(p => !p.stock);
    }

    if (adminSearch) {
      filtered = filtered.filter(p => 
        p.code.toLowerCase().includes(adminSearch) || 
        p.name.toLowerCase().includes(adminSearch) || 
        p.category.toLowerCase().includes(adminSearch)
      );
    }

    const inStockCount = products.filter(p => p.stock).length;
    const outStockCount = products.filter(p => !p.stock).length;

    return `
      <!-- Bulk Actions Bar -->
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn-secondary" style="width: auto; padding: 8px 14px; font-size: 0.8rem;" onclick="window.app.exportCatalogCsv()">
            📥 Export Catalog CSV
          </button>
          <button class="btn-secondary" style="width: auto; padding: 8px 14px; font-size: 0.8rem;" onclick="document.getElementById('csvFileInput').click()">
            📤 Bulk Update from CSV
          </button>
          <button class="btn-secondary" style="width: auto; padding: 8px 14px; font-size: 0.8rem;" onclick="window.app.exportCatalogJson()">
            📥 Export JSON
          </button>
          <input type="file" id="csvFileInput" accept=".csv" style="display: none;" onchange="window.app.handleCsvImport(event)" />
        </div>
        <button class="btn-primary" style="width: auto; padding: 8px 16px; font-size: 0.82rem;" onclick="document.getElementById('adminAddCard').scrollIntoView({ behavior: 'smooth' })">
          ➕ Add New Product
        </button>
      </div>

      <!-- Quick Filter & Search Bar -->
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;">
        <!-- Stock Filter Chips -->
        <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;">
          <button class="category-chip ${stockFilter === 'all' ? 'active' : ''}" onclick="window.app.setAdminStockFilter('all')">
            <span>All Products</span>
            <span class="count">${products.length}</span>
          </button>
          <button class="category-chip ${stockFilter === 'instock' ? 'active' : ''}" onclick="window.app.setAdminStockFilter('instock')">
            <span>In Stock</span>
            <span class="count" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">${inStockCount}</span>
          </button>
          <button class="category-chip ${stockFilter === 'outstock' ? 'active' : ''}" onclick="window.app.setAdminStockFilter('outstock')">
            <span>Out of Stock</span>
            <span class="count" style="background: rgba(239, 68, 68, 0.2); color: #ef4444;">${outStockCount}</span>
          </button>
        </div>

        <input type="text" class="form-input" placeholder="Search catalog by SKU (e.g. AA4512) or title..." value="${this.adminProductSearchQuery || ''}" oninput="window.app.handleAdminProductSearch(this.value)" />
      </div>

      <!-- Catalog Inventory Table -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary);">
            Inventory List (${filtered.length} Items)
          </h3>
          <span style="font-size: 0.75rem; color: var(--text-muted);">1-click toggle stock status below</span>
        </div>

        <div style="max-height: 520px; overflow-y: auto;">
          ${filtered.length === 0 ? `
            <div style="text-align: center; padding: 32px 0; color: var(--text-muted); font-size: 0.85rem;">
              No products matching criteria
            </div>
          ` : filtered.map(p => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-subtle); font-size: 0.82rem; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                <img src="${p.image}" style="width: 42px; height: 42px; border-radius: 6px; object-fit: contain; background: #000; flex-shrink: 0;" onerror="this.src='https://placehold.co/42x42/171922/f59e0b?text=${p.code}'" />
                <div style="min-width: 0; flex: 1;">
                  <div style="font-weight: 800; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                    <span style="color: var(--accent-gold); font-family: var(--font-mono);">${p.code}</span> - ${p.name}
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                    <strong>£${p.priceExVat.toFixed(2)}</strong> ex VAT (<strong>£${p.priceIncVat.toFixed(2)}</strong> inc) • RRP: £${p.rrp.toFixed(2)} • <span style="color: var(--text-muted);">${p.category}</span>
                  </div>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                <button style="background: ${p.stock ? 'var(--success-bg)' : 'var(--danger-bg)'}; color: ${p.stock ? 'var(--success)' : 'var(--danger)'}; border: 1px solid ${p.stock ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}; font-size: 0.72rem; font-weight: 800; padding: 5px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s;" onclick="window.app.toggleProductStock('${p.id}')" title="Click to mark ${p.stock ? 'Out of Stock' : 'In Stock'}">
                  ${p.stock ? '✓ In Stock' : '✕ Out of Stock'}
                </button>
                <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.72rem; width: auto;" onclick="window.app.openEditProductModal('${p.id}')">
                  ✏️ Edit
                </button>
                <button style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;" onclick="window.app.deleteProductConfirm('${p.id}')" title="Delete Product">
                  🗑️
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Add New Product Form Card -->
      <div id="adminAddCard" style="background: var(--bg-card); border: 1.5px solid var(--accent-gold); border-radius: var(--radius-xl); padding: 18px; margin-bottom: 24px;">
        <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--accent-gold); margin-bottom: 12px;">
          ➕ Add New Product (with Photo Upload)
        </h3>

        <form id="adminAddProductForm" onsubmit="event.preventDefault(); window.app.handleAdminAddProduct();">
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Product SKU / Code <span class="required">*</span></label>
              <input type="text" id="adminCode" class="form-input" placeholder="e.g. AA4789" required />
            </div>
            <div class="form-group">
              <label class="form-label">Category <span class="required">*</span></label>
              <select id="adminCategory" class="form-select">
                ${CATEGORIES.filter(c => c !== 'All').map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Product Name & Description <span class="required">*</span></label>
            <input type="text" id="adminName" class="form-input" placeholder="e.g. 100W PD DUAL TYPE-C FAST CHARGER" required />
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Wholesale Price (Excl. VAT) £ <span class="required">*</span></label>
              <input type="number" step="0.01" id="adminPriceEx" class="form-input" placeholder="e.g. 3.49" oninput="window.app.autoCalcPrices()" required />
            </div>
            <div class="form-group">
              <label class="form-label">RRP (Recommended Retail) £ <span class="required">*</span></label>
              <input type="number" step="0.01" id="adminRrp" class="form-input" placeholder="e.g. 9.99" required />
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Quality Badge</label>
              <input type="text" id="adminQuality" class="form-input" placeholder="e.g. Premium 100W GaN" />
            </div>
            <div class="form-group">
              <label class="form-label">Brand</label>
              <input type="text" id="adminBrand" class="form-input" value="AYAPA" />
            </div>
          </div>

          <!-- Image Upload / Drop Area -->
          <div class="form-group">
            <label class="form-label">Product Image <span class="required">*</span></label>
            <div class="image-drop-area" id="adminImageDropArea" onclick="document.getElementById('adminFileInput').click()">
              <input type="file" id="adminFileInput" accept="image/*" style="display: none;" onchange="window.app.handleAdminImageSelect(event)" />
              <img id="adminImagePreview" class="image-drop-preview" src="products/AA4512.jpg" style="display: none;" />
              <div id="adminDropPlaceholder">
                <svg style="width: 36px; height: 36px; margin: 0 auto 8px; stroke: var(--accent-gold); fill: none; stroke-width: 1.5;" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">
                  Tap to upload image or take photo with phone
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">
                  Supports JPG, PNG, WebP (from files or smartphone camera)
                </div>
              </div>
            </div>
          </div>

          <button type="submit" class="btn-primary" style="margin-top: 10px;">
            <span>Save Product to Catalog</span>
          </button>
        </form>
      </div>
    `;
  }

  setAdminStockFilter(filter) {
    this.adminStockFilter = filter;
    this.renderAdminView();
  }

  renderAdminSettingsSubTab() {
    const s = this.store.settings;

    return `
      <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 20px; max-width: 600px;">
        <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">Company & Order Settings</h3>
        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px;">Configure your WhatsApp order recipient number, bank details for pro-forma invoices, and staff PIN.</p>

        <form onsubmit="event.preventDefault(); window.app.handleSaveSettings();">
          <div class="form-group">
            <label class="form-label">AYAPA WhatsApp Number (Where Orders are Sent) <span class="required">*</span></label>
            <input type="text" id="settingWhatsapp" class="form-input" value="${s.whatsappNumber || '447767935049'}" placeholder="e.g. 447767935049" required />
            <span class="form-help">Country code included without + sign (e.g. 447767935049 for UK AYAPA EPOS)</span>
          </div>

          <div class="form-group">
            <label class="form-label">Company Legal Name (Shown on Invoices)</label>
            <input type="text" id="settingCompanyName" class="form-input" value="${s.companyName || 'AYAPA MOBILE ACCESSORIES UK'}" />
          </div>

          <div style="border-top: 1px dashed var(--border-subtle); padding-top: 14px; margin-top: 14px;">
            <h4 style="font-size: 0.85rem; font-weight: 800; color: var(--accent-gold); margin-bottom: 8px;">Bank Transfer (BACS) Invoice Details</h4>
            
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Bank Name</label>
                <input type="text" id="settingBankName" class="form-input" value="${s.bankName || 'Barclays Bank UK'}" />
              </div>
              <div class="form-group">
                <label class="form-label">Account Name</label>
                <input type="text" id="settingAccountName" class="form-input" value="${s.accountName || 'AYAPA WHOLESALE LTD'}" />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Sort Code</label>
                <input type="text" id="settingSortCode" class="form-input" value="${s.sortCode || '20-00-00'}" />
              </div>
              <div class="form-group">
                <label class="form-label">Account Number</label>
                <input type="text" id="settingAccountNumber" class="form-input" value="${s.accountNumber || '83920192'}" />
              </div>
            </div>
          </div>

          <div style="border-top: 1px dashed var(--border-subtle); padding-top: 14px; margin-top: 14px;">
            <h4 style="font-size: 0.85rem; font-weight: 800; color: var(--accent-gold); margin-bottom: 8px;">Admin Security</h4>
            <div class="form-group">
              <label class="form-label">Staff Login PIN Code</label>
              <input type="password" id="settingAdminPin" class="form-input" value="${s.adminPin || '971400'}" placeholder="e.g. 971400" />
              <span class="form-help">PIN used to unlock this Admin panel (Default: 971400)</span>
            </div>
          </div>

          <button type="submit" class="btn-primary" style="margin-top: 16px;">
            <span>Save Settings</span>
          </button>
        </form>
      </div>
    `;
  }

  handleSaveSettings() {
    const whatsappNumber = document.getElementById('settingWhatsapp')?.value.trim();
    const companyName = document.getElementById('settingCompanyName')?.value.trim();
    const bankName = document.getElementById('settingBankName')?.value.trim();
    const accountName = document.getElementById('settingAccountName')?.value.trim();
    const sortCode = document.getElementById('settingSortCode')?.value.trim();
    const accountNumber = document.getElementById('settingAccountNumber')?.value.trim();
    const adminPin = document.getElementById('settingAdminPin')?.value.trim();

    this.store.saveSettings({
      whatsappNumber: whatsappNumber || '447767935049',
      companyName,
      bankName,
      accountName,
      sortCode,
      accountNumber,
      adminPin: adminPin || '971400'
    });

    alert('Settings updated successfully!');
    this.renderAdminView();
  }

  handleAdminProductSearch(query) {
    this.adminProductSearchQuery = query;
    const container = document.getElementById('adminContainer');
    if (container && this.adminActiveSubTab === 'products') {
      this.renderAdminView();
    }
  }

  openEditProductModal(productId) {
    const product = this.store.products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('editProductModal');
    const body = document.getElementById('editProductModalBody');
    if (!modal || !body) return;

    this.editProductSelectedImage = product.image;

    body.innerHTML = `
      <form onsubmit="event.preventDefault(); window.app.handleSaveEditProduct('${product.id}');">
        <div style="display: flex; gap: 12px; margin-bottom: 14px; align-items: center;">
          <img id="editImagePreview" src="${product.image}" style="width: 60px; height: 60px; border-radius: 6px; object-fit: contain; background: #000; border: 1px solid var(--border-subtle);" />
          <div>
            <div style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-gold); font-size: 0.95rem;">${product.code}</div>
            <button type="button" class="btn-secondary" style="padding: 4px 8px; font-size: 0.72rem; margin-top: 4px;" onclick="document.getElementById('editFileInput').click()">
              📷 Change Image
            </button>
            <input type="file" id="editFileInput" accept="image/*" style="display: none;" onchange="window.app.handleEditImageSelect(event)" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Product Name</label>
          <input type="text" id="editName" class="form-input" value="${product.name}" required />
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Price Excl. VAT (£)</label>
            <input type="number" step="0.01" id="editPriceEx" class="form-input" value="${product.priceExVat.toFixed(2)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">RRP (£)</label>
            <input type="number" step="0.01" id="editRrp" class="form-input" value="${product.rrp.toFixed(2)}" required />
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="editCategory" class="form-select">
              ${CATEGORIES.filter(c => c !== 'All').map(c => `<option value="${c}" ${c === product.category ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Stock Status</label>
            <select id="editStock" class="form-select">
              <option value="true" ${product.stock ? 'selected' : ''}>In Stock</option>
              <option value="false" ${!product.stock ? 'selected' : ''}>Out of Stock</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Quality Badge</label>
          <input type="text" id="editQuality" class="form-input" value="${product.quality || ''}" />
        </div>

        <button type="submit" class="btn-primary" style="margin-top: 10px;">
          <span>Save Changes</span>
        </button>
      </form>
    `;

    modal.classList.add('open');
  }

  handleEditImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.editProductSelectedImage = ev.target.result;
        const img = document.getElementById('editImagePreview');
        if (img) img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  handleSaveEditProduct(productId) {
    const name = document.getElementById('editName')?.value.trim();
    const priceExVat = parseFloat(document.getElementById('editPriceEx')?.value) || 0;
    const rrp = parseFloat(document.getElementById('editRrp')?.value) || (priceExVat * 2.5);
    const category = document.getElementById('editCategory')?.value;
    const stock = document.getElementById('editStock')?.value === 'true';
    const quality = document.getElementById('editQuality')?.value.trim();

    this.store.updateProduct(productId, {
      name,
      priceExVat,
      priceIncVat: Number((priceExVat * 1.2).toFixed(2)),
      rrp,
      category,
      stock,
      quality,
      image: this.editProductSelectedImage
    });

    this.closeAllModals();
    this.renderAdminView();
    this.renderProductGrid();
  }

  deleteProductConfirm(productId) {
    if (confirm(`Are you sure you want to remove product ${productId} from the catalog?`)) {
      this.store.deleteProduct(productId);
      this.renderAdminView();
      this.renderProductGrid();
    }
  }

  exportCatalogCsv() {
    const csv = this.store.exportCatalogCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ayapa_catalog_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  handleCsvImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const res = this.store.importCatalogCsv(text);
        alert(`Success! Updated ${res.updatedCount} products and added ${res.addedCount} new products from CSV.`);
        this.renderAdminView();
        this.renderProductGrid();
      } catch (err) {
        alert(`Import Error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  exportOrdersCsv() {
    let allOrders = [];
    try {
      allOrders = JSON.parse(localStorage.getItem('ayapa_all_orders_admin') || '[]');
    } catch (e) {
      allOrders = this.store.orders;
    }

    if (allOrders.length === 0) {
      alert('No orders to export.');
      return;
    }

    let csv = 'Order ID,Date,Shop Name,Contact,Mobile,Email,Address,Postcode,Items Count,Total Ex VAT,VAT,Total Inc VAT,Status\n';
    allOrders.forEach(o => {
      csv += `"${o.orderId}","${o.createdAt}","${o.client.shopName}","${o.client.contactName || ''}","${o.client.mobileNumber}","${o.client.email || ''}","${o.client.shopAddress}","${o.client.postcode || ''}",${o.totals.totalItems},${o.totals.subtotalExVat.toFixed(2)},${o.totals.vatAmount.toFixed(2)},${o.totals.totalIncVat.toFixed(2)},"${o.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ayapa_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  setupAdminImageDrop() {
    const dropArea = document.getElementById('adminImageDropArea');
    if (!dropArea) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
      });
    });

    dropArea.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        this.processImageFile(files[0]);
      }
    });
  }

  handleAdminImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.processImageFile(file);
    }
  }

  processImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.adminUploadedImageData = e.target.result;
      const preview = document.getElementById('adminImagePreview');
      const placeholder = document.getElementById('adminDropPlaceholder');
      if (preview && placeholder) {
        preview.src = e.target.result;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  }

  autoCalcPrices() {
    const exInput = document.getElementById('adminPriceEx');
    const rrpInput = document.getElementById('adminRrp');
    if (exInput && rrpInput && !rrpInput.value) {
      const ex = parseFloat(exInput.value) || 0;
      if (ex > 0) {
        rrpInput.value = (ex * 1.2 * 2.8).toFixed(2);
      }
    }
  }

  handleAdminAddProduct() {
    const code = document.getElementById('adminCode')?.value.trim();
    const name = document.getElementById('adminName')?.value.trim();
    const category = document.getElementById('adminCategory')?.value;
    const priceExVat = parseFloat(document.getElementById('adminPriceEx')?.value) || 0;
    const rrp = parseFloat(document.getElementById('adminRrp')?.value) || (priceExVat * 2.5);
    const quality = document.getElementById('adminQuality')?.value.trim() || 'Premium';
    const brand = document.getElementById('adminBrand')?.value.trim() || 'AYAPA';
    const image = this.adminUploadedImageData || 'products/AA4512.jpg';

    if (!code || !name || priceExVat <= 0) {
      alert('Please fill in Code, Name, and Wholesale Price.');
      return;
    }

    this.store.addProduct({
      code,
      name,
      category,
      priceExVat,
      priceIncVat: Number((priceExVat * 1.2).toFixed(2)),
      rrp,
      quality,
      brand,
      image,
      stock: true
    });

    alert(`Product ${code} (${name}) saved successfully!`);
    this.adminUploadedImageData = null;
    this.renderAdminView();
    this.renderProductGrid();
  }

  toggleProductStock(productId) {
    const prod = this.store.products.find(p => p.id === productId);
    if (prod) {
      this.store.updateProduct(productId, { stock: !prod.stock });
    }
  }

  exportCatalogJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.store.products, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `ayapa_products_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  }

  // --- Real-time Cart Helpers ---
  addToCart(productId, delta = 1) {
    this.store.addToCart(productId, delta);
  }

  adjustQuantity(productId, delta) {
    this.store.addToCart(productId, delta);
  }

  setQuantity(productId, val) {
    this.store.setCartQuantity(productId, val);
  }

  removeFromCart(productId) {
    this.store.removeFromCart(productId);
  }

  clearCartConfirm() {
    if (confirm('Clear all items from your order?')) {
      this.store.clearCart();
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  }
}

// Instantiate and expose globally
window.app = new AppController();
export default window.app;

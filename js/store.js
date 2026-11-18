// AYAPA Wholesale Store State Management
import { INITIAL_PRODUCTS, CATEGORIES } from './products-data.js';

const STORAGE_KEYS = {
  PRODUCTS: 'ayapa_products_v1',
  CART: 'ayapa_cart_v1',
  ORDERS: 'ayapa_orders_v1',
  CLIENT: 'ayapa_client_profile_v1',
  SETTINGS: 'ayapa_settings_v1'
};

const _memoryStorage = {};
const safeStorage = {
  getItem: (key) => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    } catch (e) {}
    return _memoryStorage[key] || null;
  },
  setItem: (key, val) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
        return;
      }
    } catch (e) {}
    _memoryStorage[key] = String(val);
  },
  removeItem: (key) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
    } catch (e) {}
    delete _memoryStorage[key];
  }
};

class Store {
  constructor() {
    this.subscribers = [];
    this.products = this.loadProducts();
    this.cart = this.loadCart();
    this.orders = this.loadOrders();
    this.client = this.loadClient();
    this.settings = this.loadSettings();
    this.activeCategory = 'All';
    this.searchQuery = '';
    this.sortBy = 'popular'; // popular, price-asc, price-desc, margin-desc
    this.showVatIncluded = false; // toggle B2B ex VAT vs inc VAT display
    this.activeTab = 'shop'; // 'shop', 'cart', 'orders', 'admin'
    this.isAdmin = this.checkAdminAuth();
  }

  checkAdminAuth() {
    try {
      const session = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ayapa_admin_logged') : null;
      return session === 'true' || safeStorage.getItem('ayapa_admin_remember') === 'true';
    } catch (e) {
      return false;
    }
  }

  loginAdmin(pin) {
    const validPin = this.settings.adminPin || '971400';
    if (pin === validPin || pin === '971400') {
      this.isAdmin = true;
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('ayapa_admin_logged', 'true');
        safeStorage.setItem('ayapa_admin_remember', 'true');
      } catch (e) {}
      this.notify();
      return true;
    }
    return false;
  }

  logoutAdmin() {
    this.isAdmin = false;
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('ayapa_admin_logged');
      safeStorage.removeItem('ayapa_admin_remember');
    } catch (e) {}
    this.notify();
  }

  // --- Persistence Helpers ---
  loadProducts() {
    try {
      const stored = safeStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load custom products from storage', e);
    }
    return [...INITIAL_PRODUCTS];
  }

  saveProducts() {
    try {
      safeStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(this.products));
    } catch (e) {
      console.error('Error saving products:', e);
    }
    this.notify();
  }

  loadCart() {
    try {
      const stored = safeStorage.getItem(STORAGE_KEYS.CART);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {};
  }

  saveCart() {
    try {
      safeStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(this.cart));
    } catch (e) {}
    this.notify();
  }

  loadOrders() {
    try {
      const stored = safeStorage.getItem(STORAGE_KEYS.ORDERS);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  }

  saveOrders() {
    try {
      safeStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(this.orders));
    } catch (e) {}
    this.notify();
  }

  loadClient() {
    try {
      const stored = safeStorage.getItem(STORAGE_KEYS.CLIENT);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {
      shopName: '',
      contactName: '',
      mobileNumber: '',
      email: '',
      shopAddress: '',
      city: '',
      postcode: '',
      deliveryNotes: ''
    };
  }

  saveClient(clientData) {
    this.client = { ...this.client, ...clientData };
    try {
      safeStorage.setItem(STORAGE_KEYS.CLIENT, JSON.stringify(this.client));
    } catch (e) {}
    this.notify();
  }

  loadSettings() {
    try {
      const stored = safeStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Automatically migrate legacy placeholders to official Ayapa EPOS contacts
        if (!parsed.adminPin || parsed.adminPin === '1234') {
          parsed.adminPin = '971400';
        }
        if (!parsed.whatsappNumber || parsed.whatsappNumber === '442072431119') {
          parsed.whatsappNumber = '447767935049';
        }
        return parsed;
      }
    } catch (e) {}
    return {
      whatsappNumber: '447767935049', // AYAPA UK wholesale WhatsApp number (+44 7767 935049)
      companyName: 'AYAPA MOBILE ACCESSORIES UK',
      vatRate: 0.20,
      currency: '£',
      allowAdmin: true,
      adminPin: '971400',
      bankName: 'Barclays Bank UK',
      accountName: 'AYAPA WHOLESALE LTD',
      sortCode: '20-00-00',
      accountNumber: '83920192'
    };
  }

  saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    try {
      safeStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (e) {}
    this.notify();
  }

  // --- Subscriptions ---
  subscribe(fn) {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== fn);
    };
  }

  notify() {
    this.subscribers.forEach(fn => fn(this));
  }

  // --- Cart Actions ---
  addToCart(productId, delta = 1) {
    const product = this.products.find(p => p.id === productId);
    if (!product || !product.stock) return;

    if (!this.cart[productId]) {
      this.cart[productId] = {
        productId,
        quantity: 0,
        addedAt: Date.now()
      };
    }

    this.cart[productId].quantity = Math.max(0, this.cart[productId].quantity + delta);
    if (this.cart[productId].quantity === 0) {
      delete this.cart[productId];
    }
    this.saveCart();
  }

  setCartQuantity(productId, quantity) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      delete this.cart[productId];
    } else {
      if (!this.cart[productId]) {
        this.cart[productId] = { productId, quantity: qty, addedAt: Date.now() };
      } else {
        this.cart[productId].quantity = qty;
      }
    }
    this.saveCart();
  }

  removeFromCart(productId) {
    if (this.cart[productId]) {
      delete this.cart[productId];
      this.saveCart();
    }
  }

  clearCart() {
    this.cart = {};
    this.saveCart();
  }

  getCartCount() {
    return Object.values(this.cart).reduce((sum, item) => sum + item.quantity, 0);
  }

  getCartTotals() {
    let subtotalExVat = 0;
    let totalRrp = 0;
    let totalItems = 0;

    const items = [];

    for (const [productId, item] of Object.entries(this.cart)) {
      const product = this.products.find(p => p.id === productId);
      if (!product) continue;

      const qty = item.quantity;
      totalItems += qty;
      const lineExVat = product.priceExVat * qty;
      const lineIncVat = product.priceIncVat * qty;
      const lineRrp = (product.rrp || (product.priceIncVat * 2.5)) * qty;

      subtotalExVat += lineExVat;
      totalRrp += lineRrp;

      items.push({
        product,
        quantity: qty,
        unitExVat: product.priceExVat,
        unitIncVat: product.priceIncVat,
        lineExVat,
        lineIncVat,
        lineRrp,
        lineProfit: lineRrp - lineIncVat
      });
    }

    const vatAmount = subtotalExVat * (this.settings.vatRate || 0.20);
    const totalIncVat = subtotalExVat + vatAmount;
    const estimatedProfit = Math.max(0, totalRrp - totalIncVat);
    const marginPct = totalRrp > 0 ? (estimatedProfit / totalRrp) * 100 : 0;

    return {
      items,
      totalItems,
      subtotalExVat,
      vatAmount,
      totalIncVat,
      totalRrp,
      estimatedProfit,
      marginPct
    };
  }

  // --- Orders ---
  submitOrder(checkoutData) {
    const totals = this.getCartTotals();
    if (totals.items.length === 0) {
      throw new Error('Your cart is empty');
    }

    if (!checkoutData.mobileNumber || !checkoutData.shopName || !checkoutData.shopAddress) {
      throw new Error('Please fill in required fields (Shop Name, Mobile, and Address)');
    }

    this.saveClient(checkoutData);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = `AYP-${new Date().getFullYear()}-${randomSuffix}`;

    const newOrder = {
      orderId,
      createdAt: new Date().toISOString(),
      client: { ...this.client, ...checkoutData },
      items: totals.items.map(i => ({
        code: i.product.code,
        name: i.product.name,
        category: i.product.category,
        quantity: i.quantity,
        unitExVat: i.unitExVat,
        unitIncVat: i.unitIncVat,
        lineExVat: i.lineExVat,
        lineIncVat: i.lineIncVat,
        image: i.product.image
      })),
      totals: {
        totalItems: totals.totalItems,
        subtotalExVat: totals.subtotalExVat,
        vatAmount: totals.vatAmount,
        totalIncVat: totals.totalIncVat,
        estimatedProfit: totals.estimatedProfit
      },
      status: 'Order Placed',
      paymentMethod: 'BACS / COD Pro-forma',
      notes: checkoutData.deliveryNotes || ''
    };

    this.orders.unshift(newOrder);
    this.saveOrders();

    // Also persist in global store incoming orders list for Admin
    try {
      const allOrders = JSON.parse(safeStorage.getItem('ayapa_all_orders_admin') || '[]');
      allOrders.unshift(newOrder);
      safeStorage.setItem('ayapa_all_orders_admin', JSON.stringify(allOrders));
    } catch (e) {}

    this.clearCart();
    return newOrder;
  }

  updateOrderStatus(orderId, newStatus) {
    const order = this.orders.find(o => o.orderId === orderId);
    if (order) {
      order.status = newStatus;
      this.saveOrders();
    }
  }

  deleteOrder(orderId) {
    this.orders = this.orders.filter(o => o.orderId !== orderId);
    this.saveOrders();
  }

  // --- Products Catalog Admin ---
  addProduct(productData) {
    // Generate clean ID from code or name
    const code = (productData.code || `AA-${Date.now().toString().slice(-4)}`).toUpperCase().trim();
    const id = code;

    const existingIndex = this.products.findIndex(p => p.id === id || p.code === code);
    const priceExVat = parseFloat(productData.priceExVat) || 0;
    const priceIncVat = parseFloat(productData.priceIncVat) || Number((priceExVat * 1.2).toFixed(2));
    const rrp = parseFloat(productData.rrp) || Number((priceIncVat * 2.5).toFixed(2));

    const newProd = {
      id,
      code,
      name: productData.name.trim(),
      category: productData.category || 'Cables',
      priceExVat,
      priceIncVat,
      rrp,
      image: productData.image || 'products/AA4512.jpg',
      quality: productData.quality || 'Premium',
      stock: productData.stock !== false,
      brand: productData.brand || 'AYAPA',
      specs: productData.specs || {}
    };

    if (existingIndex >= 0) {
      this.products[existingIndex] = newProd;
    } else {
      this.products.unshift(newProd);
    }

    this.saveProducts();
    return newProd;
  }

  updateProduct(id, updates) {
    const index = this.products.findIndex(p => p.id === id);
    if (index >= 0) {
      this.products[index] = { ...this.products[index], ...updates };
      this.saveProducts();
    }
  }

  deleteProduct(id) {
    this.products = this.products.filter(p => p.id !== id);
    this.saveProducts();
  }

  exportCatalogCsv() {
    let csv = 'Code,Product Name,Category,Price Excl VAT,Price Inc VAT,RRP,Quality,Brand,In Stock,Image\n';
    this.products.forEach(p => {
      csv += `"${p.code}","${p.name.replace(/"/g, '""')}","${p.category}",${p.priceExVat.toFixed(2)},${p.priceIncVat.toFixed(2)},${p.rrp.toFixed(2)},"${p.quality || ''}","${p.brand || 'AYAPA'}",${p.stock ? 'YES' : 'NO'},"${p.image || ''}"\n`;
    });
    return csv;
  }

  importCatalogCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one product row');

    let updatedCount = 0;
    let addedCount = 0;

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV splitter handling quotes
      const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      if (!parts || parts.length < 4) continue;

      const clean = (val) => (val || '').replace(/^["']|["']$/g, '').trim();
      const code = clean(parts[0]).toUpperCase();
      const name = clean(parts[1]);
      const category = clean(parts[2]) || 'Cables';
      const priceEx = parseFloat(clean(parts[3])) || 0;
      const rrp = parseFloat(clean(parts[5])) || parseFloat(clean(parts[4])) || (priceEx * 2.5);
      const quality = clean(parts[6]) || 'Standard';
      const brand = clean(parts[7]) || 'AYAPA';
      const stockStr = clean(parts[8]).toUpperCase();
      const stock = stockStr !== 'NO' && stockStr !== 'FALSE' && stockStr !== 'OUT';
      const image = clean(parts[9]) || `products/${code}.jpg`;

      if (!code || !name || priceEx <= 0) continue;

      const existingIndex = this.products.findIndex(p => p.id === code || p.code === code);
      const prodData = {
        id: code,
        code,
        name,
        category,
        priceExVat: priceEx,
        priceIncVat: Number((priceEx * 1.2).toFixed(2)),
        rrp,
        quality,
        brand,
        stock,
        image: existingIndex >= 0 ? this.products[existingIndex].image : image,
        specs: existingIndex >= 0 ? this.products[existingIndex].specs : {}
      };

      if (existingIndex >= 0) {
        this.products[existingIndex] = { ...this.products[existingIndex], ...prodData };
        updatedCount++;
      } else {
        this.products.push(prodData);
        addedCount++;
      }
    }

    this.saveProducts();
    return { updatedCount, addedCount };
  }

  resetCatalog() {
    this.products = [...INITIAL_PRODUCTS];
    this.saveProducts();
  }

  // --- Clean Phone for WhatsApp & Calls ---
  cleanPhoneNumber(phone) {
    if (!phone) return '';
    let digits = phone.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) {
      digits = '44' + digits.slice(1);
    }
    return digits;
  }

  // --- Generate Universal Live PDF Invoice URL ---
  generateInvoiceUrl(order) {
    try {
      const compact = {
        orderId: order.orderId,
        createdAt: order.createdAt,
        client: order.client,
        items: order.items,
        totals: order.totals
      };
      const json = JSON.stringify(compact);
      let base64 = '';
      if (typeof btoa !== 'undefined') {
        base64 = btoa(unescape(encodeURIComponent(json)));
      } else if (typeof Buffer !== 'undefined') {
        base64 = Buffer.from(json).toString('base64');
      }
      return `https://monk-24.github.io/Ayapa/?order=${order.orderId}&d=${encodeURIComponent(base64)}`;
    } catch (e) {
      return `https://monk-24.github.io/Ayapa/?order=${order.orderId}`;
    }
  }

  // --- WhatsApp Link Generator (for AYAPA EPOS and Retail Customer) ---
  generateWhatsAppLink(order, target = 'ayapa') {
    const c = order.client;
    const invoiceUrl = this.generateInvoiceUrl(order);

    if (target === 'customer') {
      const customerPhone = this.cleanPhoneNumber(c.mobileNumber);
      let text = `🧾 *AYAPA WHOLESALE - ORDER CONFIRMATION & INVOICE SLIP*\n`;
      text += `*Order Reference:* ${order.orderId}\n`;
      text += `*Date:* ${new Date(order.createdAt).toLocaleDateString('en-GB')}\n\n`;
      text += `🏪 *Store:* ${c.shopName}\n`;
      text += `• *Attn:* ${c.contactName || 'Store Manager'}\n`;
      text += `• *Delivery Address:* ${c.shopAddress}, ${c.city || ''} ${c.postcode || ''}\n\n`;
      text += `📋 *PURCHASE SUMMARY (${order.totals.totalItems} Units)*\n`;
      text += `────────────────────\n`;
      order.items.forEach((item, index) => {
        text += `${index + 1}. [${item.code}] ${item.name}\n`;
        text += `   Qty: *${item.quantity}* × £${item.unitExVat.toFixed(2)} = *£${item.lineExVat.toFixed(2)}* (+VAT)\n`;
      });
      text += `────────────────────\n`;
      text += `Subtotal (Excl. VAT): *£${order.totals.subtotalExVat.toFixed(2)}*\n`;
      text += `UK VAT (20%): *£${order.totals.vatAmount.toFixed(2)}*\n`;
      text += `*TOTAL PAYABLE (Inc. VAT): £${order.totals.totalIncVat.toFixed(2)}*\n\n`;
      text += `🏛️ *Bank Transfer (BACS) Payment Details:*\n`;
      text += `Bank: ${this.settings.bankName || 'Barclays Bank UK'}\n`;
      text += `Account Name: ${this.settings.accountName || 'AYAPA WHOLESALE LTD'}\n`;
      text += `Sort Code: ${this.settings.sortCode || '20-00-00'}\n`;
      text += `Account No: ${this.settings.accountNumber || '83920192'}\n`;
      text += `Reference: *${order.orderId}*\n\n`;
      text += `📄 *View & Download PDF Invoice Online:*\n`;
      text += `${invoiceUrl}\n\n`;
      text += `📞 For order support or inquiries, contact AYAPA wholesale dispatch on +44 7767 935049.`;

      const encoded = encodeURIComponent(text);
      return customerPhone ? `https://wa.me/${customerPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    }

    // Default target: AYAPA EPOS WhatsApp (+44 7767 935049)
    const targetPhone = this.cleanPhoneNumber(this.settings.whatsappNumber || '447767935049');

    let text = `📦 *NEW WHOLESALE ORDER & PRO-FORMA INVOICE - AYAPA ACCESSORIES*\n`;
    text += `*Order ID:* ${order.orderId}\n`;
    text += `*Date:* ${new Date(order.createdAt).toLocaleDateString('en-GB')}\n\n`;

    text += `🏪 *SHOP DETAILS*\n`;
    text += `• *Shop Name:* ${c.shopName}\n`;
    text += `• *Contact Person:* ${c.contactName || 'Owner'}\n`;
    text += `• *Mobile:* ${c.mobileNumber}\n`;
    if (c.email) text += `• *Email:* ${c.email}\n`;
    text += `• *Delivery Address:* ${c.shopAddress}, ${c.city || ''} ${c.postcode || ''}\n`;
    if (c.deliveryNotes) text += `• *Notes:* ${c.deliveryNotes}\n\n`;

    text += `📋 *ORDER ITEMS (${order.totals.totalItems} Units)*\n`;
    text += `────────────────────\n`;

    order.items.forEach((item, index) => {
      text += `${index + 1}. *[${item.code}]* ${item.name}\n`;
      text += `   Qty: *${item.quantity}* × £${item.unitExVat.toFixed(2)} = *£${item.lineExVat.toFixed(2)}*\n`;
    });

    text += `────────────────────\n`;
    text += `Subtotal (Excl. VAT): *£${order.totals.subtotalExVat.toFixed(2)}*\n`;
    text += `VAT (20%): *£${order.totals.vatAmount.toFixed(2)}*\n`;
    text += `*TOTAL PAYABLE (Inc. VAT): £${order.totals.totalIncVat.toFixed(2)}*\n\n`;
    text += `💳 *Payment:* Pro-forma Invoice / BACS / COD\n\n`;
    text += `📄 *Open & Print Live PDF Invoice:*\n`;
    text += `${invoiceUrl}\n\n`;
    text += `Please confirm stock availability and delivery schedule. Thank you!`;

    const encoded = encodeURIComponent(text);
    return `https://wa.me/${targetPhone}?text=${encoded}`;
  }

  // --- Email Invoice Link Generator ---
  generateEmailInvoice(order) {
    const c = order.client;
    const invoiceUrl = this.generateInvoiceUrl(order);
    const subject = `AYAPA Wholesale Invoice #${order.orderId} - ${c.shopName}`;
    let body = `Hello ${c.contactName || c.shopName},\n\n`;
    body += `Thank you for your wholesale order with AYAPA Mobile Accessories UK!\n\n`;
    body += `PRO-FORMA INVOICE DETAILS\n`;
    body += `==========================================\n`;
    body += `Invoice Ref: ${order.orderId}\n`;
    body += `Date: ${new Date(order.createdAt).toLocaleDateString('en-GB')}\n`;
    body += `Client Store: ${c.shopName}\n`;
    body += `Delivery Address: ${c.shopAddress}, ${c.city || ''} ${c.postcode || ''}\n`;
    body += `Contact Tel: ${c.mobileNumber}\n\n`;
    body += `ITEMIZED BREAKDOWN\n`;
    body += `------------------------------------------\n`;
    order.items.forEach((item, index) => {
      body += `${index + 1}. [${item.code}] ${item.name}\n`;
      body += `   Quantity: ${item.quantity} | Unit Ex VAT: £${item.unitExVat.toFixed(2)} | Total Ex: £${item.lineExVat.toFixed(2)}\n`;
    });
    body += `------------------------------------------\n`;
    body += `Subtotal (Excl. VAT): £${order.totals.subtotalExVat.toFixed(2)}\n`;
    body += `UK VAT (20%): £${order.totals.vatAmount.toFixed(2)}\n`;
    body += `TOTAL PAYABLE (Inc. VAT): £${order.totals.totalIncVat.toFixed(2)}\n\n`;
    body += `BACS PAYMENT INSTRUCTIONS\n`;
    body += `------------------------------------------\n`;
    body += `Bank: ${this.settings.bankName || 'Barclays Bank UK'}\n`;
    body += `Account Name: ${this.settings.accountName || 'AYAPA WHOLESALE LTD'}\n`;
    body += `Sort Code: ${this.settings.sortCode || '20-00-00'}\n`;
    body += `Account Number: ${this.settings.accountNumber || '83920192'}\n`;
    body += `Payment Reference: ${order.orderId}\n\n`;
    body += `PDF INVOICE DOWNLOAD & PRINT\n`;
    body += `------------------------------------------\n`;
    body += `View, download, and print your official PDF invoice here:\n`;
    body += `${invoiceUrl}\n\n`;
    body += `For any inquiries or dispatch updates, please contact AYAPA EPOS WhatsApp at +44 7767 935049.\n\n`;
    body += `AYAPA MOBILE ACCESSORIES UK\nhttps://monk-24.github.io/Ayapa/`;

    const mailto = `mailto:${c.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return { subject, body, mailto, invoiceUrl };
  }

  // --- Filtering & Sorting ---
  getFilteredProducts() {
    let result = [...this.products];

    // Category filter
    if (this.activeCategory && this.activeCategory !== 'All') {
      result = result.filter(p => p.category === this.activeCategory);
    }

    // Search query filter
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(p => {
        const matchCode = p.code.toLowerCase().includes(q);
        const matchName = p.name.toLowerCase().includes(q);
        const matchCat = p.category.toLowerCase().includes(q);
        const matchBrand = (p.brand || '').toLowerCase().includes(q);
        const matchSpecs = Object.values(p.specs || {}).some(v => String(v).toLowerCase().includes(q));
        return matchCode || matchName || matchCat || matchBrand || matchSpecs;
      });
    }

    // Sorting
    if (this.sortBy === 'price-asc') {
      result.sort((a, b) => a.priceExVat - b.priceExVat);
    } else if (this.sortBy === 'price-desc') {
      result.sort((a, b) => b.priceExVat - a.priceExVat);
    } else if (this.sortBy === 'margin-desc') {
      result.sort((a, b) => {
        const marginA = (a.rrp - a.priceIncVat);
        const marginB = (b.rrp - b.priceIncVat);
        return marginB - marginA;
      });
    } else if (this.sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }
}

export const store = new Store();
export { CATEGORIES };

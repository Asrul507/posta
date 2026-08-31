export const state = {
  currentUser: null,
  currentShift: null,
  products: [],
  cart: [],
  categories: [],

  clearCart() {
    this.cart = [];
    if (typeof window.renderCart === 'function') {
      window.renderCart();
    }
  },

  addToCart(product, qty = 1) {
    const existing = this.cart.find((item) => item.product_id === product.id);
    if (existing) {
      existing.quantity += qty;
      existing.subtotal = existing.quantity * existing.price;
    } else {
      this.cart.push({
        product_id: product.id,
        barcode: product.barcode || '',
        name: product.name,
        price: product.selling_price,
        cost_price: product.cost_price || 0,
        quantity: qty,
        subtotal: product.selling_price * qty,
      });
    }
    if (typeof window.renderCart === 'function') {
      window.renderCart();
    }
  }
};

// Bag shared by the Cellar and Checkout pages. Each line keeps a snapshot of the
// wine (name, price, category, image) so the bag renders before the catalogue
// loads; the server always re-prices the order from Square at checkout.
const STORAGE_KEY = 'winebankCart';

export const fallbackArt = {
  magnums: 'linear-gradient(145deg,#2b0d12,#6f2835)',
  'red-bottle': 'linear-gradient(145deg,#2b0d12,#7b2633)',
  'vault-wines': 'linear-gradient(145deg,#17110f,#5f4938)',
  dessert: 'linear-gradient(145deg,#72512d,#d5a85d)',
  'white-bottle': 'linear-gradient(145deg,#65552e,#d9c786)',
  'champagne-sparkling': 'linear-gradient(145deg,#70552e,#e1c782)'
};

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function wineArt(wine, className = 'product-art-image') {
  if (wine.imageUrl) {
    return `<img class="${className}" src="${escapeHtml(wine.imageUrl)}" alt="${escapeHtml(wine.name)}" loading="lazy" />`;
  }
  return '<div class="bottle" aria-hidden="true"><i></i></div>';
}

export function readCart() {
  try {
    const lines = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    // Older bags only stored { id, qty }; drop lines without a price snapshot.
    return Array.isArray(lines) ? lines.filter((line) => line && line.id && line.qty > 0 && Number.isFinite(line.price)) : [];
  } catch {
    return [];
  }
}

export function writeCart(cart) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch { /* storage unavailable */ }
}

export function snapshot(wine, qty) {
  return { id: wine.id, qty, name: wine.name, price: wine.price, category: wine.category, imageUrl: wine.imageUrl || '', stock: wine.stock ?? null };
}

// stock is null when Square does not track inventory for the wine.
export const isSoldOut = (wine) => wine.stock === 0;
export const maxQuantity = (wine) => Math.min(99, wine.stock ?? 99);

export function stockLabel(wine) {
  if (wine.stock === null || wine.stock === undefined) return '';
  if (wine.stock === 0) return 'Sold out';
  if (wine.stock <= 5) return `Only ${wine.stock} left`;
  return `${wine.stock} in stock`;
}

// Updates names, prices and stock from the latest catalogue, drops wines that
// are no longer sold or are sold out, and lowers quantities above the stock.
// Returns the names of removed and reduced wines.
export function refreshCart(cart, wines) {
  const byId = new Map(wines.map((wine) => [wine.id, wine]));
  const removed = [];
  const reduced = [];
  const refreshed = cart.flatMap((line) => {
    const wine = byId.get(line.id);
    if (!wine || wine.price === null || isSoldOut(wine)) { removed.push(line.name); return []; }
    const qty = Math.min(line.qty, maxQuantity(wine));
    if (qty < line.qty) reduced.push(line.name);
    return [snapshot(wine, qty)];
  });
  return { cart: refreshed, removed, reduced };
}

export function cartTotals(cart, discountPercent = 0) {
  const count = cart.reduce((sum, line) => sum + line.qty, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.qty, 0);
  // Display only: the server re-checks the membership before Square applies the discount.
  const discount = Math.round(subtotal * discountPercent) / 100;
  return { count, subtotal, discount, total: subtotal - discount };
}

export const money = (amount) => `$${amount.toFixed(2)}`;

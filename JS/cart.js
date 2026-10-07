// Bag shared by the Cellar and Checkout pages. Each line keeps a snapshot of the
// wine (name, price, category, image) so the bag renders before the catalogue
// loads; the server always re-prices the order from Square at checkout.
const STORAGE_KEY = 'winebankCart';

export const MEMBER_DISCOUNT = 0.3;

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
  return { id: wine.id, qty, name: wine.name, price: wine.price, category: wine.category, imageUrl: wine.imageUrl || '' };
}

// Updates names and prices from the latest catalogue and drops wines that are
// no longer sold. Returns the names of removed wines.
export function refreshCart(cart, wines) {
  const byId = new Map(wines.map((wine) => [wine.id, wine]));
  const removed = [];
  const refreshed = cart.flatMap((line) => {
    const wine = byId.get(line.id);
    if (!wine || wine.price === null) { removed.push(line.name); return []; }
    return [snapshot(wine, line.qty)];
  });
  return { cart: refreshed, removed };
}

export function cartTotals(cart, isMember = false) {
  const count = cart.reduce((sum, line) => sum + line.qty, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.qty, 0);
  // Display only: the server re-checks the membership before Square applies the discount.
  const discount = isMember ? Math.round(subtotal * MEMBER_DISCOUNT * 100) / 100 : 0;
  return { count, subtotal, discount, total: subtotal - discount };
}

export const money = (amount) => `$${amount.toFixed(2)}`;

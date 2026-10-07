import { hasVerifiedAge, verifyAge } from './age-verification.js';
import { loadSquareCellar } from './square-catalog.js';
import { cartTotals, escapeHtml, fallbackArt, isSoldOut, maxQuantity, money, readCart, refreshCart, snapshot, stockLabel, wineArt, writeCart } from './cart.js';

let products = [];
let cart = readCart();
let activeFilter = 'all';
const PAGE_SIZE = 48;
let visibleCount = PAGE_SIZE;
const $ = (selector) => document.querySelector(selector);

async function loadProducts() {
  const emptyState = $('#emptyState');
  emptyState.hidden = false;
  emptyState.textContent = 'Loading the cellar…';

  try {
    products = (await loadSquareCellar()).map((wine) => ({
      id: wine.id,
      name: wine.name,
      region: wine.subcategory || wine.categoryLabel,
      year: wine.vintage,
      price: wine.price,
      priceFrom: wine.priceFrom,
      type: wine.category,
      category: wine.category,
      imageUrl: wine.imageUrl,
      stock: wine.stock ?? null,
      fallback: fallbackArt[wine.category] || fallbackArt['red-bottle']
    }));
  } catch (error) {
    console.error('Unable to load wines from Square.', error);
    emptyState.textContent = 'The cellar is temporarily unavailable.';
    return;
  }

  ({ cart } = refreshCart(cart, products));
  saveCart();
  renderProducts();
}

function productPrice(product) {
  if (product.price === null) return '<strong>Price in store</strong>';
  const price = `<strong>${product.priceFrom ? 'From ' : ''}$${product.price.toFixed(2)}</strong>`;
  if (isSoldOut(product)) return `${price}<button class="add-button" type="button" disabled>Sold out</button>`;
  return `${price}<button class="add-button" type="button" data-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to bag">Add to bag</button>`;
}

function productStock(product) {
  const label = stockLabel(product);
  if (!label) return '';
  const tone = isSoldOut(product) ? 'sold-out' : product.stock <= 5 ? 'low' : 'in';
  return `<span class="stock-badge stock-badge--${tone}">${escapeHtml(label)}</span>`;
}

function renderProducts() {
  const query = $('#wineSearch').value.trim().toLowerCase();
  const filtered = products.filter((product) =>
    (activeFilter === 'all' || product.type === activeFilter) &&
    `${product.name} ${product.region}`.toLowerCase().includes(query)
  );
  const sort = $('#wineSort').value;
  const direction = sort === 'price-asc' ? 1 : sort === 'price-desc' ? -1 : 0;
  // Sold-out wines, then wines without a fixed price, always go last.
  filtered.sort((a, b) =>
    isSoldOut(a) - isSoldOut(b) ||
    (direction && ((a.price === null) - (b.price === null) || direction * (a.price - b.price))));
  $('#productGrid').innerHTML = filtered.slice(0, visibleCount).map((product) => `<article class="product-card${isSoldOut(product) ? ' is-sold-out' : ''}"><div class="product-art" style="background:${product.fallback}"><span>${escapeHtml(product.year)}</span>${wineArt(product)}</div><div class="product-info"><p>${escapeHtml(product.region)}</p>${productStock(product)}<h3>${escapeHtml(product.name)}</h3><div>${productPrice(product)}</div></div></article>`).join('');
  $('#emptyState').textContent = 'No wines match your search.';
  $('#emptyState').hidden = filtered.length !== 0;
  $('#showMore').hidden = filtered.length <= visibleCount;
  $('#showMore').textContent = `Show more (${filtered.length - visibleCount} more)`;
}

function resetAndRender() { visibleCount = PAGE_SIZE; renderProducts(); }

function renderCart() {
  const { count, subtotal } = cartTotals(cart);
  $('#cartCount').textContent = count;
  $('#cartItems').innerHTML = cart.length
    ? cart.map((line) => `<div class="cart-item"><div class="cart-thumb" style="background:${fallbackArt[line.category] || fallbackArt['red-bottle']}">${wineArt(line, 'cart-thumb-image')}</div><div><h3>${escapeHtml(line.name)}</h3><p>${money(line.price)}</p><div class="quantity"><button data-dec="${escapeHtml(line.id)}" aria-label="Decrease quantity">−</button><span>${line.qty}</span><button data-inc="${escapeHtml(line.id)}" aria-label="Increase quantity">+</button></div></div><button class="remove-item" data-remove="${escapeHtml(line.id)}" aria-label="Remove item">×</button></div>`).join('')
    : '<p class="cart-empty">Your bag is empty.<br>Explore the featured cellar.</p>';
  $('#cartTotal').textContent = money(subtotal);
  $('#checkoutButton').classList.toggle('is-disabled', !cart.length);
  $('#checkoutButton').setAttribute('aria-disabled', String(!cart.length));
}

function saveCart() { writeCart(cart); renderCart(); }
function showToast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 2200); }
function closeCart() { $('#cartDrawer').classList.remove('open'); $('#drawerBackdrop').classList.remove('show'); $('#cartDrawer').setAttribute('aria-hidden', 'true'); }

if (!hasVerifiedAge()) $('#ageModal').classList.add('show');
$('#confirmAge').addEventListener('click', () => { verifyAge(); $('#ageModal').classList.remove('show'); });
$('#denyAge').addEventListener('click', () => { $('#ageModal .modal-card').innerHTML = '<h2>Thanks for being honest.</h2><p>This website is intended for adults aged 18 and over.</p>'; });
$('#wineSearch').addEventListener('input', resetAndRender);
$('#wineSort').addEventListener('change', resetAndRender);
$('#showMore').addEventListener('click', () => { visibleCount += PAGE_SIZE; renderProducts(); });
$('#openCart').addEventListener('click', () => { $('#cartDrawer').classList.add('open'); $('#drawerBackdrop').classList.add('show'); $('#cartDrawer').setAttribute('aria-hidden', 'false'); });
$('#closeCart').addEventListener('click', closeCart);
$('#drawerBackdrop').addEventListener('click', closeCart);
$('#checkoutButton').addEventListener('click', (event) => { if (!cart.length) { event.preventDefault(); showToast('Your bag is empty'); } });

document.querySelectorAll('.filter-button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.filter-button').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  activeFilter = button.dataset.filter;
  resetAndRender();
}));

document.addEventListener('click', (event) => {
  const add = event.target.closest('[data-add]');
  const inc = event.target.closest('[data-inc]');
  const dec = event.target.closest('[data-dec]');
  const remove = event.target.closest('[data-remove]');
  if (add) {
    const id = add.dataset.add;
    const item = cart.find((entry) => entry.id === id);
    const product = products.find((candidate) => candidate.id === id);
    if (!product || isSoldOut(product)) return;
    if (item && item.qty >= maxQuantity(product)) { showToast(`Only ${product.stock} in stock`); return; }
    if (item) item.qty++; else cart.push(snapshot(product, 1));
    saveCart();
    showToast('Added to your bag');
  }
  if (inc) {
    const item = cart.find((entry) => entry.id === inc.dataset.inc);
    if (item && item.qty >= maxQuantity(item)) { showToast(`Only ${item.stock} in stock`); return; }
    if (item) item.qty++;
    saveCart();
  }
  if (dec) { const item = cart.find((entry) => String(entry.id) === dec.dataset.dec); if (item) { item.qty--; if (item.qty <= 0) cart = cart.filter((entry) => String(entry.id) !== String(item.id)); } saveCart(); }
  if (remove) { cart = cart.filter((item) => String(item.id) !== remove.dataset.remove); saveCart(); }
});

renderCart();
loadProducts();

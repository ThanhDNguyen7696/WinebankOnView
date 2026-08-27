import { hasVerifiedAge, verifyAge } from './age-verification.js';
import { supabase, isSupabaseConfigured } from './supabase-client.js';

const WINE_IMAGE_BUCKET = 'wine-images';
const fallbackArt = {
  red: 'linear-gradient(145deg,#2b0d12,#7b2633)',
  white: 'linear-gradient(145deg,#65552e,#d9c786)',
  sparkling: 'linear-gradient(145deg,#70552e,#e1c782)',
  rose: 'linear-gradient(145deg,#9d5f61,#efc2b6)',
  dessert: 'linear-gradient(145deg,#72512d,#d5a85d)'
};

let products = [];
let cart = JSON.parse(localStorage.getItem('winebankCart') || '[]');
let activeFilter = 'all';
const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function publicImageUrl(imagePath) {
  if (!imagePath || !supabase) return '';
  return supabase.storage.from(WINE_IMAGE_BUCKET).getPublicUrl(imagePath).data.publicUrl;
}

function productArt(product, className = 'product-art-image') {
  if (product.imageUrl) {
    return `<img class="${className}" src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />`;
  }

  return '<div class="bottle" aria-hidden="true"><i></i></div>';
}

async function loadProducts() {
  const emptyState = $('#emptyState');
  emptyState.hidden = false;
  emptyState.textContent = 'Loading the cellar…';

  if (!isSupabaseConfigured) {
    emptyState.textContent = 'The cellar is temporarily unavailable.';
    return;
  }

  const { data, error } = await supabase
    .from('wines')
    .select('id, name, region, vintage, price, wine_type, image_path, display_order')
    .eq('is_published', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Unable to load wines from Supabase.', error);
    emptyState.textContent = `Unable to load the cellar: ${error.message}`;
    return;
  }

  products = (data || []).map((wine) => ({
    id: wine.id,
    name: wine.name,
    region: wine.region,
    year: wine.vintage,
    price: Number(wine.price),
    type: wine.wine_type,
    imageUrl: publicImageUrl(wine.image_path),
    fallback: fallbackArt[wine.wine_type] || fallbackArt.red
  }));

  cart = cart.filter((item) => products.some((product) => product.id === String(item.id)));
  saveCart();
  renderProducts();
}

function renderProducts() {
  const query = $('#wineSearch').value.trim().toLowerCase();
  const filtered = products.filter((product) =>
    (activeFilter === 'all' || product.type === activeFilter) &&
    `${product.name} ${product.region}`.toLowerCase().includes(query)
  );
  $('#productGrid').innerHTML = filtered.map((product) => `<article class="product-card"><div class="product-art" style="background:${product.fallback}"><span>${escapeHtml(product.year)}</span>${productArt(product)}</div><div class="product-info"><p>${escapeHtml(product.region)}</p><h3>${escapeHtml(product.name)}</h3><div><strong>$${product.price.toFixed(2)}</strong><button class="add-button" data-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to bag">Add to bag</button></div></div></article>`).join('');
  $('#emptyState').textContent = 'No wines match your search.';
  $('#emptyState').hidden = filtered.length !== 0;
}

function renderCart() {
  const validItems = cart.filter((item) => products.some((product) => product.id === String(item.id)));
  $('#cartCount').textContent = cart.reduce((sum, item) => sum + item.qty, 0);
  $('#cartItems').innerHTML = validItems.length
    ? validItems.map((item) => { const product = products.find((candidate) => candidate.id === String(item.id)); return `<div class="cart-item"><div class="cart-thumb" style="background:${product.fallback}">${productArt(product, 'cart-thumb-image')}</div><div><h3>${escapeHtml(product.name)}</h3><p>$${product.price.toFixed(2)}</p><div class="quantity"><button data-dec="${escapeHtml(product.id)}" aria-label="Decrease quantity">−</button><span>${item.qty}</span><button data-inc="${escapeHtml(product.id)}" aria-label="Increase quantity">+</button></div></div><button class="remove-item" data-remove="${escapeHtml(product.id)}" aria-label="Remove item">×</button></div>`; }).join('')
    : '<p class="cart-empty">Your bag is empty.<br>Explore the featured cellar.</p>';
  const total = validItems.reduce((sum, item) => sum + products.find((product) => product.id === String(item.id)).price * item.qty, 0);
  $('#cartTotal').textContent = `$${total.toFixed(2)}`;
}

function saveCart() { localStorage.setItem('winebankCart', JSON.stringify(cart)); renderCart(); }
function showToast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 2200); }
function closeCart() { $('#cartDrawer').classList.remove('open'); $('#drawerBackdrop').classList.remove('show'); $('#cartDrawer').setAttribute('aria-hidden', 'true'); }

if (!hasVerifiedAge()) $('#ageModal').classList.add('show');
$('#confirmAge').addEventListener('click', () => { verifyAge(); $('#ageModal').classList.remove('show'); });
$('#denyAge').addEventListener('click', () => { $('#ageModal .modal-card').innerHTML = '<h2>Thanks for being honest.</h2><p>This website is intended for adults aged 18 and over.</p>'; });
$('#wineSearch').addEventListener('input', renderProducts);
$('#openCart').addEventListener('click', () => { $('#cartDrawer').classList.add('open'); $('#drawerBackdrop').classList.add('show'); $('#cartDrawer').setAttribute('aria-hidden', 'false'); });
$('#closeCart').addEventListener('click', closeCart);
$('#drawerBackdrop').addEventListener('click', closeCart);
$('#checkoutButton').addEventListener('click', () => showToast(cart.length ? 'Showcase mode: checkout is not connected' : 'Your bag is empty'));

document.querySelectorAll('.filter-button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.filter-button').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  activeFilter = button.dataset.filter;
  renderProducts();
}));

document.addEventListener('click', (event) => {
  const add = event.target.closest('[data-add]');
  const inc = event.target.closest('[data-inc]');
  const dec = event.target.closest('[data-dec]');
  const remove = event.target.closest('[data-remove]');
  if (add) { const id = add.dataset.add; const item = cart.find((entry) => String(entry.id) === id); item ? item.qty++ : cart.push({ id, qty: 1 }); saveCart(); showToast('Added to your bag'); }
  if (inc) { const item = cart.find((entry) => String(entry.id) === inc.dataset.inc); if (item) item.qty++; saveCart(); }
  if (dec) { const item = cart.find((entry) => String(entry.id) === dec.dataset.dec); if (item) { item.qty--; if (item.qty <= 0) cart = cart.filter((entry) => String(entry.id) !== String(item.id)); } saveCart(); }
  if (remove) { cart = cart.filter((item) => String(item.id) !== remove.dataset.remove); saveCart(); }
});

renderCart();
loadProducts();

import { hasVerifiedAge, verifyAge } from './age-verification.js';

const products = [
  { id: 1, name: 'Heathcote Shiraz', region: 'Heathcote, VIC', year: '2022', price: 42, type: 'red', image: 'linear-gradient(145deg,#2b0d12,#7b2633)' },
  { id: 2, name: 'Bendigo Cabernet', region: 'Bendigo, VIC', year: '2021', price: 48, type: 'red', image: 'linear-gradient(145deg,#261318,#5b2028)' },
  { id: 3, name: 'Yarra Valley Chardonnay', region: 'Yarra Valley, VIC', year: '2023', price: 38, type: 'white', image: 'linear-gradient(145deg,#65552e,#d9c786)' },
  { id: 4, name: 'King Valley Pinot Grigio', region: 'King Valley, VIC', year: '2024', price: 32, type: 'white', image: 'linear-gradient(145deg,#6f7040,#dedca5)' },
  { id: 5, name: 'Tasmanian Brut', region: 'Tamar Valley, TAS', year: 'NV', price: 52, type: 'sparkling', image: 'linear-gradient(145deg,#70552e,#e1c782)' },
  { id: 6, name: 'Pyrenees Rosé', region: 'Pyrenees, VIC', year: '2024', price: 34, type: 'sparkling', image: 'linear-gradient(145deg,#9d5f61,#efc2b6)' }
];

let cart = JSON.parse(localStorage.getItem('winebankCart') || '[]');
let activeFilter = 'all';
const $ = (selector) => document.querySelector(selector);

function renderProducts() {
  const query = $('#wineSearch').value.trim().toLowerCase();
  const filtered = products.filter((product) =>
    (activeFilter === 'all' || product.type === activeFilter) &&
    `${product.name} ${product.region}`.toLowerCase().includes(query)
  );
  $('#productGrid').innerHTML = filtered.map((product) => `<article class="product-card"><div class="product-art" style="background:${product.image}"><span>${product.year}</span><div class="bottle" aria-hidden="true"><i></i></div></div><div class="product-info"><p>${product.region}</p><h3>${product.name}</h3><div><strong>$${product.price.toFixed(2)}</strong><button class="add-button" data-add="${product.id}" aria-label="Add ${product.name} to bag">Add to bag</button></div></div></article>`).join('');
  $('#emptyState').hidden = filtered.length !== 0;
}

function renderCart() {
  $('#cartCount').textContent = cart.reduce((sum, item) => sum + item.qty, 0);
  $('#cartItems').innerHTML = cart.length
    ? cart.map((item) => { const product = products.find((candidate) => candidate.id === item.id); return `<div class="cart-item"><div class="cart-thumb" style="background:${product.image}"></div><div><h3>${product.name}</h3><p>$${product.price.toFixed(2)}</p><div class="quantity"><button data-dec="${product.id}" aria-label="Decrease quantity">−</button><span>${item.qty}</span><button data-inc="${product.id}" aria-label="Increase quantity">+</button></div></div><button class="remove-item" data-remove="${product.id}" aria-label="Remove item">×</button></div>`; }).join('')
    : '<p class="cart-empty">Your bag is empty.<br>Explore the featured cellar.</p>';
  const total = cart.reduce((sum, item) => sum + products.find((product) => product.id === item.id).price * item.qty, 0);
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
  if (add) { const id = Number(add.dataset.add); const item = cart.find((entry) => entry.id === id); item ? item.qty++ : cart.push({ id, qty: 1 }); saveCart(); showToast('Added to your bag'); }
  if (inc) { cart.find((item) => item.id === Number(inc.dataset.inc)).qty++; saveCart(); }
  if (dec) { const item = cart.find((entry) => entry.id === Number(dec.dataset.dec)); item.qty--; if (item.qty <= 0) cart = cart.filter((entry) => entry.id !== item.id); saveCart(); }
  if (remove) { cart = cart.filter((item) => item.id !== Number(remove.dataset.remove)); saveCart(); }
});

renderProducts();
renderCart();

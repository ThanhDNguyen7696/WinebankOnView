import { validEmail } from './common.js';
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

const $ = (s) => document.querySelector(s);
const grid = $('#productGrid');
const toast = $('#toast');

function renderProducts() {
  const query = $('#wineSearch').value.trim().toLowerCase();
  const filtered = products.filter(p => (activeFilter === 'all' || p.type === activeFilter) && `${p.name} ${p.region}`.toLowerCase().includes(query));
  grid.innerHTML = filtered.map(p => `<article class="product-card"><div class="product-art" style="background:${p.image}"><span>${p.year}</span><div class="bottle" aria-hidden="true"><i></i></div></div><div class="product-info"><p>${p.region}</p><h3>${p.name}</h3><div><strong>$${p.price.toFixed(2)}</strong><button class="add-button" data-add="${p.id}" aria-label="Add ${p.name} to bag">Add to bag</button></div></div></article>`).join('');
  $('#emptyState').hidden = filtered.length !== 0;
}

function saveCart() { localStorage.setItem('winebankCart', JSON.stringify(cart)); renderCart(); }
function addToCart(id) { const item = cart.find(i => i.id === id); item ? item.qty++ : cart.push({ id, qty: 1 }); saveCart(); showToast('Added to your bag'); }
function renderCart() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  $('#cartCount').textContent = count;
  if (!cart.length) $('#cartItems').innerHTML = '<p class="cart-empty">Your bag is empty.<br />Explore the featured cellar.</p>';
  else $('#cartItems').innerHTML = cart.map(i => { const p = products.find(x => x.id === i.id); return `<div class="cart-item"><div class="cart-thumb" style="background:${p.image}"></div><div><h3>${p.name}</h3><p>$${p.price.toFixed(2)}</p><div class="quantity"><button data-dec="${p.id}" aria-label="Decrease quantity">−</button><span>${i.qty}</span><button data-inc="${p.id}" aria-label="Increase quantity">+</button></div></div><button class="remove-item" data-remove="${p.id}" aria-label="Remove item">×</button></div>`; }).join('');
  const total = cart.reduce((s, i) => s + products.find(p => p.id === i.id).price * i.qty, 0);
  $('#cartTotal').textContent = `$${total.toFixed(2)}`;
}
function openCart() { $('#cartDrawer').classList.add('open'); $('#drawerBackdrop').classList.add('show'); $('#cartDrawer').setAttribute('aria-hidden','false'); }
function closeCart() { $('#cartDrawer').classList.remove('open'); $('#drawerBackdrop').classList.remove('show'); $('#cartDrawer').setAttribute('aria-hidden','true'); }
function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }

if (!hasVerifiedAge()) $('#ageModal').classList.add('show');
$('#confirmAge').addEventListener('click', () => { verifyAge(); $('#ageModal').classList.remove('show'); });
$('#denyAge').addEventListener('click', () => { $('#ageModal .modal-card').innerHTML = '<h2>Thanks for being honest.</h2><p>This website is intended for adults aged 18 and over.</p>'; });
$('.menu-toggle').addEventListener('click', e => { const nav = $('.site-nav'); nav.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', nav.classList.contains('open')); });
$('.site-nav').addEventListener('click', e => { if (e.target.matches('a')) $('.site-nav').classList.remove('open'); });

document.addEventListener('click', e => {
  const add = e.target.closest('[data-add]'); if (add) addToCart(Number(add.dataset.add));
  const inc = e.target.closest('[data-inc]'); if (inc) { cart.find(i => i.id === Number(inc.dataset.inc)).qty++; saveCart(); }
  const dec = e.target.closest('[data-dec]'); if (dec) { const item = cart.find(i => i.id === Number(dec.dataset.dec)); item.qty--; if (item.qty <= 0) cart = cart.filter(i => i.id !== item.id); saveCart(); }
  const rem = e.target.closest('[data-remove]'); if (rem) { cart = cart.filter(i => i.id !== Number(rem.dataset.remove)); saveCart(); }
});

document.querySelectorAll('.filter-button').forEach(btn => btn.addEventListener('click', () => { document.querySelectorAll('.filter-button').forEach(b => b.classList.remove('active')); btn.classList.add('active'); activeFilter = btn.dataset.filter; renderProducts(); }));
$('#wineSearch').addEventListener('input', renderProducts);
$('#openCart').addEventListener('click', openCart); $('#closeCart').addEventListener('click', closeCart); $('#drawerBackdrop').addEventListener('click', closeCart);
$('#checkoutButton').addEventListener('click', () => showToast(cart.length ? 'Showcase mode: checkout is not connected' : 'Your bag is empty'));
document.querySelectorAll('.event-button').forEach(b => b.addEventListener('click', () => { $('#contactMessage').value = `I am interested in the ${b.dataset.event}.`; $('#contact').scrollIntoView(); }));
$('#contactForm').addEventListener('submit', e => { e.preventDefault(); const email = $('#contactEmail').value.trim(); const status = $('#contactStatus'); if (!$('#contactName').value.trim() || !validEmail(email) || !$('#contactMessage').value.trim()) { status.textContent = 'Please complete all fields with a valid email.'; return; } status.textContent = 'Thanks — your showcase enquiry has been recorded.'; e.target.reset(); });

renderProducts(); renderCart();

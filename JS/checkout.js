import { loadSquareCellar } from './square-catalog.js';
import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { cartTotals, escapeHtml, fallbackArt, maxQuantity, money, readCart, refreshCart, stockLabel, wineArt, writeCart } from './cart.js';

const $ = (selector) => document.querySelector(selector);
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

let cart = readCart();
let session = null;
let isMember = false;
let discountPercent = 30;

function render() {
  $('#checkoutEmpty').hidden = cart.length > 0;
  $('#checkoutLayout').hidden = cart.length === 0;
  if (!cart.length) return;

  $('#checkoutLines').innerHTML = cart.map((line) => `<div class="checkout-line">
    <div class="cart-thumb" style="background:${fallbackArt[line.category] || fallbackArt['red-bottle']}">${wineArt(line, 'cart-thumb-image')}</div>
    <div>
      <h3>${escapeHtml(line.name)}</h3>
      ${line.stock !== null && line.stock <= 5 ? `<p class="checkout-stock">${escapeHtml(stockLabel(line))}</p>` : ''}
      <div class="quantity"><button type="button" data-dec="${escapeHtml(line.id)}" aria-label="Decrease quantity">−</button><span>${line.qty}</span><button type="button" data-inc="${escapeHtml(line.id)}" aria-label="Increase quantity">+</button></div>
      <button class="checkout-remove" type="button" data-remove="${escapeHtml(line.id)}">Remove</button>
    </div>
    <strong>${money(line.price * line.qty)}</strong>
  </div>`).join('');

  const totals = cartTotals(cart, isMember ? discountPercent : 0);
  $('#summarySubtotal').textContent = money(totals.subtotal);
  $('#summaryDiscountRow').hidden = !totals.discount;
  $('#summaryDiscount').textContent = `−${money(totals.discount)}`;
  $('#summaryTotal').textContent = money(totals.total);
}

function save() { writeCart(cart); render(); }

function showNotice(message) {
  $('#checkoutNotice').textContent = message;
  $('#checkoutNotice').hidden = !message;
}

function showError(message) {
  $('#checkoutError').textContent = message;
  $('#checkoutError').hidden = !message;
}

// Refresh names and prices from Square in the background.
async function refreshFromSquare() {
  try {
    const result = refreshCart(cart, await loadSquareCellar());
    cart = result.cart;
    const notices = [];
    if (result.removed.length) notices.push(`Sold out or no longer available, removed from your bag: ${result.removed.join(', ')}.`);
    if (result.reduced.length) notices.push(`Quantity lowered to the stock available: ${result.reduced.join(', ')}.`);
    if (notices.length) showNotice(notices.join(' '));
    save();
  } catch (error) {
    console.warn('Unable to refresh the bag from Square.', error);
  }
}

// The discount rate is set by admins in Supabase (shop_settings).
async function loadDiscountPercent() {
  const { data, error } = await supabase
    .from('shop_settings')
    .select('member_discount_percent')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return;
  discountPercent = data.member_discount_percent;
  document.querySelectorAll('[data-discount-percent]').forEach((element) => { element.textContent = discountPercent; });
  if (!discountPercent) $('#memberMessage').textContent = 'Member pricing is not available for online orders at the moment.';
}

async function loadMember() {
  if (!isSupabaseConfigured) return;
  await loadDiscountPercent();
  ({ data: { session } } = await supabase.auth.getSession());
  if (!session) return;

  const metadata = session.user.user_metadata || {};
  const fullName = [metadata.first_name, metadata.last_name].filter(Boolean).join(' ');
  if (fullName && !$('#pickupName').value) $('#pickupName').value = fullName;
  if (!$('#pickupEmail').value) $('#pickupEmail').value = session.user.email || '';

  const { data } = await supabase
    .from('memberships')
    .select('status, expiry_date')
    .eq('user_id', session.user.id)
    .maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  isMember = data?.status === 'active' && (!data.expiry_date || data.expiry_date >= today);

  $('#memberMessage').textContent = !isMember
    ? 'Your account does not have an active membership, so standard prices apply. Contact WineBank staff to join or renew.'
    : discountPercent
      ? `Your ${discountPercent}% member discount has been applied.`
      : 'Member pricing is not available for online orders at the moment.';
  $('#memberBox').classList.toggle('is-member', isMember && discountPercent > 0);
  render();
}

async function pay(event) {
  event.preventDefault();
  showError('');

  const name = $('#pickupName').value.trim();
  const email = $('#pickupEmail').value.trim();
  if (!name) { showError('Please enter your full name.'); $('#pickupName').focus(); return; }
  if (!validEmail(email)) { showError('Please enter a valid email address.'); $('#pickupEmail').focus(); return; }
  if (!$('#ageConfirm').checked) { showError('Please confirm you are 18 or older.'); $('#ageConfirm').focus(); return; }

  const button = $('#payButton');
  button.disabled = true;
  button.textContent = 'Opening secure checkout…';
  try {
    const response = await fetch('/api/square-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({
        items: cart.map(({ id, qty }) => ({ id, qty })),
        name,
        email,
        phone: $('#pickupPhone').value.trim()
      })
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 409) await refreshFromSquare();
    if (!response.ok || !body.url) throw new Error(body.error || 'Checkout is temporarily unavailable.');
    window.location.href = body.url;
  } catch (error) {
    showError(error.message);
    resetPayButton();
  }
}

function resetPayButton() {
  $('#payButton').disabled = false;
  $('#payButton').textContent = 'Pay securely with Square';
}

$('#checkoutForm').addEventListener('submit', pay);

// Coming back from Square with the browser's Back button restores this page
// exactly as it was left (back/forward cache), including the disabled
// "Opening secure checkout…" button. Reset it and re-read the bag, which may
// have been emptied after a completed payment.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  resetPayButton();
  showError('');
  cart = readCart();
  render();
  refreshFromSquare();
});

$('#checkoutLines').addEventListener('click', (event) => {
  const inc = event.target.closest('[data-inc]');
  const dec = event.target.closest('[data-dec]');
  const remove = event.target.closest('[data-remove]');
  if (inc) {
    const line = cart.find((entry) => entry.id === inc.dataset.inc);
    if (line && line.qty >= maxQuantity(line)) showNotice(`Only ${line.stock} of ${line.name} in stock.`);
    else if (line) line.qty += 1;
  }
  if (dec) { const line = cart.find((entry) => entry.id === dec.dataset.dec); if (line) line.qty -= 1; cart = cart.filter((entry) => entry.qty > 0); }
  if (remove) cart = cart.filter((entry) => entry.id !== remove.dataset.remove);
  if (inc || dec || remove) save();
});

render();
refreshFromSquare();
loadMember();

import { validEmail } from './common.js';

const functionModal = document.querySelector('#functionModal');
const functionForm = document.querySelector('#functionForm');
let functionFormTrigger = null;

const closeFunctionForm = () => {
  if (!functionModal) return;
  functionModal.classList.remove('show');
  functionModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('function-modal-open');
  functionFormTrigger?.focus();
};

document.addEventListener('click', (event) => {
  const openButton = event.target.closest('[data-open-function-form]');
  if (openButton && functionModal) {
    functionFormTrigger = openButton;
    functionModal.classList.add('show');
    functionModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('function-modal-open');
    window.setTimeout(() => document.querySelector('#functionName')?.focus(), 0);
    return;
  }

  if (event.target.closest('[data-close-function-form]') || event.target === functionModal) {
    closeFunctionForm();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && functionModal?.classList.contains('show')) closeFunctionForm();
});

functionForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.querySelector('#functionName').value.trim();
  const email = document.querySelector('#functionEmail').value.trim();
  const phone = document.querySelector('#functionPhone').value.trim();
  const subject = document.querySelector('#functionSubject').value.trim() || 'Private function enquiry';
  const message = document.querySelector('#functionMessage').value.trim();
  const status = document.querySelector('#functionFormStatus');

  if (!name || !validEmail(email) || !message) {
    status.textContent = 'Please enter your name, a valid email address and a message.';
    return;
  }

  const body = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || 'Not provided'}`,
    '',
    message
  ].join('\n');

  status.textContent = 'Your email application should now open. Please review and send your enquiry.';
  window.location.href = `mailto:admin@winebankonview.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

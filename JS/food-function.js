import { validEmail } from './common.js';
import { sendFunctionEnquiry } from './function-enquiry-service.js';

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

functionForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.querySelector('#functionName').value.trim();
  const email = document.querySelector('#functionEmail').value.trim();
  const phone = document.querySelector('#functionPhone').value.trim();
  const subject = document.querySelector('#functionSubject').value.trim() || 'Private function enquiry';
  const message = document.querySelector('#functionMessage').value.trim();
  const website = functionForm.elements.website?.value || '';
  const status = document.querySelector('#functionFormStatus');
  const submitButton = functionForm.querySelector('button[type="submit"]');

  if (!name || !validEmail(email) || !message) {
    status.textContent = 'Please enter your name, a valid email address and a message.';
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Sending…';
  status.textContent = 'Sending your enquiry…';

  try {
    await sendFunctionEnquiry({ name, email, phone, subject, message, website });
    status.textContent = 'Thank you — your function enquiry has been sent successfully.';
    functionForm.reset();
    document.querySelector('#functionSubject').value = 'Private function enquiry';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Send enquiry';
  }
});

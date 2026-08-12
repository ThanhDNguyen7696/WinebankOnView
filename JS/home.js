import { validEmail } from './common.js';
import { hasVerifiedAge, verifyAge } from './age-verification.js';

const $ = (s) => document.querySelector(s);

if (!hasVerifiedAge()) $('#ageModal').classList.add('show');
$('#confirmAge').addEventListener('click', () => { verifyAge(); $('#ageModal').classList.remove('show'); });
$('#denyAge').addEventListener('click', () => { $('#ageModal .modal-card').innerHTML = '<h2>Thanks for being honest.</h2><p>This website is intended for adults aged 18 and over.</p>'; });
document.querySelectorAll('.event-button').forEach(b => b.addEventListener('click', () => { $('#contactMessage').value = `I am interested in the ${b.dataset.event}.`; $('#contact').scrollIntoView(); }));
$('#contactForm').addEventListener('submit', e => { e.preventDefault(); const email = $('#contactEmail').value.trim(); const status = $('#contactStatus'); if (!$('#contactName').value.trim() || !validEmail(email) || !$('#contactMessage').value.trim()) { status.textContent = 'Please complete all fields with a valid email.'; return; } status.textContent = 'Thanks — your showcase enquiry has been recorded.'; e.target.reset(); });

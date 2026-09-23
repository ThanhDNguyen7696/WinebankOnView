import { validEmail } from './common.js';
import { hasVerifiedAge, verifyAge } from './age-verification.js';
import { supabase, isSupabaseConfigured } from './supabase-client.js';

const $ = (s) => document.querySelector(s);

const setupSlideshow = (selector, delay) => {
  const slides = [...document.querySelectorAll(selector)];
  if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let activeSlide = 0;
  window.setInterval(() => {
    slides[activeSlide].classList.remove('is-active');
    activeSlide = (activeSlide + 1) % slides.length;
    slides[activeSlide].classList.add('is-active');
  }, delay);
};

setupSlideshow('.hero-slide', 6500);
setupSlideshow('.experience-slide', 5500);

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatEventDate = (value) => {
  const date = new Date(`${value}T00:00:00`);
  const day = new Intl.DateTimeFormat('en-AU', { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('en-AU', { month: 'short' }).format(date).toUpperCase();
  return `${day} ${month}`;
};

const eventImageUrl = (path) => path
  ? supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl
  : '';

const safeRegistrationUrl = (value, title) => {
  if (value) {
    try {
      const url = new URL(value);
      if (['http:', 'https:'].includes(url.protocol)) return url.href;
    } catch {
      // Fall back to the venue email link below.
    }
  }
  return `mailto:info@winebank.com.au?subject=${encodeURIComponent(`Interest in ${title}`)}`;
};

async function loadPublishedEvents() {
  if (!isSupabaseConfigured) return;
  const eventGrid = $('#eventGrid');
  const status = $('#eventsStatus');
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('events')
    .select('id, title, event_date, start_time, short_description, registration_url, image_path, display_order')
    .eq('status', 'published')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .order('display_order', { ascending: true })
    .limit(12);

  if (error) {
    console.warn('Unable to load published events.', error);
    return;
  }
  if (!data?.length) return;

  eventGrid.innerHTML = data.map((event) => {
    const imageUrl = eventImageUrl(event.image_path);
    const registrationUrl = safeRegistrationUrl(event.registration_url, event.title);
    return `<article${imageUrl ? ' class="has-image"' : ''}>
      <p class="event-date">${escapeHtml(formatEventDate(event.event_date))}</p>
      ${imageUrl ? `<img class="event-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(event.title)}" loading="lazy" />` : ''}
      <div>
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.short_description)}</p>
        ${event.start_time ? `<small>${escapeHtml(event.start_time.slice(0, 5))}</small>` : ''}
      </div>
      <a class="secondary-button event-button" href="${escapeHtml(registrationUrl)}"${/^https?:/i.test(registrationUrl) ? ' target="_blank" rel="noopener"' : ''}>Register interest</a>
    </article>`;
  }).join('');
  status.textContent = '';
}

loadPublishedEvents();

if (!hasVerifiedAge()) $('#ageModal').classList.add('show');
$('#confirmAge').addEventListener('click', () => { verifyAge(); $('#ageModal').classList.remove('show'); });
$('#denyAge').addEventListener('click', () => { $('#ageModal .modal-card').innerHTML = '<h2>Thanks for being honest.</h2><p>This website is intended for adults aged 18 and over.</p>'; });
document.addEventListener('click', (event) => {
  const button = event.target.closest('.event-button[data-event]');
  if (!button) return;
  const contactMessage = $('#contactMessage');
  if (contactMessage) {
    contactMessage.value = `I am interested in the ${button.dataset.event}.`;
    $('#contact')?.scrollIntoView();
  } else {
    window.location.href = `mailto:info@winebank.com.au?subject=${encodeURIComponent(`Interest in ${button.dataset.event}`)}`;
  }
});

const contactForm = $('#contactForm');
if (contactForm) contactForm.addEventListener('submit', e => {
  e.preventDefault();
  const email = $('#contactEmail').value.trim();
  const status = $('#contactStatus');
  if (!$('#contactName').value.trim() || !validEmail(email) || !$('#contactMessage').value.trim()) {
    status.textContent = 'Please complete all fields with a valid email.';
    return;
  }
  status.textContent = 'Thanks — your showcase enquiry has been recorded.';
  e.target.reset();
});

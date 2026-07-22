/* ============================================================
   AUTO PALETTE — Main JavaScript
   Scroll reveal + navbar + counters + FAQ + price estimator
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initNavbar();
  initCounterAnimation();
  initFaq();
  initPriceEstimator();
  initMagneticButtons();
  document.querySelector('.hero')?.classList.add('loaded');
});

// ---- SCROLL REVEAL ENGINE ----
function initScrollReveal() {
  if (initScrollReveal.__init) return;          // idempotent — safe to call more than once
  initScrollReveal.__init = true;

  const revealElements = Array.from(
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale')
  );
  if (!revealElements.length) return;

  const activate = (el) => el.classList.add('active');

  // Respect reduced-motion: show everything immediately, no animation dependency.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealElements.forEach(activate);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        activate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  revealElements.forEach((el) => observer.observe(el));
}

// ---- NAVBAR SCROLL EFFECT ----
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  }, { passive: true });
}

// ---- ANIMATED COUNTERS ----
function initCounterAnimation() {
  const counters = document.querySelectorAll('[data-count]');

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.dataset.count);
        const suffix = entry.target.dataset.suffix || '';
        animateCounter(entry.target, 0, target, 2000, suffix);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => counterObserver.observe(counter));
}

function animateCounter(el, start, end, duration, suffix) {
  const range = end - start;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out quad
    const eased = 1 - (1 - progress) * (1 - progress);
    const current = Math.floor(start + range * eased);
    el.textContent = current + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// ---- SMOOTH SCROLL ANCHORS ----
document.addEventListener('click', (e) => {
  const anchor = e.target.closest('a[href^="#"]');
  if (anchor) {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
});

// ---- CONTACT FORM HANDLER ----
// NOTE: the real enquiry submit handler lives in index.html and opens WhatsApp with
// the customer's details. A second "fake success" handler used to live here and
// showed "✓ REQUEST RECEIVED" WITHOUT sending anything — it was deleted because it
// silently lost leads (e.g. when the WhatsApp popup was blocked). Do not re-add it.

// ---- MOBILE MENU ----
document.addEventListener('click', (e) => {
  if (e.target.closest('.hamburger')) {
    document.querySelector('.nav-links')?.classList.toggle('open');
  }
});

// ---- HOVER TILT ON SERVICE CARDS ----
document.addEventListener('mousemove', (e) => {
  const card = e.target.closest('.service-card');
  if (!card) return;

  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const tiltX = (y - centerY) / centerY * 3;
  const tiltY = (centerX - x) / centerX * 3;

  card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-8px)`;
});

document.addEventListener('mouseleave', (e) => {
  // On a document-level mouseleave e.target can be `document` (no .closest) — guard it.
  const t = e.target;
  if (t instanceof Element) {
    const card = t.closest('.service-card');
    if (card) card.style.transform = '';
  }
}, true);

// ---- FAQ ACCORDION ----
function initFaq() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-btn');
    const content = item.querySelector('.faq-content');
    btn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(i => {
        i.classList.remove('active');
        i.querySelector('.faq-content').style.maxHeight = null;
      });
      if (!isActive) {
        item.classList.add('active');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });
}

// ---- PRICE ESTIMATOR ----
// Static price table — values unchanged from the pre-rebuild version; only the
// output copy/framing and the primary CTA destination changed (see index.html).
function initPriceEstimator() {
  const prices = {
    hatchback: { ppf: '35,000', ceramic: '8,000', detailing: '3,500' },
    sedan:     { ppf: '45,000', ceramic: '12,000', detailing: '5,000' },
    suv:       { ppf: '65,000', ceramic: '18,000', detailing: '7,500' }
  };
  const durations = {
    ppf: '3-5 Days', ceramic: '1-2 Days', detailing: '1 Day'
  };

  let selectedVehicle = 'hatchback';
  let selectedService = 'ppf';

  function updateQuote() {
    const priceEl = document.getElementById('estimated-price');
    const durEl = document.getElementById('quote-duration');
    if (priceEl) priceEl.textContent = prices[selectedVehicle][selectedService];
    if (durEl) durEl.textContent = durations[selectedService];
  }

  document.querySelectorAll('#vehicle-type .option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#vehicle-type .option-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedVehicle = btn.dataset.value;
      updateQuote();
    });
  });

  document.querySelectorAll('#service-type .option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#service-type .option-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedService = btn.dataset.value;
      updateQuote();
    });
  });

  // Expose sendQuoteWa globally — secondary WhatsApp path from the estimator
  // (primary path is the "CONTINUE TO BOOKING" link to /app/#/book in index.html).
  window.sendQuoteWa = function() {
    const price = prices[selectedVehicle][selectedService];
    const svc = selectedService.toUpperCase();
    const veh = selectedVehicle.charAt(0).toUpperCase() + selectedVehicle.slice(1);
    const msg = encodeURIComponent(
      `🛡️ *Auto Palette — Quote Request*\n\n` +
      `*Vehicle Type:* ${veh}\n` +
      `*Service:* ${svc}\n` +
      `*Typical Starting Price:* ₹${price}\n` +
      `*Duration:* ${durations[selectedService]}\n\n` +
      `I'd like to confirm this on inspection and book a slot.`
    );
    window.open('https://wa.me/918884471117?text=' + msg, '_blank');
  };

  updateQuote();
}

// ---- MAGNETIC BUTTONS ----
function initMagneticButtons() {
  const btns = document.querySelectorAll('.btn-primary, .btn-secondary, .nav-cta');
  btns.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width/2) * 0.25;
      const y = (e.clientY - rect.top - rect.height/2) * 0.25;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.transition = 'transform 0.4s var(--ease-spring)';
    });
  });
}

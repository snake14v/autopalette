/* ============================================================
   AUTO PALETTE — Main JavaScript
   NFS Tachometer Entrance + Scroll Reveal + Parallax Engine
   ============================================================ */

// ---- ENTRANCE GATE: ENGINE START ENGINE ----
document.addEventListener('DOMContentLoaded', () => {
  const gate = document.getElementById('entrance-gate');
  const counterEl = document.getElementById('gate-counter-num');
  const needle = document.getElementById('tacho-needle');
  const tagline = document.getElementById('gate-tagline');

  // Boot the whole site IMMEDIATELY. Page content is visible by default and must
  // never wait on — or be blocked by — the cosmetic intro. All inits are idempotent.
  const bootSite = () => {
    initScrollReveal();
    initParallax();
    initNavbar();
    initCounterAnimation();
    initCustomCursor();
    initVectorParallax();
    initFaq();
    initPriceEstimator();
    initMagneticButtons();
    document.querySelector('.hero')?.classList.add('loaded');
  };
  bootSite();

  // The intro tachometer is just a dismissible overlay ON TOP of the live page.
  let dismissed = false;
  const dismissGate = () => {
    if (dismissed) return;
    dismissed = true;
    try { sessionStorage.setItem('ap_seen', '1'); } catch (e) {}
    if (gate) {
      gate.classList.add('fade-out');
      setTimeout(() => { gate.style.display = 'none'; }, 600);
    }
  };

  // Auto-skip the intro entirely for: no gate, reduced-motion, phones, or repeat visits.
  let seen = false; try { seen = sessionStorage.getItem('ap_seen') === '1'; } catch (e) {}
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  if (!gate || seen || reduce || small) {
    if (gate) gate.style.display = 'none';
    return;
  }

  // Let the visitor bail out at any moment (button / tap / scroll / key).
  document.getElementById('gate-skip')?.addEventListener('click', dismissGate);
  ['keydown', 'touchstart', 'wheel'].forEach((evt) =>
    window.addEventListener(evt, dismissGate, { once: true, passive: true })
  );
  // Hard cap: the intro can NEVER hold the page longer than ~2.2s.
  const capTimer = setTimeout(dismissGate, 2200);

  // Short cosmetic rev sweep, then auto-dismiss.
  const startTime = performance.now();
  const duration = 1500;
  function animateEngine(time) {
    if (dismissed) return;
    const elapsed = time - startTime;
    const rev = Math.min(100, (elapsed / duration) * 100);
    if (counterEl) counterEl.textContent = Math.floor(rev);
    if (needle) needle.setAttribute('transform', `rotate(${-135 + (rev / 100) * 270} 150 150)`);
    if (elapsed < duration) {
      requestAnimationFrame(animateEngine);
    } else {
      if (needle) { needle.setAttribute('stroke', '#ff1a1a'); needle.classList.add('rgb-redline'); }
      if (tagline) tagline.style.opacity = '1';
      clearTimeout(capTimer);
      setTimeout(dismissGate, 250);
    }
  }
  requestAnimationFrame(animateEngine);
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

  // Belt-and-suspenders: a scroll/resize check that can never leave content
  // stuck hidden even if the IntersectionObserver misfires or inits offscreen.
  const checkInView = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    for (const el of revealElements) {
      if (el.classList.contains('active')) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh * 0.92) {
        activate(el);
        observer.unobserve(el);
      }
    }
  };
  checkInView();
  window.addEventListener('scroll', checkInView, { passive: true });
  window.addEventListener('resize', checkInView, { passive: true });
}

// ---- PARALLAX SCROLLING ----
function initParallax() {
  const parallaxElements = document.querySelectorAll('[data-parallax]');
  
  window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset;

    parallaxElements.forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.3;
      const rect = el.getBoundingClientRect();
      const offset = (rect.top + scrollY - window.innerHeight / 2) * speed;
      el.style.transform = `translateY(${offset}px)`;
    });
  }, { passive: true });
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

// ---- CUSTOM CURSOR ----
function initCustomCursor() {
  const cursor = document.getElementById('custom-cursor');
  const dot = document.getElementById('custom-cursor-dot');
  if(!cursor || !dot) return;

  let mouseX = 0;
  let mouseY = 0;
  let cursorX = 0;
  let cursorY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.transform = `translate(${mouseX - 3}px, ${mouseY - 3}px)`;
  });

  function render() {
    cursorX += (mouseX - cursorX) * 0.2;
    cursorY += (mouseY - cursorY) * 0.2;
    cursor.style.transform = `translate(${cursorX - 15}px, ${cursorY - 15}px)`;
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  const hoverElements = document.querySelectorAll('a, button, .service-card, .gallery-item, .wa-chip');
  hoverElements.forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });
}

// ---- VECTOR MOUSE PARALLAX ----
function initVectorParallax() {
  const v1 = document.querySelector('.v1');
  const v2 = document.querySelector('.v2');
  const v3 = document.querySelector('.v3');

  document.addEventListener('mousemove', (e) => {
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;

    if(v1) v1.style.transform = `translate(${x * -50}px, ${y * -50}px) rotate(${x * 20}deg)`;
    if(v2) v2.style.transform = `translate(${x * 80}px, ${y * 80}px) rotate(${x * -20}deg)`;
    if(v3) v3.style.transform = `translate(${x * -30}px, ${y * -30}px)`;
  });
}

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

  // Expose sendQuoteWa globally
  window.sendQuoteWa = function() {
    const price = prices[selectedVehicle][selectedService];
    const svc = selectedService.toUpperCase();
    const veh = selectedVehicle.charAt(0).toUpperCase() + selectedVehicle.slice(1);
    const msg = encodeURIComponent(
      `🛡️ *Auto Palette — Quote Request*\n\n` +
      `*Vehicle Type:* ${veh}\n` +
      `*Service:* ${svc}\n` +
      `*Estimated Price:* ₹${price}\n` +
      `*Duration:* ${durations[selectedService]}\n\n` +
      `I'd like to confirm this quote and book a slot.`
    );
    window.open('https://wa.me/918884471117?text=' + msg, '_blank');
  };

  updateQuote();
}

// ---- MAGNETIC BUTTONS ----
function initMagneticButtons() {
  const btns = document.querySelectorAll('.btn-primary, .btn-secondary, .nav-cta, .offer-cta');
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

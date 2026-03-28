/* ============================================================
   AUTO PALETTE — Main JavaScript
   NFS Tachometer Entrance + Scroll Reveal + Parallax Engine
   ============================================================ */

// ---- ENTRANCE GATE: NFS TACHOMETER LOADING ----
document.addEventListener('DOMContentLoaded', () => {
  const gate = document.getElementById('entrance-gate');
  const mainContent = document.getElementById('main-content');
  const counterEl = document.getElementById('gate-counter-num');
  const needle = document.getElementById('tacho-needle');
  const tagline = document.querySelector('.gate-tagline');
  const btnEnter = document.getElementById('btn-enter');

  let count = 0;
  const targetCount = 100;
  const duration = 2500; // ms
  const interval = duration / targetCount;

  // Animate tachometer counter from 0 to 100
  const counterInterval = setInterval(() => {
    count++;
    if (counterEl) counterEl.textContent = count;

    // Rotate needle — from -135deg to 135deg
    const rotation = -135 + (count / targetCount) * 270;
    if (needle) needle.setAttribute('transform', `rotate(${rotation} 150 150)`);

    if (count >= targetCount) {
      clearInterval(counterInterval);

      // Show tagline and enter button
      setTimeout(() => {
        if (tagline) tagline.classList.add('visible');
      }, 300);
      setTimeout(() => {
        if (btnEnter) btnEnter.classList.add('visible');
      }, 800);
    }
  }, interval);

  // Enter button click handler
  if (btnEnter) {
    btnEnter.addEventListener('click', () => {
      gate.classList.add('fade-out');
      setTimeout(() => {
        gate.style.display = 'none';
        if (mainContent) {
          mainContent.style.display = 'block';
          mainContent.style.opacity = '0';
          // Trigger reflow
          void mainContent.offsetHeight;
          mainContent.style.transition = 'opacity 1.5s ease';
          mainContent.style.opacity = '1';

          // Init all animations after content is visible
          setTimeout(() => {
            initScrollReveal();
            initParallax();
            initNavbar();
            initCounterAnimation();
            document.querySelector('.hero')?.classList.add('loaded');
          }, 100);
        }
      }, 1200);
    });
  }
});

// ---- SCROLL REVEAL ENGINE ----
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => observer.observe(el));
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
document.addEventListener('submit', (e) => {
  if (e.target.id === 'enquiry-form') {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.textContent;

    btn.textContent = 'TRANSMITTING...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    setTimeout(() => {
      btn.textContent = '✓ REQUEST RECEIVED';
      btn.style.background = '#1db954';
      btn.style.opacity = '1';
      e.target.reset();

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.disabled = false;
      }, 3000);
    }, 1500);
  }
});

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
  if (e.target.closest('.service-card')) {
    e.target.closest('.service-card').style.transform = '';
  }
}, true);

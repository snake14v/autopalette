/* ============================================================
   AUTO PALETTE — Main JavaScript
   NFS Tachometer Entrance + Scroll Reveal + Parallax Engine
   ============================================================ */

// ---- ENTRANCE GATE: ENGINE START ENGINE ----
document.addEventListener('DOMContentLoaded', () => {
  const gate = document.getElementById('entrance-gate');
  const mainContent = document.getElementById('main-content');
  const counterEl = document.getElementById('gate-counter-num');
  const needle = document.getElementById('tacho-needle');
  const tagline = document.getElementById('gate-tagline');

  // Start engine animation automatically after a short delay
  setTimeout(() => {
    // Rev curve: idle -> rev -> drop -> redline
    const revSequence = [
      { t: 0, val: 0 },
      { t: 400, val: 25 },
      { t: 900, val: 65 },
      { t: 1200, val: 40 },
      { t: 1800, val: 85 },
      { t: 2000, val: 70 },
      { t: 2800, val: 100 }
    ];

    const startTime = performance.now();
    const duration = 2800; // total ms

    function interpolateRev(elapsed) {
      if (elapsed >= duration) return 100;
      for (let i = 0; i < revSequence.length - 1; i++) {
        const p1 = revSequence[i];
        const p2 = revSequence[i+1];
        if (elapsed >= p1.t && elapsed <= p2.t) {
          const progress = (elapsed - p1.t) / (p2.t - p1.t);
          // Ease in out quad
          const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          return p1.val + (p2.val - p1.val) * ease;
        }
      }
      return 100;
    }

    function animateEngine(time) {
      const elapsed = time - startTime;
      const currentRev = interpolateRev(elapsed);
      
      if (counterEl) counterEl.textContent = Math.floor(currentRev);

      // Rotate needle — from -135deg to 135deg
      const rotation = -135 + (currentRev / 100) * 270;
      if (needle) needle.setAttribute('transform', `rotate(${rotation} 150 150)`);

      if (elapsed < duration) {
        requestAnimationFrame(animateEngine);
      } else {
        // Hit 100% - Redline!
        if (needle) {
          needle.setAttribute('stroke', '#ff1a1a'); // needle turns red
          needle.classList.add('rgb-redline');
        }
        if (gate) gate.classList.add('gate-shake');
        tagline.style.opacity = '1';
        
        // Add white flash to body
        const flash = document.createElement('div');
        flash.className = 'flash-bang';
        document.body.appendChild(flash);

        // Open vault
        setTimeout(() => {
          gate.classList.add('fade-out');
          setTimeout(() => {
            gate.style.display = 'none';
            if (mainContent) {
              mainContent.style.display = 'block';
              mainContent.style.opacity = '0';
              void mainContent.offsetHeight;
              mainContent.style.transition = 'opacity 1.5s ease';
              mainContent.style.opacity = '1';

              setTimeout(() => {
                initScrollReveal();
                initParallax();
                initNavbar();
                initCounterAnimation();
                initCustomCursor();
                initVectorParallax();
                initFaq();
                initTransformationSlider();
                initMagneticButtons();
                document.querySelector('.hero')?.classList.add('loaded');
                flash.remove();
              }, 100);
            }
          }, 1200);
        }, 500);
      }
    }

    requestAnimationFrame(animateEngine);
  }, 500); // 500ms delay before animation starts
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

// ---- TRANSFORMATION SLIDER ----
function initTransformationSlider() {
  const slider = document.getElementById('ba-slider');
  const handle = document.getElementById('ba-handle');
  const overlay = document.getElementById('ba-before');
  if(!slider || !handle || !overlay) return;

  const moveSlider = (e) => {
    const rect = slider.getBoundingClientRect();
    let x = ((e.clientX || (e.touches && e.touches[0].clientX)) - rect.left);
    if (x < 0) x = 0; if (x > rect.width) x = rect.width;
    const p = (x / rect.width) * 100;
    handle.style.left = p + '%';
    overlay.style.width = p + '%';
  };

  slider.addEventListener('mousemove', moveSlider);
  slider.addEventListener('touchmove', (e) => { moveSlider(e); }, {passive: false});
}

// ---- MAGNETIC BUTTONS ----
function initMagneticButtons() {
  const btns = document.querySelectorAll('.btn-primary, .btn-secondary, .nav-cta, .offer-cta');
  btns.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width/2) * 0.35;
      const y = (e.clientY - rect.top - rect.height/2) * 0.35;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('mouseleave', () => btn.style.transform = '');
  });
}

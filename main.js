document.addEventListener('DOMContentLoaded', () => {
  const btnEnter = document.getElementById('btn-enter');
  const gateOverlay = document.getElementById('entrance-gate');
  const mainContent = document.getElementById('main-content');
  
  let clicks = 0;

  if (btnEnter) {
    btnEnter.addEventListener('click', () => {
      clicks++;
      
      if (clicks === 1) {
        btnEnter.innerText = "Knock Twice More";
      } else if (clicks === 2) {
        btnEnter.innerText = "One Final Knock";
      } else if (clicks === 3) {
        // Unlock sequence
        gateOverlay.classList.add('fade-out');
        
        setTimeout(() => {
          gateOverlay.style.display = 'none';
          mainContent.classList.remove('hidden');
          mainContent.classList.add('visible');
          
          // Small scroll initialization to trigger any scroll animations if we add them
          window.dispatchEvent(new Event('scroll'));
        }, 1000); // match transition duration
      }
    });
  }

  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      
      const targetElement = document.querySelector(this.getAttribute('href'));
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });

  // Handle Contact Form Submission
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('button[type="submit"]');
      const originalText = btn.innerText;
      
      btn.innerText = "Transmitting...";
      btn.disabled = true;
      
      // Simulate API call
      setTimeout(() => {
        btn.innerText = "Request Received";
        btn.style.backgroundColor = "#2a8a41";
        btn.style.color = "#fff";
        btn.style.borderColor = "#2a8a41";
        contactForm.reset();
        
        // Reset after 3 seconds
        setTimeout(() => {
          btn.innerText = originalText;
          btn.style.backgroundColor = "";
          btn.style.color = "";
          btn.style.borderColor = "";
          btn.disabled = false;
        }, 3000);
      }, 1500);
    });
  }
});

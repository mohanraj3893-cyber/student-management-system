import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  
  /* ==========================================
     STICKY HEADER TRANSFORMATION
     ========================================== */
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  /* ==========================================
     MOBILE NAVIGATION MENU
     ========================================== */
  const mobileToggle = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      navMenu.classList.toggle('open');
      mobileToggle.classList.toggle('active');
    });

    // Close menu when links are clicked on mobile
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        mobileToggle.classList.remove('active');
      });
    });

    // Close menu when clicking anywhere outside
    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('open') && !navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
        navMenu.classList.remove('open');
        mobileToggle.classList.remove('active');
      }
    });
  }

  /* ==========================================
     ACTIVE NAVIGATION LINK HIGHLIGHTING
     ========================================== */
  const sections = document.querySelectorAll('section, footer');
  
  window.addEventListener('scroll', () => {
    let current = '';
    const scrollPos = window.scrollY + 100; // Offset for sticky header
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });

  /* ==========================================
     LOGIN MODAL INTERACTIVE SHOW/HIDE
     ========================================== */
  const loginModal = document.getElementById('login-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  if (loginModal && modalCloseBtn) {
    const closeModal = () => {
      loginModal.classList.remove('open');
      document.body.style.overflow = ''; // Enable page scrolling
    };

    modalCloseBtn.addEventListener('click', closeModal);

    // Close modal when clicking on the blurred overlay area outside the modal card
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) {
        closeModal();
      }
    });

    // Close modal on Escape key press
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && loginModal.classList.contains('open')) {
        closeModal();
      }
    });
  }

  /* ==========================================
     STATISTICS COUNT-UP ANIMATION
     ========================================== */
  const statNumbers = document.querySelectorAll('.stat-num');
  
  const animateCount = (element) => {
    const target = parseInt(element.getAttribute('data-target'), 10);
    const speed = 2000; // Duration of animation in ms
    const increment = target / (speed / 16); // ~60fps refresh rate
    let current = 0;

    const updateCount = () => {
      current += increment;
      if (current < target) {
        element.textContent = Math.floor(current);
        requestAnimationFrame(updateCount);
      } else {
        element.textContent = target;
      }
    };
    updateCount();
  };

  // Trigger counters when scrolled into view (using Intersection Observer)
  const statsSection = document.querySelector('.hero-quick-stats');
  if (statsSection) {
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          statNumbers.forEach(num => animateCount(num));
          observer.unobserve(entry.target); // Trigger only once
        }
      });
    }, { threshold: 0.5 });
    
    observer.observe(statsSection);
  }

  /* ==========================================
     MICRO-ANIMATIONS: TILT & SHINE ON CARDS
     ========================================== */
  const cards = document.querySelectorAll('.feature-card');
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left; // x position within element
      const y = e.clientY - rect.top;  // y position within element
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Calculate tilt degrees (-5 to 5 max)
      const rotateX = ((centerY - y) / centerY) * 6;
      const rotateY = ((x - centerX) / centerX) * 6;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
      
      // Dynamic glass shine reflection position
      card.style.backgroundImage = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 60%)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.backgroundImage = '';
    });
  });
});

import './style.css';

document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================
     STICKY HEADER TRANSFORMATION
     ========================================== */
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 30) {
        header.classList.add('scrolled');
      } else {
        header.classList.add('scrolled'); // Keep scrolled state for mockup replica header height
      }
    });
  }

  /* ==========================================
     3D PARALLAX TILT & SHINE ON ROLE CARDS
     ========================================== */
  const roleCards = document.querySelectorAll('.mock-role-card');
  
  roleCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left; // x position within element
      const y = e.clientY - rect.top;  // y position within element
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Calculate tilt degrees (-6 to 6 max)
      const rotateX = ((centerY - y) / centerY) * 6;
      const rotateY = ((x - centerX) / centerX) * 6;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
      
      // Select the correct glow color based on the card class
      let glowColor = 'rgba(0, 86, 210, 0.15)'; // Admin Blue
      if (card.classList.contains('mock-faculty-card')) {
        glowColor = 'rgba(15, 157, 88, 0.15)'; // Faculty Green
      } else if (card.classList.contains('mock-student-card')) {
        glowColor = 'rgba(106, 27, 154, 0.15)'; // Student Purple
      }

      // Add a dynamic shadow glow on hover
      card.style.boxShadow = `0 25px 55px ${glowColor}`;
      
      // Dynamic glass shine reflection position
      card.style.backgroundImage = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)`;
      
      // Scale emblem circle slightly
      const emblem = card.querySelector('.mock-emblem-circle');
      if (emblem) {
        emblem.style.transform = 'scale(1.08)';
      }
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
      card.style.backgroundImage = '';
      
      const emblem = card.querySelector('.mock-emblem-circle');
      if (emblem) {
        emblem.style.transform = '';
      }
    });
  });
  
  /* ==========================================
     FADE IN ENTRANCE ANIMATION FOR CARDS
     ========================================== */
  roleCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 150 + index * 100);
  });
});

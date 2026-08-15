// Main script entry point & interactive features
document.addEventListener('DOMContentLoaded', () => {
  const heroTitle = document.getElementById('heroTitle');
  if (heroTitle) {
    heroTitle.classList.add('in');
  }

  // Active navigation link tracking on scroll (Desktop only)
  const navLinks = document.querySelectorAll('nav.desktop-nav a');
  const sections = document.querySelectorAll('section[id]');
  let isTicking = false;

  function updateActiveNav() {
    // Only run if desktop navigation is visible to save mobile CPU/GPU
    if (window.innerWidth <= 900 || !navLinks.length) return;

    const scrollPosition = window.scrollY + 200;

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        navLinks.forEach((link) => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });

    if (window.scrollY < 100) {
      navLinks.forEach((link) => link.classList.remove('active'));
      const homeLink = document.querySelector('nav.desktop-nav a[href="#hero"]');
      if (homeLink) homeLink.classList.add('active');
    }
  }

  // Throttled scroll listener using requestAnimationFrame to prevent scroll jank
  window.addEventListener('scroll', () => {
    if (!isTicking) {
      window.requestAnimationFrame(() => {
        updateActiveNav();
        isTicking = false;
      });
      isTicking = true;
    }
  }, { passive: true });

  updateActiveNav();
});
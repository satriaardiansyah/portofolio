// Main script entry point & interactive features
document.addEventListener('DOMContentLoaded', () => {
  const heroTitle = document.getElementById('heroTitle');
  if (heroTitle) {
    heroTitle.classList.add('in');
  }

  // Active navigation link tracking on scroll
  const navLinks = document.querySelectorAll('nav.desktop-nav a');
  const sections = document.querySelectorAll('section[id]');

  function updateActiveNav() {
    let scrollPosition = window.scrollY + 200;

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

  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();
});
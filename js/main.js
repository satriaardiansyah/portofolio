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

  // Project Show More / Collapse Feature (Default 4 Projects)
  const workGrid = document.getElementById('workGrid') || document.querySelector('.work-grid');
  const btnToggleProjects = document.getElementById('btnToggleProjects');

  if (workGrid && btnToggleProjects) {
    const projectCards = Array.from(workGrid.querySelectorAll('.proj-card'));
    const DEFAULT_VISIBLE_COUNT = 4;
    const totalCount = projectCards.length;
    let isExpanded = false;

    function applyProjectVisibility() {
      projectCards.forEach((card, index) => {
        if (index >= DEFAULT_VISIBLE_COUNT) {
          if (isExpanded) {
            card.classList.remove('proj-hidden');
            card.classList.add('proj-visible');
          } else {
            card.classList.add('proj-hidden');
            card.classList.remove('proj-visible');
          }
        } else {
          card.classList.remove('proj-hidden');
          card.classList.remove('proj-visible');
        }
      });

      const btnText = btnToggleProjects.querySelector('.btn-more-text');
      const btnArrow = btnToggleProjects.querySelector('.btn-more-arrow');

      if (isExpanded) {
        btnToggleProjects.setAttribute('aria-expanded', 'true');
        if (btnText) btnText.textContent = 'Tampilkan Lebih Sedikit';
        if (btnArrow) btnArrow.textContent = '↑';
      } else {
        btnToggleProjects.setAttribute('aria-expanded', 'false');
        if (btnText) btnText.textContent = `Lihat Semua Proyek (${totalCount})`;
        if (btnArrow) btnArrow.textContent = '↓';
      }
    }

    if (totalCount > DEFAULT_VISIBLE_COUNT) {
      applyProjectVisibility();

      btnToggleProjects.addEventListener('click', () => {
        isExpanded = !isExpanded;
        applyProjectVisibility();

        if (!isExpanded) {
          const workSection = document.getElementById('work');
          if (workSection) {
            const topOffset = workSection.getBoundingClientRect().top + window.pageYOffset - 80;
            window.scrollTo({ top: topOffset, behavior: 'smooth' });
          }
        }
      });
    } else {
      const moreWrap = btnToggleProjects.closest('.work-more-wrap');
      if (moreWrap) moreWrap.style.display = 'none';
    }
  }

  updateActiveNav();
});
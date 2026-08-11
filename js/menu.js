// Mobile navigation drawer toggle
document.addEventListener('DOMContentLoaded', () => {
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobileMenu');
  const menuClose = document.getElementById('menuClose');

  if (!burger || !mobileMenu || !menuClose) return;

  function openMenu() {
    burger.classList.add('open');
    mobileMenu.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    burger.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  }

  function toggleMenu() {
    mobileMenu.classList.contains('open') ? closeMenu() : openMenu();
  }

  burger.addEventListener('click', toggleMenu);
  menuClose.addEventListener('click', closeMenu);

  mobileMenu.querySelectorAll('nav a, .donate-btn').forEach((a) => {
    a.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
});

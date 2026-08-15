// Custom cursor (desktop with fine pointer only)
document.addEventListener('DOMContentLoaded', () => {
  // Disable cursor script completely on mobile / touch-only devices
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return;
  }

  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  
  if (!dot || !ring) return;

  let mx = 0, my = 0, rx = 0, ry = 0;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
  }, { passive: true });

  function ringLoop() {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(ringLoop);
  }
  ringLoop();

  document.querySelectorAll('a, button, .proj-card, .hero-social-btn').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      if (el.classList.contains('donate-btn') || el.classList.contains('btn-donate-neon') || el.closest('.support-card')) {
        ring.classList.add('hot-donate');
      } else {
        ring.classList.add('hot');
      }
    });
    el.addEventListener('mouseleave', () => {
      ring.classList.remove('hot');
      ring.classList.remove('hot-donate');
    });
  });
});



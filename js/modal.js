// Interactive Project Preview Modal Handler
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('previewModal');
  if (!modal) return;

  const modalClose = document.getElementById('modalClose');
  const modalImg = document.getElementById('modalImg');
  const modalVideo = document.getElementById('modalVideo');
  const modalBadge = document.getElementById('modalBadge');
  const modalTitle = document.getElementById('modalTitle');
  const modalYear = document.getElementById('modalYear');
  const modalStack = document.getElementById('modalStack');
  const modalDesc = document.getElementById('modalDesc');
  const modalDemoLink = document.getElementById('modalDemoLink');
  const modalGithubLink = document.getElementById('modalGithubLink');

  function openModal(card) {
    const title = card.getAttribute('data-title') || '';
    const type = card.getAttribute('data-type') || 'IMG';
    const preview = card.getAttribute('data-preview') || '';
    const year = card.getAttribute('data-year') || '';
    const stack = card.getAttribute('data-stack') || '';
    const desc = card.getAttribute('data-desc') || '';
    const demo = card.getAttribute('data-demo') || '#';
    const github = card.getAttribute('data-github') || '#';

    modalTitle.textContent = title;
    modalBadge.textContent = type;
    modalYear.textContent = year;
    modalStack.textContent = stack;
    modalDesc.textContent = desc;

    modalDemoLink.href = demo;
    modalGithubLink.href = github;

    if (type === 'VIDEO' && preview.endsWith('.mp4')) {
      modalImg.style.display = 'none';
      modalVideo.style.display = 'block';
      modalVideo.src = preview;
    } else {
      modalVideo.style.display = 'none';
      if (modalVideo) modalVideo.pause();
      modalImg.style.display = 'block';
      modalImg.src = preview;
      modalImg.alt = title;
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (modalVideo) {
      modalVideo.pause();
    }
  }

  // Attach click events to project cards
  document.querySelectorAll('.proj-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(card);
    });
  });

  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });
});

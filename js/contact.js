// Contact Form Handler with Gmail Direct Sending Integration
document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.getElementById('contactForm');
  if (!contactForm) return;

  const nameInput = document.getElementById('contactName');
  const emailInput = document.getElementById('contactEmail');
  const messageInput = document.getElementById('contactMessage');
  const statusToast = document.getElementById('contactToast');

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const message = messageInput.value.trim();

    if (!name || !email || !message) {
      showToast('⚠️ Harap isi semua bidang inputan terlebih dahulu.', 'warning');
      return;
    }

    const recipient = 'hirosayurus@gmail.com';
    const subject = encodeURIComponent(`Pesan Portofolio dari ${name}`);
    const bodyText = `Halo Yabi Dev,\n\nNama: ${name}\nEmail: ${email}\n\nPesan / Deskripsi Proyek:\n${message}\n\n---\nDikirim via Form Kontak Portofolio`;
    const encodedBody = encodeURIComponent(bodyText);

    // Option 1: Direct Web Gmail Compose URL
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${encodedBody}`;
    
    // Option 2: Standard Mailto fallback link
    const mailtoUrl = `mailto:${recipient}?subject=${subject}&body=${encodedBody}`;

    // Show feedback toast
    showToast('🚀 Membuka Gmail untuk mengirim pesan...', 'success');

    // Trigger Mailto first, fallback to opening Gmail in a new tab
    window.location.href = mailtoUrl;

    setTimeout(() => {
      window.open(gmailUrl, '_blank');
    }, 800);
  });

  function showToast(text, type = 'info') {
    if (!statusToast) return;
    statusToast.textContent = text;
    statusToast.className = `contact-toast ${type} show`;

    setTimeout(() => {
      statusToast.classList.remove('show');
    }, 4500);
  }
});

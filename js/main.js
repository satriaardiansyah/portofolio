// Main script entry point & hero entrance animation
window.addEventListener('load', () => {
  const heroTitle = document.getElementById('heroTitle');
  if (heroTitle) {
    heroTitle.classList.add('in');
  }
});


const dateElement = document.getElementById('current-date');

const now = new Date();

const formattedDate = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'long',
  year: 'numeric'
}).format(now);

dateElement.textContent = formattedDate;
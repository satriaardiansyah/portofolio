// Animated typewriter effect for terminal widget
document.addEventListener('DOMContentLoaded', () => {
  const termBody = document.getElementById('termBody');
  if (!termBody) return;

  const lines = [
    { p: 'satria@live', t: '~/gaming', o: 'obs-studio --start-streaming' },
    { out: '✓ Live Broadcast Active — 1080p60 FPS Game Stream' },
    { p: 'satria@live', t: '~/schedule', o: 'echo "Jadwal Stream Harian: 19:30 - 21:00 WIB"' },
    { out: '✓ Live Game Stream setiap hari pukul 19:30 - 21:00 WIB' },
    { p: 'satria@live', t: '~/community', o: 'join https://discord.com/invite/6DZVuFBm9' },
    { out: '✓ Terhubung ke Discord Komunitas & TikTok @yabidev' },
    { p: 'satria@live', t: '~/gaming', o: 'echo "Makasih udah nonton & mabar!"' }
  ];

  let li = 0;

  function typeLine() {
    if (li >= lines.length) {
      li = 0;
      termBody.innerHTML = '';
    }
    const item = lines[li];

    if (item.out) {
      const div = document.createElement('div');
      div.className = 'out';
      div.textContent = item.out;
      termBody.appendChild(div);
      li++;
      setTimeout(typeLine, 500);
      return;
    }

    const row = document.createElement('div');
    const promptSpan = document.createElement('span');
    promptSpan.className = 'prompt';
    promptSpan.textContent = `${item.p} ${item.t} $ `;
    row.appendChild(promptSpan);

    const textNode = document.createElement('span');
    row.appendChild(textNode);

    const cursor = document.createElement('span');
    cursor.className = 'cursor-blink';
    row.appendChild(cursor);

    termBody.appendChild(row);

    let ci = 0;
    const iv = setInterval(() => {
      textNode.textContent = item.o.slice(0, ci + 1);
      ci++;
      if (ci >= item.o.length) {
        clearInterval(iv);
        cursor.remove();
        li++;
        setTimeout(typeLine, 450);
      }
    }, 38);
  }

  typeLine();
});

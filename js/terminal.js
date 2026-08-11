// Animated typewriter effect for terminal widget
document.addEventListener('DOMContentLoaded', () => {
  const termBody = document.getElementById('termBody');
  if (!termBody) return;

  const lines = [
    { p: 'satria@live', t: '~/streams', o: 'npm run dev' },
    { out: '✓ ready in 340ms — server listening on :3000' },
    { p: 'satria@live', t: '~/streams', o: 'git commit -m "fix overlay glitch"' },
    { out: '✓ 1 file changed, chat is happy' },
    { p: 'satria@live', t: '~/streams', o: 'echo "makasih udah nonton & donasinya!"' }
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

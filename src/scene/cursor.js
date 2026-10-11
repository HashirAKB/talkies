// Injected into every page: a visible cursor that follows real mouse events, plus a ripple on each press.
// Playwright moves the real mouse; the scene helpers move it in small steps so the cursor glides.
(() => {
  if (window.__talkiesCursor) return;
  window.__talkiesCursor = true;

  const KEY = '__talkiesCursorPos';
  const install = () => {
    const style = document.createElement('style');
    style.textContent = `
      #__talkies-cursor { position: fixed; top: 0; left: 0; width: 22px; height: 22px; z-index: 2147483647;
        pointer-events: none; transform: translate(-100px, -100px); will-change: transform;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
      #__talkies-cursor.down svg { transform: scale(.85); transform-origin: 2px 2px; }
      .__talkies-ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 28px; height: 28px;
        margin: -14px 0 0 -14px; border-radius: 50%; border: 3px solid rgba(34, 139, 230, .9);
        background: rgba(34, 139, 230, .25); animation: __talkies-ripple .55s ease-out forwards; }
      @keyframes __talkies-ripple { from { transform: scale(.3); opacity: 1 } to { transform: scale(2.2); opacity: 0 } }
    `;
    document.documentElement.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = '__talkies-cursor';
    cursor.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 2 L2 18 L6.5 13.8 L9.6 20.5 L12.4 19.3 L9.4 12.7 L15.5 12.7 Z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(cursor);

    const place = (x, y) => {
      cursor.style.transform = `translate(${x}px, ${y}px)`;
      try { sessionStorage.setItem(KEY, JSON.stringify([x, y])); } catch { /* storage may be blocked */ }
    };
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
      if (saved) place(saved[0], saved[1]);
    } catch { /* first page or storage blocked */ }

    addEventListener('mousemove', (e) => place(e.clientX, e.clientY), true);
    addEventListener('mousedown', (e) => {
      cursor.classList.add('down');
      const ripple = document.createElement('div');
      ripple.className = '__talkies-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.documentElement.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    }, true);
    addEventListener('mouseup', () => cursor.classList.remove('down'), true);
  };

  if (document.documentElement) install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
})();

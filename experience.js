// Shared input, motion, preview and gesture policy. Page animations own their clocks.
(() => {
  // Keep conventional mouse desktops, including hybrid laptops, on their original layout.
  const layout = window.siteLayout = matchMedia('(max-width: 640px), (hover: none) and (pointer: coarse)');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new Set();
  const motion = window.siteMotion = {
    get stopped() { return preference.matches; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  function updateMotion() {
    document.documentElement.classList.toggle('motion-stopped', motion.stopped);
    listeners.forEach((fn) => fn());
  }
  preference.addEventListener('change', updateMotion);
  layout.addEventListener('change', updateMotion);
  updateMotion();

  let touch = matchMedia('(any-pointer: coarse)').matches;
  let menuOpen = false;
  let pageActive = true;
  const inputListeners = new Set();
  function updateInput(next) {
    if (touch === next) return;
    touch = next;
    inputListeners.forEach((fn) => fn());
  }
  document.addEventListener('pointerdown', (event) => updateInput(event.pointerType !== 'mouse'), { passive: true });
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') updateInput(false);
  }, { passive: true });
  document.addEventListener('keydown', () => updateInput(false));
  document.addEventListener('site-menu-change', (event) => {
    menuOpen = event.detail.open;
    inputListeners.forEach((fn) => fn());
  });
  document.addEventListener('visibilitychange', () => inputListeners.forEach((fn) => fn()));
  window.addEventListener('pagehide', () => { pageActive = false; inputListeners.forEach((fn) => fn()); });
  window.addEventListener('pageshow', () => { pageActive = true; inputListeners.forEach((fn) => fn()); });

  window.createGhostPreview = ({ element, ids, show, blocked = () => false }) => {
    // One timer per overview, cancelled at every suspension boundary.
    let timer = null;
    let current = null;
    let previous = null;
    let inView = false;
    let quietUntil = performance.now() + 1800;
    const allowed = () => layout.matches && ids.length > 0 && touch && pageActive && !document.hidden &&
      inView && !menuOpen && !motion.stopped && !blocked();
    function clear() {
      clearTimeout(timer);
      timer = null;
      if (current !== null) { current = null; show(null); }
    }
    function schedule(delay) {
      timer = setTimeout(() => {
        timer = null;
        if (!allowed()) { clear(); return; }
        if (current !== null) {
          current = null;
          show(null);
          schedule(1500 + Math.random() * 2000);
        } else {
          const choices = ids.filter((id) => id !== previous || ids.length === 1);
          current = choices[Math.floor(Math.random() * choices.length)];
          previous = current;
          show(current);
          schedule(2400 + Math.random() * 600);
        }
      }, delay);
    }
    function sync() {
      if (!allowed()) { clear(); quietUntil = performance.now() + 1800; return; }
      if (timer === null) schedule(Math.max(200, quietUntil - performance.now()));
    }
    const controller = {
      sync,
      quiet() { clear(); quietUntil = performance.now() + 3000; sync(); },
    };
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { threshold: 0.08 }).observe(element);
    motion.subscribe(sync);
    inputListeners.add(sync);
    return controller;
  };

  window.addHorizontalSwipe = (element, onSwipe, canStart = () => true) => {
    let gesture = null;
    let suppressUntil = 0;
    const excluded = 'a, input, textarea, select, [contenteditable], .site-nav';
    element.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) { gesture = null; suppressUntil = performance.now() + 700; return; }
      suppressUntil = 0;
      if (!layout.matches || event.pointerType === 'mouse' || event.target.closest(excluded) ||
          event.target.closest('button:not(.project-choice):not(.who-keepsake)') ||
          event.clientX < 24 || event.clientX > innerWidth - 24 ||
          (window.visualViewport?.scale || 1) > 1.01 || !canStart()) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, start: performance.now(), moved: false };
    }, { passive: true });
    element.addEventListener('pointermove', (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) gesture.moved = true;
    }, { passive: true });
    element.addEventListener('pointerup', (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const { x, y, start, moved } = gesture;
      gesture = null;
      const dx = event.clientX - x;
      const dy = event.clientY - y;
      if (moved) suppressUntil = performance.now() + 700;
      if (Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.6 &&
          performance.now() - start < 1200 && !getSelection()?.toString() &&
          (window.visualViewport?.scale || 1) <= 1.01 && canStart()) {
        suppressUntil = performance.now() + 700;
        onSwipe(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
    element.addEventListener('pointercancel', () => { gesture = null; suppressUntil = performance.now() + 700; });
    document.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) { gesture = null; suppressUntil = performance.now() + 700; }
    }, { passive: true });
    element.addEventListener('click', (event) => {
      if (event.detail !== 0 && performance.now() < suppressUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    window.addEventListener('pagehide', () => { gesture = null; });
  };
})();

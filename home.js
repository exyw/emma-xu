(() => {
  let dispose = () => {};
  function mount() {
    dispose();
    const handlers = [];
    const on = (target, type, fn, options) => {
      target.addEventListener(type, fn, options);
      handlers.push([target, type, fn, options]);
    };
    const stop = window.siteLayout.matches ? compact(on) : desktop(on);
    dispose = () => {
      stop();
      handlers.forEach(([target, type, fn, options]) => target.removeEventListener(type, fn, options));
    };
  }
  function compact(on) {
    const area = document.querySelector('.home-artwork');
    const prelude = document.querySelector('.prelude');
    prelude.querySelector('.prelude-title').hidden = true;
    const siteNav = document.querySelector('.site-nav');
    prelude.hidden = false;
    const mask = document.querySelector('.prelude-mask');
    const reveal = document.querySelector('.spotlight-reveal');
    const replay = document.querySelector('.spotlight-replay');
    let active = true;
    try { active = sessionStorage.getItem('emma-home-revealed') !== 'true'; } catch (_) {}
    let x = area.clientWidth * .3;
    let y = area.clientHeight * .4;
    let targetX = x, targetY = y;
    let driftX = x, driftY = y;
    let heading = 0;
    let automatic = true;
    let pointer = null;
    let frame = null;
    let navTimer = null;
    let lastTime = null;
    let pageActive = true;
    const clamp = (v, max) => Math.max(0, Math.min(max, v));
    function display() {
      mask.style.setProperty('--cursor-x', `${x}px`);
      mask.style.setProperty('--cursor-y', `${y}px`);
    }
    function chooseTarget() {
      driftX = 60 + Math.random() * Math.max(0, area.clientWidth - 120);
      driftY = 60 + Math.random() * Math.max(0, area.clientHeight - 120);
    }
    function resume() {
      automatic = true;
      chooseTarget();
    }
    function point(event) {
      const rect = area.getBoundingClientRect();
      targetX = clamp(event.clientX - rect.left, rect.width);
      // A little light above the finger keeps the revealed area visible.
      targetY = clamp(event.clientY - rect.top - (event.pointerType === 'touch' ? 32 : 0), rect.height);
      if (window.siteMotion.stopped) { x = targetX; y = targetY; display(); }
    }
    function tick(now) {
      frame = null;
      const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, .05);
      lastTime = now;
      if (automatic) {
        if (Math.hypot(driftX - x, driftY - y) < 90) chooseTarget();
        const desired = Math.atan2(driftY - y, driftX - x);
        const difference = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
        heading += Math.max(-1.5 * dt, Math.min(1.5 * dt, difference));
        // Continue from the actual release position, with no idle timer or reset.
        x = clamp(x + Math.cos(heading) * 65 * dt, area.clientWidth);
        y = clamp(y + Math.sin(heading) * 65 * dt, area.clientHeight);
      } else {
        const dx = targetX - x, dy = targetY - y;
        if (Math.hypot(dx, dy) > 1) heading = Math.atan2(dy, dx);
        const easing = 1 - Math.exp(-8 * dt);
        x += dx * easing;
        y += dy * easing;
      }
      display();
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      lastTime = null;
      if (active && pageActive && !document.hidden && !window.siteMotion.stopped) frame = requestAnimationFrame(tick);
    }
    function showNav() {
      navTimer = null;
      siteNav.classList.add('is-ready');
      siteNav.inert = false;
      siteNav.removeAttribute('aria-hidden');
    }
    function setActive(next, initial = false) {
      active = next;
      document.body.classList.toggle('is-revealed', !active);
      prelude.classList.toggle('is-dismissed', !active);
      clearTimeout(navTimer);
      navTimer = null;
      siteNav.classList.remove('is-ready');
      siteNav.inert = true;
      siteNav.setAttribute('aria-hidden', 'true');
      if (active) siteNav.dispatchEvent(new Event('site-nav-dismiss'));
      else {
        if (initial || window.siteMotion.stopped) showNav();
        else navTimer = setTimeout(showNav, 350);
      }
      reveal.hidden = !active;
      replay.hidden = active;
      area.tabIndex = active ? 0 : -1;
      pointer = null;
      try { sessionStorage.setItem('emma-home-revealed', String(!active)); } catch (_) {}
      if (active) resume();
      sync();
    }
    reveal.addEventListener('click', () => { setActive(false); replay.focus({ preventScroll: true }); });
    replay.addEventListener('click', () => { setActive(true); reveal.focus({ preventScroll: true }); });
    on(area, 'pointerdown', (event) => {
      if (!event.isPrimary) { pointer = null; resume(); return; }
      if (!active) return;
      pointer = event.pointerId;
      automatic = false;
      point(event);
      area.setPointerCapture(event.pointerId);
    });
    on(area, 'pointermove', (event) => {
      if (!active || (!event.isPrimary) || (event.pointerType !== 'mouse' && pointer !== event.pointerId)) return;
      automatic = false;
      point(event);
    });
    function release(event) {
      if (pointer === event.pointerId) { pointer = null; resume(); }
    }
    on(area, 'pointerup', release);
    on(area, 'pointercancel', release);
    on(area, 'lostpointercapture', release);
    on(area, 'pointerleave', () => { if (pointer === null) resume(); });
    on(area, 'keydown', (event) => {
      const delta = { ArrowLeft: [-30, 0], ArrowRight: [30, 0], ArrowUp: [0, -30], ArrowDown: [0, 30] }[event.key];
      if (!active || !delta) return;
      event.preventDefault();
      // Keyboard moves are direct and remain available with motion stopped.
      automatic = false;
      x = targetX = clamp(x + delta[0], area.clientWidth);
      y = targetY = clamp(y + delta[1], area.clientHeight);
      display();
    });
    on(window, 'resize', () => { x = clamp(x, area.clientWidth); y = clamp(y, area.clientHeight); display(); });
    const unsubscribe = window.siteMotion.subscribe(() => {
      if (window.siteMotion.stopped && navTimer !== null && !active) {
        clearTimeout(navTimer);
        showNav();
      }
      sync();
    });
    on(document, 'visibilitychange', sync);
    on(window, 'pagehide', () => { pageActive = false; sync(); });
    on(window, 'pageshow', () => { pageActive = true; sync(); });
    chooseTarget();
    display();
    setActive(active, true);

    return () => { unsubscribe(); if (frame !== null) cancelAnimationFrame(frame); clearTimeout(navTimer); siteNav.inert = false; siteNav.removeAttribute('aria-hidden'); };
  }
  function desktop(on) {
    const prelude = document.querySelector(".prelude");
    prelude.querySelector('.prelude-title').hidden = false;
    const preludeMask = document.querySelector(".prelude-mask");
    const siteNav = document.querySelector(".site-nav");
    const prefersReducedMotion = { get matches() { return window.siteMotion.stopped; } };
    const mobileQuery = window.siteLayout;
    let frame = null;
    let dismissTimer;
    prelude.hidden = false;
    prelude.classList.remove('is-dismissed');
    siteNav.classList.remove('is-ready');
    siteNav.inert = false;
    siteNav.removeAttribute('aria-hidden');
    document.body.classList.remove('is-revealed');
    document.querySelector('.home-artwork').tabIndex = -1;
    // x and y are the spotlight's current position, the target is where it is trying to go
    let x = window.innerWidth * 0.3;
    let y = window.innerHeight * 0.4;
    let targetX = x;
    let targetY = y;

    let automatic = !prefersReducedMotion.matches;
    let spotlightActive = true;
    let previousFrameTime = performance.now();
    let idleTimer;

    // These control how quickly the automatic spotlight moves and turns
    let heading = 0;
    const idleSpeed = 65;
    const turnRate = 1.5;

    function displaySpotlight() {
      // The gradient reads these variables from the mask element
      preludeMask.style.setProperty("--cursor-x", `${x}px`);
      preludeMask.style.setProperty("--cursor-y", `${y}px`);
    }

    function chooseTarget() {
      const horizontalMargin = Math.min(90, window.innerWidth * 0.18);
      const verticalMargin = Math.min(90, window.innerHeight * 0.18);

      targetX =
        horizontalMargin +
        Math.random() *
        Math.max(0, window.innerWidth - horizontalMargin * 2);

      targetY =
        verticalMargin +
        Math.random() *
        Math.max(0, window.innerHeight - verticalMargin * 2);
    }

    function resumeAutomaticMovement() {
      window.clearTimeout(idleTimer);

      idleTimer = window.setTimeout(() => {
        if (spotlightActive && !prefersReducedMotion.matches) {
          automatic = true;
          chooseTarget();
        }
      }, 2200);
    }

    function animateSpotlight(currentTime) {
      if (!spotlightActive) return;

      const deltaTime = Math.min(
        (currentTime - previousFrameTime) / 1000,
        0.05
      );
      previousFrameTime = currentTime;

      if (prefersReducedMotion.matches) {
        x = targetX;
        y = targetY;
      } else if (automatic) {
        // Pick a new point before the spotlight reaches the old one
        if (Math.hypot(targetX - x, targetY - y) < 90) {
          chooseTarget();
        }

        const desiredHeading = Math.atan2(targetY - y, targetX - x);

        // Find the shortest turn toward the next point.
        const angleDifference = Math.atan2(
          Math.sin(desiredHeading - heading),
          Math.cos(desiredHeading - heading)
        );

        const maximumTurn = turnRate * deltaTime;
        heading += Math.max(
          -maximumTurn,
          Math.min(maximumTurn, angleDifference)
        );

        x += Math.cos(heading) * idleSpeed * deltaTime;
        y += Math.sin(heading) * idleSpeed * deltaTime;
      } else {
        // Mouse movement changes the target, and the spotlight catches up smoothly
        const easing = 1 - Math.exp(-5 * deltaTime);
        x += (targetX - x) * easing;
        y += (targetY - y) * easing;
    }

      displaySpotlight();
      frame = window.requestAnimationFrame(animateSpotlight);
      }

    on(window, "pointermove", (event) => {
      if (
        !spotlightActive ||
        event.pointerType === "touch" ||
        mobileQuery.matches
      ) {
        return;
      }

      automatic = false;
      targetX = event.clientX;
      targetY = event.clientY;
      resumeAutomaticMovement();
    });

    on(window, "resize", () => {
      x = Math.max(0, Math.min(window.innerWidth, x));
      y = Math.max(0, Math.min(window.innerHeight, y));
      targetX = Math.max(0, Math.min(window.innerWidth, targetX));
      targetY = Math.max(0, Math.min(window.innerHeight, targetY));
    });

    function dismissPrelude() {
      if (!spotlightActive) return;

      spotlightActive = false;
      window.clearTimeout(idleTimer);
      prelude.classList.add("is-dismissed");

      dismissTimer = window.setTimeout(() => {
        prelude.hidden = true;
        siteNav.classList.add("is-ready");
      }, 350);
    }

    on(prelude, "click", dismissPrelude);

    if (automatic) {
      chooseTarget();
      heading = Math.atan2(targetY - y, targetX - x);
    }
    displaySpotlight();
    frame = window.requestAnimationFrame(animateSpotlight);


    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      clearTimeout(idleTimer);
      clearTimeout(dismissTimer);
    };
  }
  window.siteLayout.addEventListener('change', mount);
  mount();
})();

(() => {
  let dispose = () => {};
  function mount() {
    dispose();
    const handlers = [];
    const on = (target, type, fn, options) => {
      target.addEventListener(type, fn, options);
      handlers.push([target, type, fn, options]);
    };
    const journey = createProjectsJourney(on);
    const stop = window.siteLayout.matches ? compact(on, journey) : desktop(on, journey);
    dispose = () => {
      journey.dispose();
      stop();
      handlers.forEach(([target, type, fn, options]) => target.removeEventListener(type, fn, options));
    };
  }
  function createProjectsJourney(on) {
    const siteNav = document.querySelector('.site-nav');
    const projectLink = siteNav.querySelector('a[href="projects.html"]');
    const whoLink = siteNav.querySelector('a[href="who-i-am.html"]');
    const preview = document.querySelector('.home-projects-preview');
    const figure = preview.querySelector('.home-projects-preview__figure');
    const canvas = preview.querySelector('canvas');
    const slots = preview.querySelector('.home-projects-preview__slots');
    const emmaLink = siteNav.querySelector('a[href="index.html"]');
    const { crop, projects } = window.projectConfig;
    let started = false;
    let cancelled = false;
    let chosen = false;
    let splitting = false;
    let assembling = false;
    let origins = null;
    let timer = null;
    let fallback = null;
    let frame = null;
    let unsubscribe = null;
    const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
    const seed = (value) => {
      const raw = Math.sin(value * 127.1 + 78.233) * 43758.5453;
      return raw - Math.floor(raw);
    };
    function cancel() {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(fallback);
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      unsubscribe?.();
      unsubscribe = null;
      projectLink.typewriter?.reset();
      whoLink.typewriter?.reset();
    }
    function reset() {
      cancel();
      started = false;
      chosen = false;
      splitting = false;
      assembling = false;
      origins = null;
      document.body.classList.remove('is-intro-opening', 'is-project-chosen', 'is-splitting', 'is-assembling', 'is-finishing');
      slots.replaceChildren();
      preview.style.removeProperty('--entry-preview-opacity');
      for (const link of [projectLink, whoLink]) {
        link.style.removeProperty('--intro-x');
        link.style.removeProperty('--intro-y');
        link.style.removeProperty('--intro-select-y');
      }
      siteNav.querySelector('.contact-link').style.removeProperty('--intro-x');
      siteNav.querySelector('.contact-link').style.removeProperty('--intro-y');
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
    function go() {
      if (cancelled) return;
      cancel();
      try { sessionStorage.setItem('emma-home-revealed', 'true'); } catch (_) {}
      location.assign(new URL('projects.html', document.baseURI).href);
    }
    function addProjectSlots() {
      if (slots.childElementCount) return;
      for (const project of projects) {
        const image = document.createElement('img');
        image.alt = '';
        image.draggable = false;
        image.src = new URL(`assets/projects/colour/${project.colour}`, document.baseURI).href;
        image.addEventListener('error', () => {
          if (image.dataset.fallback) return;
          image.dataset.fallback = 'true';
          image.src = new URL(`assets/projects/ascii/${project.small}`, document.baseURI).href;
        });
        image.style.left = `${(project.slot.x - crop.x) / crop.width * 100}%`;
        image.style.top = `${(project.slot.y - crop.y) / crop.height * 100}%`;
        image.style.width = `${project.slot.width / crop.width * 100}%`;
        image.style.height = `${project.slot.height / crop.height * 100}%`;
        slots.append(image);
      }
    }
    function chooseProject() {
      if (cancelled || chosen) return;
      chosen = true;
      clearTimeout(fallback);
      const emma = siteNav.querySelector('a[href="index.html"]');
      const contact = siteNav.querySelector('.contact-link');
      origins = {
        project: projectLink.getBoundingClientRect(),
        who: whoLink.getBoundingClientRect(),
        contact: contact.getBoundingClientRect(),
      };
      const selected = emma.getBoundingClientRect();
      projectLink.style.setProperty('--intro-select-y', `${selected.top - origins.project.top}px`);
      siteNav.dispatchEvent(new Event('site-nav-dismiss'));
      document.body.classList.add('is-project-chosen');
      timer = setTimeout(beginSplit, 600);
    }
    function beginSplit() {
      if (cancelled || splitting || !origins) return;
      splitting = true;
      const contact = siteNav.querySelector('.contact-link');
      const centerY = figure.getBoundingClientRect().top + figure.getBoundingClientRect().height / 2;
      const targetTop = (window.siteLayout.matches ? centerY : innerHeight / 2 - 8) - origins.project.height / 2;
      let projectX;
      if (window.siteLayout.matches) {
        const portrait = clamp((centerY * 2 - 240) * 276 / 900, 184, 276);
        const sideGap = clamp((innerWidth - portrait) / 2 - 70, 2, 12);
        const projectPadding = getComputedStyle(projectLink);
        const finalProjectWidth = origins.project.width -
          parseFloat(projectPadding.paddingLeft) - parseFloat(projectPadding.paddingRight) + 8;
        projectX = innerWidth / 2 - portrait / 2 - sideGap - finalProjectWidth;
        const contactX = innerWidth / 2 + portrait / 2 + sideGap;
        contact.style.setProperty('--intro-x', `${contactX - origins.contact.left}px`);
        contact.style.setProperty('--intro-y', `${targetTop - origins.contact.top}px`);
      } else {
        const navWidth = Math.min(1010, innerWidth - 48);
        const navLeft = (innerWidth - navWidth) / 2;
        projectX = navLeft + 24;
        const contactStyle = getComputedStyle(contact);
        const contactTextWidth = contact.querySelector('.typewriter-link__text')?.getBoundingClientRect().width;
        const contactWidth = contactTextWidth === undefined ? origins.contact.width :
          contactTextWidth + parseFloat(contactStyle.paddingLeft) + parseFloat(contactStyle.paddingRight);
        const contactX = navLeft + navWidth - 10 - contactWidth;
        contact.style.setProperty('--intro-x', `${contactX - origins.contact.left}px`);
        contact.style.setProperty('--intro-y', `${targetTop - origins.contact.top}px`);
      }
      projectLink.style.setProperty('--intro-x', `${projectX - origins.project.left}px`);
      projectLink.style.setProperty('--intro-y', `${targetTop - origins.project.top}px`);
      document.body.classList.add('is-splitting');
      timer = setTimeout(beginAssembly, 280);
    }
    function beginAssembly() {
      if (cancelled || assembling) return;
      assembling = true;
      if (window.siteMotion.stopped || !window.Path2D || !window.projectEntryGlyphs?.length) {
        go();
        return;
      }
      addProjectSlots();
      const bounds = figure.getBoundingClientRect();
      const pixelRatio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      const context = canvas.getContext('2d');
      const scaleX = bounds.width / crop.width;
      const scaleY = bounds.height / crop.height;
      const glyphs = window.projectEntryGlyphs.map(([x, y, path], index) => {
        const outward = Math.atan2((y - crop.y - crop.height / 2) * scaleY,
          (x - crop.x - crop.width / 2) * scaleX);
        const angle = outward + (seed(index + 1) - .5) * 1.4;
        const distance = (window.siteLayout.matches ? 28 : 38) +
          seed(index + 711) * (window.siteLayout.matches ? 60 : 100);
        return {
          path: new Path2D(path),
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          delay: seed(index + 1511) * .24,
        };
      });
      document.body.classList.add('is-assembling');
      projectLink.typewriter?.reset();
      let startedAt = null;
      const duration = 2200;
      function draw(now) {
        if (cancelled) return;
        if (startedAt === null) startedAt = now;
        const progress = clamp((now - startedAt) / duration, 0, 1);
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#24221f';
        for (const glyph of glyphs) {
          const local = clamp((progress - glyph.delay) / (1 - glyph.delay), 0, 1);
          const eased = 1 - (1 - local) ** 3;
          context.globalAlpha = .12 + .88 * eased;
          context.setTransform(
            pixelRatio * scaleX, 0, 0, pixelRatio * scaleY,
            pixelRatio * (-crop.x * scaleX + glyph.dx * (1 - eased)),
            pixelRatio * (-crop.y * scaleY + glyph.dy * (1 - eased)),
          );
          context.fill(glyph.path);
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
        preview.style.setProperty('--entry-preview-opacity', String(clamp((progress - .72) / .28, 0, 1)));
        if (progress < 1) frame = requestAnimationFrame(draw);
        else {
          frame = null;
          document.body.classList.add('is-finishing');
          timer = setTimeout(go, 300);
        }
      }
      frame = requestAnimationFrame(draw);
      unsubscribe = window.siteMotion.subscribe(() => { if (window.siteMotion.stopped) go(); });
    }
    function start() {
      if (started) return;
      started = true;
      cancelled = false;
      if (window.siteMotion.stopped) { go(); return; }
      document.body.classList.add('is-intro-opening');
      siteNav.dispatchEvent(new Event('site-nav-intro-open'));
      fallback = setTimeout(chooseProject, 6500);
      // The introduction uses the existing links and their measured typewriters.
      projectLink.typewriter?.playOnce(() => {
        if (cancelled) return;
        whoLink.typewriter?.playOnce(() => {
          if (!cancelled) timer = setTimeout(chooseProject, 300);
        });
      });
    }
    on(siteNav, 'click', (event) => {
      if (!started || cancelled || event.defaultPrevented || event.metaKey ||
          event.ctrlKey || event.altKey || event.shiftKey) return;
      const link = event.target.closest('a');
      if (link === projectLink) { event.preventDefault(); go(); }
      else if (link && link !== siteNav.querySelector('a[href="index.html"]')) cancel();
    }, true);
    on(siteNav, 'focusin', (event) => {
      if (started && event.target === whoLink) cancel();
    });
    on(document, 'visibilitychange', () => {
      if (started && document.hidden) reset();
    });
    on(document, 'keydown', (event) => {
      if (event.key !== 'Escape' || !started || cancelled) return;
      event.preventDefault();
      reset();
      siteNav.dispatchEvent(new Event('site-nav-dismiss'));
      emmaLink.focus({ preventScroll: true });
    }, true);
    on(window, 'pagehide', reset);
    on(window, 'resize', () => { if (chosen) go(); });
    return { start, reset, dispose: reset };
  }
  function compact(on, journey) {
    const area = document.querySelector('.home-artwork');
    const prelude = document.querySelector('.prelude');
    prelude.querySelector('.prelude-title').hidden = true;
    const siteNav = document.querySelector('.site-nav');
    const emmaLink = siteNav.querySelector('a[href="index.html"]');
    prelude.hidden = false;
    const mask = document.querySelector('.prelude-mask');
    let active = true;
    try { active = sessionStorage.getItem('emma-home-revealed') !== 'true'; } catch (_) {}
    let x = area.clientWidth * .3;
    let y = area.clientHeight * .4;
    let driftX = x, driftY = y;
    let heading = 0;
    let tap = null;
    let frame = null;
    let navTimer = null;
    let journeyPending = false;
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
    function tick(now) {
      frame = null;
      const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, .05);
      lastTime = now;
      if (Math.hypot(driftX - x, driftY - y) < 90) chooseTarget();
      const desired = Math.atan2(driftY - y, driftX - x);
      const difference = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
      heading += Math.max(-1.5 * dt, Math.min(1.5 * dt, difference));
      x = clamp(x + Math.cos(heading) * 65 * dt, area.clientWidth);
      y = clamp(y + Math.sin(heading) * 65 * dt, area.clientHeight);
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
      if (journeyPending) {
        journeyPending = false;
        journey.start();
      }
    }
    function setActive(next, initial = false, enterProjects = false) {
      active = next;
      journeyPending = enterProjects;
      document.body.classList.toggle('is-revealed', !active);
      prelude.classList.toggle('is-dismissed', !active);
      clearTimeout(navTimer);
      navTimer = null;
      siteNav.classList.remove('is-ready');
      siteNav.inert = !active;
      if (active) {
        siteNav.removeAttribute('aria-hidden');
        siteNav.dispatchEvent(new Event('site-nav-dismiss'));
        emmaLink.setAttribute('aria-label', 'Emma Xu, continue to Projects');
      } else {
        siteNav.setAttribute('aria-hidden', 'true');
        emmaLink.setAttribute('aria-label', 'Emma Xu, restart spotlight');
        if (initial || window.siteMotion.stopped) showNav();
        else navTimer = setTimeout(showNav, 350);
      }
      area.tabIndex = active ? 0 : -1;
      tap = null;
      try { sessionStorage.setItem('emma-home-revealed', String(!active)); } catch (_) {}
      if (active) chooseTarget();
      sync();
    }
    on(siteNav, 'click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.altKey || event.shiftKey || event.target.closest('a') !== emmaLink) return;
      event.preventDefault();
      event.stopPropagation();
      if (active) setActive(false, false, true);
      else { journey.reset(); setActive(true); }
      emmaLink.focus({ preventScroll: true });
    }, true);
    on(area, 'pointerdown', (event) => {
      if (!active || !event.isPrimary) { tap = null; return; }
      tap = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    on(area, 'pointermove', (event) => {
      if (tap?.id === event.pointerId &&
          Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 12) tap = null;
    });
    on(area, 'pointerup', (event) => {
      if (!active || tap?.id !== event.pointerId) return;
      tap = null;
      setActive(false, false, true);
    });
    on(area, 'pointercancel', () => { tap = null; });
    on(area, 'keydown', (event) => {
      const delta = { ArrowLeft: [-30, 0], ArrowRight: [30, 0], ArrowUp: [0, -30], ArrowDown: [0, 30] }[event.key];
      if (!active || !delta) return;
      event.preventDefault();
      // Keyboard moves are direct and remain available with motion stopped.
      x = clamp(x + delta[0], area.clientWidth);
      y = clamp(y + delta[1], area.clientHeight);
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
    on(window, 'pageshow', () => {
      pageActive = true;
      let spotlightRequested = false;
      try { spotlightRequested = sessionStorage.getItem('emma-home-revealed') === 'false'; } catch (_) {}
      if (spotlightRequested && !active) {
        journey.reset();
        setActive(true);
      } else sync();
    });
    chooseTarget();
    display();
    setActive(active, true);

    return () => { unsubscribe(); if (frame !== null) cancelAnimationFrame(frame); clearTimeout(navTimer); siteNav.inert = false; siteNav.removeAttribute('aria-hidden'); };
  }
  function desktop(on, journey) {
    const prelude = document.querySelector(".prelude");
    const title = prelude.querySelector('.prelude-title');
    title.hidden = false;
    const preludeMask = document.querySelector(".prelude-mask");
    const siteNav = document.querySelector(".site-nav");
    const emmaLink = siteNav.querySelector('a[href="index.html"]');
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
    let wasRevealed = false;
    try { wasRevealed = sessionStorage.getItem('emma-home-revealed') === 'true'; } catch (_) {}

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
      document.body.classList.add('is-revealed');
      emmaLink.setAttribute('aria-label', 'Emma Xu, restart spotlight');
      try { sessionStorage.setItem('emma-home-revealed', 'true'); } catch (_) {}

      const completeDismissal = () => {
        prelude.hidden = true;
        siteNav.classList.add("is-ready");
        if (document.activeElement === title) emmaLink.focus({ preventScroll: true });
        journey.start();
      };
      if (prefersReducedMotion.matches) completeDismissal();
      else dismissTimer = window.setTimeout(completeDismissal, 350);
    }

    on(prelude, "click", dismissPrelude);
    function restartSpotlight(focusTitle = false) {
      journey.reset();
      window.clearTimeout(dismissTimer);
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      spotlightActive = true;
      prelude.hidden = false;
      prelude.classList.remove('is-dismissed');
      document.body.classList.remove('is-revealed', 'is-intro-opening');
      siteNav.classList.remove('is-ready');
      siteNav.dispatchEvent(new Event('site-nav-dismiss'));
      emmaLink.setAttribute('aria-label', 'Emma Xu');
      try { sessionStorage.setItem('emma-home-revealed', 'false'); } catch (_) {}
      automatic = !prefersReducedMotion.matches;
      previousFrameTime = performance.now();
      if (automatic) chooseTarget();
      frame = window.requestAnimationFrame(animateSpotlight);
      if (focusTitle) title.focus({ preventScroll: true });
    }
    on(siteNav, 'click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.altKey || event.shiftKey || event.target.closest('a') !== emmaLink) return;
      event.preventDefault();
      event.stopPropagation();
      restartSpotlight(true);
    }, true);
    on(window, 'pageshow', () => {
      let spotlightRequested = false;
      try { spotlightRequested = sessionStorage.getItem('emma-home-revealed') === 'false'; } catch (_) {}
      if (spotlightRequested && !spotlightActive) restartSpotlight();
    });

    if (wasRevealed) {
      spotlightActive = false;
      prelude.hidden = true;
      document.body.classList.add('is-revealed');
      siteNav.classList.add('is-ready');
      emmaLink.setAttribute('aria-label', 'Emma Xu, restart spotlight');
    }

    if (automatic) {
      chooseTarget();
      heading = Math.atan2(targetY - y, targetX - x);
    }
    displaySpotlight();
    if (spotlightActive) frame = window.requestAnimationFrame(animateSpotlight);


    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      clearTimeout(idleTimer);
      clearTimeout(dismissTimer);
    };
  }
  window.siteLayout.addEventListener('change', mount);
  mount();
})();

(() => {
  const motion = window.siteMotion;
  const writers = new Set();
  function attachCompactTypewriter(link) {
    if (link.typewriter) return link.typewriter;
    const label = link.textContent.trim();
    const text = document.createElement('span');
    text.className = 'typewriter-link__text';
    text.setAttribute('aria-hidden', 'true');
    text.style.width = `${label.length}ch`;
    text.textContent = label;
    link.setAttribute('aria-label', link.getAttribute('aria-label') || label);
    link.classList.add('typewriter-link');
    link.replaceChildren(text);
    let timer;
    let hovered = false;
    function reset() {
      clearTimeout(timer);
      link.classList.remove('is-typing');
      text.textContent = label;
    }
    function play(delay = 0) {
      reset();
      if (motion.stopped || document.hidden) return;
      timer = setTimeout(() => {
        link.classList.add('is-typing');
        let index = 0;
        function next() {
          text.textContent = label.slice(0, ++index);
          if (index < label.length) timer = setTimeout(next, 40 + Math.random() * 260);
          else {
            if (hovered) timer = setTimeout(play, 250 + Math.random() * 650);
          }
        }
        next();
      }, delay);
    }
    const handlers = [];
    const listen = (type, fn) => { link.addEventListener(type, fn); handlers.push([type, fn]); };
    listen('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      hovered = true;
      play();
    });
    listen('pointerleave', () => { hovered = false; reset(); });
    listen('focus', play);
    listen('blur', reset);
    const writer = { play, reset, destroy() {
      reset();
      handlers.forEach(([type, fn]) => link.removeEventListener(type, fn));
      link.replaceChildren(document.createTextNode(label));
      link.classList.remove('typewriter-link');
      delete link.typewriter;
      writers.delete(writer);
    } };
    link.typewriter = writer;
    writers.add(writer);
    return writer;
  }
  function attachDesktopTypewriter(link, { retryWidthOnResize = false } = {}) {
    if (link.typewriter) return link.typewriter;
    const handlers = [];
    const listen = (type, fn) => { link.addEventListener(type, fn); handlers.push([type, fn]); };
    const label = link.textContent.trim();
    const text = document.createElement("span");
    let widthLocked = false;
    let typingTimer;
    let cursorTimer;
    let isHovered = false;
    let previousDelays = [];
    const minimumTypingDelay = 40;
    const maximumTypingDelay = 300;
    const minimumLoopDelay = 250;
    const maximumLoopDelay = 900;

    // Keep the link from changing width while its text is being typed.
    // The homepage menu is hidden on mobile, so measure it after a resize if needed.
    function lockWidth() {
      if (widthLocked) return;
      const linkWidth = link.getBoundingClientRect().width;
      if (linkWidth > 0) {
        link.style.width = `${linkWidth}px`;
        widthLocked = true;
      }
    }

    lockWidth();
    if (retryWidthOnResize) window.addEventListener("resize", lockWidth);
    if (!link.hasAttribute("aria-label")) link.setAttribute("aria-label", label);
    link.textContent = "";
    link.classList.add("typewriter-link");
    text.className = "typewriter-link__text";
    text.setAttribute("aria-hidden", "true");
    text.textContent = label;
    link.append(text);

    function typeLabel(onComplete = null, repeat = true) {
      if (motion.stopped || document.hidden) return;

      window.clearTimeout(typingTimer);
      window.clearTimeout(cursorTimer);
      link.classList.add("is-typing");
      text.textContent = "";
      let characterIndex = 0;

      const currentDelays = [];

      function typeNextCharacter() {
        text.textContent = label.slice(0, characterIndex + 1);
        characterIndex += 1;

        if (characterIndex === label.length) {
          previousDelays = currentDelays;
          if (typeof onComplete === 'function') onComplete();
          if (repeat && isHovered) {
            const loopDelay = minimumLoopDelay + Math.random() * (maximumLoopDelay - minimumLoopDelay);
            cursorTimer = window.setTimeout(typeLabel, loopDelay);
          }
          return;
        }

        const delayIndex = characterIndex - 1;
        let typingDelay;

        do {
          typingDelay =
            minimumTypingDelay +
            Math.random() * (maximumTypingDelay - minimumTypingDelay);
        } while (
          previousDelays[delayIndex] !== undefined &&
          Math.abs(typingDelay - previousDelays[delayIndex]) < 90
        );

        currentDelays[delayIndex] = typingDelay;
        typingTimer = window.setTimeout(typeNextCharacter, typingDelay);
      }

      typeNextCharacter();
    }

    const sequencedMenuLink = () => window.siteLayout.matches && (
      (link.matches('a[href="projects.html"], a[href="who-i-am.html"]') &&
        Boolean(link.closest('.home-page .page-menu.is-open'))) ||
      (link.matches('.site-nav--portrait .page-menu > a:not(.selected)') &&
        document.body.classList.contains('portrait-overview-page') &&
        Boolean(link.closest('.site-nav--portrait:has(.page-menu.is-open)')))
    );
    listen("mouseenter", () => {
      if (sequencedMenuLink()) return;
      isHovered = true;
      typeLabel();
    });
    function resetLabel() {
      isHovered = false;
      window.clearTimeout(typingTimer);
      window.clearTimeout(cursorTimer);
      link.classList.remove("is-typing");
      text.textContent = label;
    }

    listen("mouseleave", () => { if (!sequencedMenuLink()) resetLabel(); });
    listen("focus", () => { if (!sequencedMenuLink()) typeLabel(); });
    listen("blur", () => { if (!sequencedMenuLink()) resetLabel(); });
    const writer = {
      reset: resetLabel, play: typeLabel,
      playOnce: (done) => typeLabel(done, false),
      destroy() {
        resetLabel();
        handlers.forEach(([type, fn]) => link.removeEventListener(type, fn));
        window.removeEventListener('resize', lockWidth);
        link.style.removeProperty('width');
        link.replaceChildren(document.createTextNode(label));
        link.classList.remove('typewriter-link');
        delete link.typewriter;
        writers.delete(writer);
      },
    };
    link.typewriter = writer;
    writers.add(writer);
    return writer;
  }

  function attachTypewriter(link) {
    const compact = window.siteLayout.matches && !link.closest('.site-nav');
    return compact ? attachCompactTypewriter(link) : attachDesktopTypewriter(link, { retryWidthOnResize: true });
  }
  window.siteLayout.addEventListener('change', () => {
    writers.forEach((writer) => writer.reset());
    document.querySelectorAll('.site-nav a, .projects-copy a').forEach((link) => { link.typewriter?.destroy(); attachTypewriter(link); });
  });
  window.attachTypewriter = attachTypewriter;
  window.detachTypewriters = (container) => container.querySelectorAll('.typewriter-link').forEach((link) => link.typewriter?.destroy());
  motion.subscribe(() => { if (motion.stopped) writers.forEach((writer) => writer.reset()); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) writers.forEach((writer) => writer.reset()); });
  window.addEventListener('pagehide', () => writers.forEach((writer) => writer.reset()));

  window.syncNavigationState = () => {
    const open = window.siteLayout.matches && Boolean(document.querySelector('.site-nav .page-menu.is-open'));
    document.dispatchEvent(new CustomEvent('site-menu-change', { detail: { open } }));
  };
  document.querySelectorAll('.site-nav').forEach((nav, index) => {
    const menu = nav.querySelector('.page-menu');
    const trigger = menu.querySelector('a[href="index.html"]');
    const selected = menu.querySelector('a.selected');
    nav.addEventListener('click', (event) => {
      if (document.body.classList.contains('home-page') || event.defaultPrevented ||
          event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey ||
          !event.target.closest('a[href="index.html"]')) return;
      try { sessionStorage.setItem('emma-home-revealed', 'false'); } catch (_) {}
    });
    menu.id = `page-destinations-${index}`;
    let open = false;
    let keyboard = false;
    let restoringFocus = false;
    let sequenceRequested = false;
    let sequenceVersion = 0;
    let sequenceTimer = null;
    let pageActive = true;
    const homeSequenceLinks = [menu.querySelector('a[href="projects.html"]'), menu.querySelector('a[href="who-i-am.html"]')];
    const portraitSequenceLinks = [...menu.querySelectorAll('a:not(.selected)')];
    const sideOverview = () => window.siteLayout.matches && nav.classList.contains('site-nav--portrait') &&
      document.body.classList.contains('portrait-overview-page') &&
      !document.documentElement.classList.contains('projects-initial-detail');
    const sequenceLinks = () => sideOverview() ? portraitSequenceLinks : homeSequenceLinks;
    const disclosure = () => sideOverview() ? selected : trigger;
    function syncDisclosure() {
      for (const link of new Set([trigger, selected].filter(Boolean))) {
        link.removeAttribute('aria-controls');
        link.removeAttribute('aria-expanded');
      }
      if (!window.siteLayout.matches) return;
      disclosure().setAttribute('aria-controls', menu.id);
      disclosure().setAttribute('aria-expanded', String(open));
    }
    const sequenceAllowed = () => sequenceRequested && open && window.siteLayout.matches &&
      (Boolean(nav.closest('.home-page')) || sideOverview()) && !motion.stopped && !document.hidden && pageActive;
    function runSequence(index, version) {
      if (version !== sequenceVersion || !sequenceAllowed()) return;
      const writer = sequenceLinks()[index].typewriter;
      writer.playOnce(() => {
        if (version !== sequenceVersion || !sequenceAllowed()) return;
        writer.reset();
        if (index === 0) runSequence(1, version);
        else sequenceTimer = window.setTimeout(() => runSequence(0, version), 250 + Math.random() * 650);
      });
    }
    function restartSequence() {
      const version = ++sequenceVersion;
      window.clearTimeout(sequenceTimer);
      sequenceTimer = null;
      if (sequenceAllowed()) sequenceTimer = window.setTimeout(() => runSequence(0, version), 200);
    }
    function setOpen(next, restore = false, animateSequence = false) {
      const changed = open !== next;
      open = next;
      if (!open) sequenceRequested = false;
      else if (animateSequence) sequenceRequested = true;
      menu.classList.toggle('is-open', open);
      menu.classList.toggle('is-dismissed', !open);
      syncDisclosure();
      if (changed || restore || animateSequence) {
        menu.querySelectorAll('a').forEach((link) => link.typewriter?.reset());
        restartSequence();
      }
      window.syncNavigationState();
      if (restore) {
        restoringFocus = true;
        disclosure().focus();
        restoringFocus = false;
      }
    }
    function configureLayout() {
      setOpen(false);
    }
    nav.addEventListener('site-nav-dismiss', () => setOpen(false));
    nav.addEventListener('site-nav-intro-open', () => setOpen(true));
    nav.addEventListener('site-nav-layout', configureLayout);
    motion.subscribe(() => {
      if (sequenceRequested) {
        sequenceLinks().forEach((link) => link.typewriter?.reset());
        restartSequence();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (sequenceRequested) {
        sequenceLinks().forEach((link) => link.typewriter?.reset());
        restartSequence();
      }
    });
    window.addEventListener('pagehide', () => { pageActive = false; restartSequence(); });
    window.addEventListener('pageshow', () => { pageActive = true; restartSequence(); });
    // Reuse the desktop links and typing on compact layouts.
    menu.addEventListener('click', (event) => {
      if (!window.siteLayout.matches || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a');
      if (!link) return;
      if (sideOverview() && link === selected) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(!open, false, true);
        return;
      }
      if (link === trigger && (!open || trigger.hasAttribute('aria-current'))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(!open, false, Boolean(nav.closest('.home-page')));
        return;
      }
      setOpen(false);
    }, true);
    menu.addEventListener('pointerenter', (event) => {
      if (window.siteLayout.matches && !sideOverview() && event.pointerType === 'mouse') setOpen(true);
    });
    menu.addEventListener('pointerleave', (event) => {
      if (window.siteLayout.matches && !sideOverview() && event.pointerType === 'mouse' && !menu.contains(document.activeElement)) setOpen(false);
    });
    menu.addEventListener('focusin', () => {
      if (window.siteLayout.matches && keyboard && !restoringFocus) setOpen(true);
    });
    menu.addEventListener('keydown', (event) => {
      if (!window.siteLayout.matches || event.key !== 'ArrowDown') return;
      event.preventDefault();
      setOpen(true);
      (sideOverview() ? portraitSequenceLinks[0] : menu.querySelector('a')).focus();
    });
    document.addEventListener('pointerdown', (event) => {
      keyboard = false;
      const inside = sideOverview() ? nav.contains(event.target) : menu.contains(event.target);
      if (window.siteLayout.matches && open && !inside) {
        setOpen(false);
        if ((sideOverview() ? nav : menu).contains(document.activeElement)) document.activeElement.blur();
      }
    });
    document.addEventListener('keydown', (event) => {
      keyboard = true;
      if (!window.siteLayout.matches) return;
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false, true);
      } else if (event.key === 'Tab' && (sideOverview() ? nav : menu).contains(document.activeElement)) {
        setOpen(true);
      }
    });
    nav.addEventListener('focusout', () => {
      setTimeout(() => { if (window.siteLayout.matches && open && !(sideOverview() ? nav : menu).contains(document.activeElement)) setOpen(false); }, 0);
    });
    window.siteLayout.addEventListener('change', configureLayout);
    nav.querySelectorAll('a').forEach(attachTypewriter);
    configureLayout();
  });
})();

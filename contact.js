(() => {
  const textStretch = {
    scrollDistance: 8, // Viewports of scrolling; lower values finish sooner.
    topOvershootVh: 20, // How far the top line passes beyond the viewport at the end.
    topGrowthWeight: 1.65, // Higher lines receive more of the total height increase.
    bottomGrowthWeight: 0.1,
    lineGap: 0, // Fixed space between lines, in pixels.
  };
  const prefersReducedMotion = { get matches() { return window.siteMotion.stopped; } };
  const stretchSection = document.querySelector("[data-stretch-section]");
  const stretchIntro = document.querySelector(".contact-intro");
  const stretchRows = [...stretchIntro.querySelectorAll(".intro-row")];
  const stretchWeights = stretchRows.map((row, index) => {
    const linePosition = stretchRows.length === 1 ? 0 : index / (stretchRows.length - 1);
    return textStretch.topGrowthWeight +
      (textStretch.bottomGrowthWeight - textStretch.topGrowthWeight) * linePosition;
  });
  const totalStretchWeight = stretchWeights.reduce((sum, weight) => sum + weight, 0);
  const mobileContactMenu = window.siteLayout;
  let scrollFrame;
  stretchSection.style.setProperty("--scroll-distance", `${textStretch.scrollDistance * 100}vh`);
  stretchIntro.style.setProperty("--line-gap", `${textStretch.lineGap}px`);

  function updateStretch() {
    scrollFrame = undefined;
    if (prefersReducedMotion.matches || mobileContactMenu.matches) {
      stretchRows.forEach((row) => {
        row.style.height = "";
        row.style.setProperty("--line-scale", 1);
      });
      return;
    }
    const scrollRange = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const progress = Math.min(1, Math.max(0, window.scrollY / scrollRange));
    const baseLineHeight = parseFloat(getComputedStyle(stretchRows[0].firstElementChild).lineHeight);
    const baseTextHeight = baseLineHeight * stretchRows.length +
      textStretch.lineGap * (stretchRows.length - 1);
    const finalTextHeight = stretchIntro.getBoundingClientRect().bottom +
      window.innerHeight * textStretch.topOvershootVh / 100;
    const extraHeight = Math.max(0, finalTextHeight - baseTextHeight);
    stretchRows.forEach((row, index) => {
      const lineHeight = baseLineHeight +
        progress * extraHeight * stretchWeights[index] / totalStretchWeight;
      const scale = lineHeight / baseLineHeight;
      row.style.height = `${lineHeight.toFixed(3)}px`;
      row.style.setProperty("--line-scale", scale.toFixed(4));
    });
  }
  function requestStretchUpdate() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateStretch);
  }
  window.addEventListener("scroll", requestStretchUpdate, { passive: true });
  window.addEventListener("resize", requestStretchUpdate);
  window.siteMotion.subscribe(requestStretchUpdate);
  updateStretch();

  const contactMenu = document.querySelector('.contact-menu');
  const contactTrigger = document.querySelector('.contact-link');
  const contactLinks = document.querySelector('#contact-links');
  const stage = document.querySelector('.contact-stage');
  const nav = document.querySelector('.site-nav');
  function setContactMenuOpen(isOpen) {
    contactMenu.classList.toggle('is-open', isOpen);
    contactTrigger.setAttribute('aria-expanded', String(isOpen));
    window.syncNavigationState();
  }
  function configureLayout() {
    const compact = mobileContactMenu.matches;
    contactMenu.classList.remove('is-open');
    contactLinks.className = 'contact-submenu';
    if (compact) stage.prepend(nav);
    else stretchIntro.after(nav);
    contactMenu.append(contactLinks);
    contactTrigger.setAttribute('href', '#contact-links');
    contactTrigger.setAttribute('aria-controls', 'contact-links');
    contactTrigger.setAttribute('aria-expanded', 'false');
    window.syncNavigationState();
    window.detachTypewriters(contactLinks);
    const cv = contactLinks.querySelector('[download]');
    cv.textContent = compact ? 'Download CV' : 'CV';
    cv.setAttribute('aria-label', cv.textContent);
    contactLinks.querySelectorAll('a').forEach(window.attachTypewriter);
    requestStretchUpdate();
  }
  contactTrigger.addEventListener('click', (event) => {
    event.preventDefault();
    const touchToggle = mobileContactMenu.matches && !keyboard && pointerType !== 'mouse';
    setContactMenuOpen(touchToggle ? !contactMenu.classList.contains('is-open') : true);
  });
  contactMenu.addEventListener('mouseenter', () => { if (!mobileContactMenu.matches) setContactMenuOpen(true); });
  contactMenu.addEventListener('pointerenter', (event) => {
    if (mobileContactMenu.matches && event.pointerType === 'mouse') setContactMenuOpen(true);
  });
  contactMenu.addEventListener('mouseleave', () => {
    if (!contactMenu.contains(document.activeElement)) setContactMenuOpen(false);
  });
  let keyboard = false;
  let pointerType = null;
  let restoringFocus = false;
  contactMenu.addEventListener('focusin', (event) => {
    if (!restoringFocus && (!mobileContactMenu.matches || keyboard || event.target !== contactTrigger)) setContactMenuOpen(true);
  });
  document.addEventListener('pointerdown', (event) => {
    keyboard = false;
    pointerType = event.pointerType;
    if (mobileContactMenu.matches && contactMenu.classList.contains('is-open') && !contactMenu.contains(event.target)) {
      setContactMenuOpen(false);
      if (contactMenu.contains(document.activeElement)) document.activeElement.blur();
    }
  });
  document.addEventListener('keydown', (event) => {
    keyboard = true;
    if (!mobileContactMenu.matches || event.key !== 'Escape' || !contactMenu.classList.contains('is-open')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setContactMenuOpen(false);
    restoringFocus = true;
    contactTrigger.focus();
    restoringFocus = false;
  });
  contactMenu.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!contactMenu.contains(document.activeElement)) setContactMenuOpen(false);
    }, 0);
  });
  mobileContactMenu.addEventListener('change', configureLayout);
  window.addEventListener('pagehide', () => { if (scrollFrame) cancelAnimationFrame(scrollFrame); });
  configureLayout();
})();

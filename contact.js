(() => {
  const contactIntro = document.querySelector(".contact-intro");
  const mobileContactMenu = window.siteLayout;

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
    else contactIntro.after(nav);
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
  configureLayout();
})();

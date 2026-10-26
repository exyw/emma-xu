// DOM integration checks, without a rendering engine or production dependencies.
// Run with a separately installed jsdom: NODE_PATH=/path/to/node_modules node scripts/check-interactions.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');

function page(file, { reduced = false, width = 390, height = 844, hash = '', saved = {}, coarse = width <= 1000, hover = width > 1000 } = {}) {
  const errors = [];
  const navigations = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    if (error.message.includes('Not implemented: navigation to another Document')) navigations.push(error);
    else errors.push(error);
  });
  const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'), {
    url: `https://portfolio.example/${file}${hash}`, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole,
  });
  const w = dom.window;
  let clock = 0, nextId = 0, hidden = false;
  const tasks = new Map();
  const media = new Map();
  const observers = [];
  Object.defineProperties(w, { innerWidth: { value: width }, innerHeight: { value: height } });
  Object.defineProperty(w.document, 'hidden', { get: () => hidden });
  Object.defineProperty(w.performance, 'now', { value: () => clock });
  w.setTimeout = (fn, delay = 0) => { const id = ++nextId; tasks.set(id, { at: clock + Number(delay), fn }); return id; };
  w.clearTimeout = (id) => tasks.delete(id);
  w.requestAnimationFrame = (fn) => w.setTimeout(() => fn(clock), 16);
  w.cancelAnimationFrame = w.clearTimeout;
  w.scrollTo = (x, y) => { w.scrollY = y; };
  w.visualViewport = { scale: 1 };
  w.matchMedia = (query) => {
    if (!media.has(query)) {
      const m = new w.EventTarget();
      m.matches = query.includes('prefers-reduced') ? reduced : query.split(',').some((part) => {
        const maxWidth = part.match(/max-width:\s*(\d+)/);
        const maxHeight = part.match(/max-height:\s*(\d+)/);
        return (!maxWidth || width <= Number(maxWidth[1])) && (!maxHeight || height <= Number(maxHeight[1])) &&
          (!part.includes('hover: none') || !hover) && (!part.includes('pointer: coarse') || coarse);
      });
      m.media = query;
      media.set(query, m);
    }
    return media.get(query);
  };
  w.IntersectionObserver = class {
    constructor(fn) { this.fn = fn; observers.push(this); }
    observe(target) { this.target = target; this.fn([{ isIntersecting: true }]); }
  };
  w.HTMLElement.prototype.setPointerCapture = () => {};
  Object.defineProperties(w.HTMLElement.prototype, {
    clientWidth: { get() { return this.classList.contains('projects-stage') ? Math.min(420, width - 40) : this.classList.contains('who-figure') ? 196 : width; } },
    clientHeight: { get() { return this.classList.contains('projects-stage') ? 614 : this.classList.contains('home-artwork') ? height - 64 : 640; } },
    offsetTop: { get() { return this.classList.contains('projects-stage') ? 20 : 0; } },
    offsetHeight: { get() { return this.classList.contains('projects-heading') ? 130 : 44; } },
  });
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, top: 0, left: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight };
  };
  w.HTMLCanvasElement.prototype.getContext = (kind) => kind === 'webgl' ? null : new Proxy({}, {
    get(target, key) { return target[key] || (() => {}); }, set(target, key, value) { target[key] = value; return true; },
  });
  w.Image = class { decode() { return Promise.resolve(); } };
  Object.entries(saved).forEach(([key, value]) => w.sessionStorage.setItem(key, value));
  for (const link of w.document.querySelectorAll('link[rel="stylesheet"]')) {
    const style = w.document.createElement('style');
    style.textContent = fs.readFileSync(path.join(root, link.getAttribute('href')), 'utf8');
    w.document.head.append(style);
    // jsdom does not evaluate media queries; apply the mocked viewport's active rules.
    const activeRules = (rules) => [...rules].map((rule) => rule.type === 4
      ? (w.matchMedia(rule.conditionText).matches ? activeRules(rule.cssRules) : '')
      : rule.cssText).join('\n');
    style.textContent = activeRules(style.sheet.cssRules);
  }
  for (const script of w.document.querySelectorAll('script')) {
    w.eval(script.src ? fs.readFileSync(path.join(root, script.getAttribute('src')), 'utf8') : script.textContent);
  }
  function advance(ms) {
    const end = clock + ms;
    let count = 0;
    while (true) {
      const next = [...tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      if (++count > 20000) throw new Error('Timer/animation queue did not settle');
      clock = next[1].at;
      tasks.delete(next[0]);
      next[1].fn();
    }
    clock = end;
  }
  function pointer(target, type, data = {}) {
    const event = new w.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 180, clientY: 300, ...data });
    target.dispatchEvent(event);
    return event;
  }
  function click(target, detail = 1, fresh = true) {
    if (fresh && detail !== 0) { pointer(target, 'pointerdown'); pointer(target, 'pointerup'); }
    target.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, detail }));
  }
  function swipe(target, dx, dy = 0) {
    pointer(target, 'pointerdown');
    pointer(target, 'pointermove', { clientX: 180 + dx, clientY: 300 + dy });
    pointer(target, 'pointerup', { clientX: 180 + dx, clientY: 300 + dy });
  }
  function wheel(target, deltaX, deltaY = 0, options = {}) {
    const event = new w.WheelEvent('wheel', {
      bubbles: true, cancelable: true, clientX: 180, clientY: 300,
      deltaX, deltaY, ...options,
    });
    target.dispatchEvent(event);
    return event;
  }
  function hide(value) { hidden = value; w.document.dispatchEvent(new w.Event('visibilitychange')); }
  return { w, d: w.document, advance, pointer, click, swipe, wheel, hide, media, observers, tasks, errors, navigations, close: () => { assert.equal(errors.length, 0, errors.map((e) => e.message).join('\n')); dom.window.close(); } };
}
const label = (p, selector) => p.d.querySelector(selector);
async function flush(p) { await new Promise((resolve) => setTimeout(resolve, 0)); await new Promise((resolve) => setTimeout(resolve, 0)); p.advance(32); }

(async () => {
  let checks = 0;
  const check = (value, message) => { assert.ok(value, message); checks++; };
  // Compare every original top-level desktop declaration against the source before mobile work.
  // Media rules are checked by the interaction/layout-mode cases below; this is source parity, not rendering.
  const baselineSource = (file) => execFileSync('git', ['show', `634eb0b:${file}`], { cwd: root, encoding: 'utf8' });
  function desktopRules(css) {
    const dom = new JSDOM('<!doctype html><style></style>');
    dom.window.document.querySelector('style').textContent = css;
    const rules = [...dom.window.document.styleSheets[0].cssRules].filter((rule) => rule.type === 1);
    const result = new Map(rules.map((rule) => [rule.selectorText.replace(/\s+/g, ' ').trim(),
      rule.style.cssText.replace(/\s+/g, ' ').trim()]));
    dom.window.close();
    return result;
  }
  let cssDeclarations = 0;
  // Contact now has its own scroll composition; the other desktop pages retain the baseline.
  for (const [cssFile, baselineFile] of [['global.css', 'global.css'], ['projects.css', 'projects.css'], ['who-i-am.css', 'who-i-am.css'], ['home.css', 'index.html']]) {
    let source = baselineSource(baselineFile);
    if (baselineFile.endsWith('.html')) source = source.match(/<style>([\s\S]*?)<\/style>/)[1];
    const before = desktopRules(source);
    const after = desktopRules(fs.readFileSync(path.join(root, cssFile), 'utf8'));
    for (const [selector, declaration] of before) {
      if (selector === '.mobile-scroll' || selector === '.project-choice__original' || selector === '.project-choice__ascii' ||
          selector === '.project-choice.is-preview .project-choice__original' ||
          selector === '.prelude-title') continue; // Retired overview preview; the masked name is now a button.
      assert.equal(after.get(selector), declaration, `Original desktop CSS changed: ${cssFile} ${selector}`);
      cssDeclarations++;
    }
  }
  console.log(`Desktop CSS baseline matches ${cssDeclarations} original rules.`);
  const home = page('index.html', { saved: { 'emma-motion-paused': 'true' } });
  const area = label(home, '.home-artwork');
  const disclosure = label(home, '.page-menu a[href="index.html"]');
  check(!label(home, '.spotlight-tools') && disclosure.getAttribute('aria-label') === 'Emma Xu, continue to Projects',
    'Home has no bottom controls and gives the selected name an accessible entry action');
  check(!label(home, '.site-nav').classList.contains('is-ready') && !label(home, '.site-nav').inert &&
    !label(home, '.site-nav').hasAttribute('aria-hidden') &&
    label(home, '.prelude-title').hidden &&
    home.w.getComputedStyle(label(home, '.prelude-title')).display === 'none' &&
    home.w.getComputedStyle(label(home, '.page-menu a[href="index.html"]')).visibility === 'visible' &&
    home.w.getComputedStyle(label(home, '.page-menu a[href="projects.html"]')).visibility === 'hidden' &&
    home.w.getComputedStyle(label(home, '.contact-link')).visibility === 'hidden' &&
    Number(home.w.getComputedStyle(label(home, '.site-nav')).zIndex) < Number(home.w.getComputedStyle(label(home, '.prelude')).zIndex) &&
    home.w.getComputedStyle(label(home, 'h1')).clipPath === 'inset(50%)',
  'Mobile spotlight shows only the selected Emma Xu link under the mask');
  label(home, '.site-nav').classList.add('is-ready');
  check(home.w.getComputedStyle(label(home, '.page-menu a[href="projects.html"]')).visibility === 'hidden' &&
    home.w.getComputedStyle(label(home, '.page-menu a[href="who-i-am.html"]')).visibility === 'hidden' &&
    home.w.getComputedStyle(label(home, '.contact-link')).visibility === 'hidden',
  'Active spotlight shows no other menu links even if readiness state is stale');
  label(home, '.site-nav').classList.remove('is-ready');
  check(home.w.getComputedStyle(label(home, '.site-nav')).position === 'fixed' &&
    home.w.getComputedStyle(label(home, '.site-nav')).display === 'grid' &&
    home.w.getComputedStyle(label(home, '.page-menu')).display === 'flex',
  'Mobile Home uses the desktop menu arrangement at viewport center');
  check(home.w.getComputedStyle(home.d.body).overflow === 'hidden' &&
    home.w.getComputedStyle(home.d.body).height === '100dvh' &&
    Number.parseFloat(home.w.getComputedStyle(area).minHeight) === 0,
  'Mobile Home fits the dynamic viewport without the old artwork height floor');
  check(!label(home, '.spotlight-hint') && !label(home, 'footer') &&
    home.w.getComputedStyle(label(home, '.site-nav a')).fontSize === '12px' &&
    home.w.getComputedStyle(label(home, '.site-nav a')).paddingLeft === '6px' &&
    home.w.getComputedStyle(label(home, '.site-nav a')).minHeight === '44px',
  'Mobile Home has no bottom hint or footer, and its navigation has 12px text with touch-sized links');
  check(home.w.getComputedStyle(label(home, '.page-menu a[href="projects.html"] .typewriter-link__text')).transform === 'translateY(10px)' &&
    home.w.getComputedStyle(label(home, '.page-menu a[href="who-i-am.html"] .typewriter-link__text')).transform === 'translateY(-10px)',
  'Mobile Home labels move closer together without shrinking their link targets');
  const spotlightX = label(home, '.prelude-mask').style.getPropertyValue('--cursor-x');
  home.swipe(area, 100);
  check(!home.d.body.classList.contains('is-revealed') &&
    label(home, '.prelude-mask').style.getPropertyValue('--cursor-x') === spotlightX,
    'Dragging the mobile spotlight neither moves the light nor dismisses it');
  home.click(area);
  check(home.d.body.classList.contains('is-revealed') && !label(home, '.site-nav').classList.contains('is-ready'),
  'Tapping the mobile spotlight starts dismissal before showing the menu');
  check(home.w.getComputedStyle(label(home, '.prelude-title')).display === 'none' &&
    home.w.getComputedStyle(label(home, '.site-nav')).visibility === 'hidden',
    'Single Emma Xu label waits for the menu reveal during the spotlight fade');
  home.advance(350);
  check(label(home, '.site-nav').classList.contains('is-ready') && !label(home, '.site-nav').inert,
  'Centered menu appears once spotlight has gone');
  home.click(disclosure);
  check(!home.d.body.classList.contains('is-revealed') && !label(home, '.site-nav').inert,
  'Emma Xu restores the mask and leaves its selected link accessible');
  home.click(disclosure);
  home.advance(350);
  check(disclosure.getAttribute('aria-expanded') === 'true' &&
    home.d.body.classList.contains('is-intro-opening'),
  'Spotlight dismissal automatically opens Projects and Who I am');
  check([...home.d.querySelectorAll('.page-menu a')].every((a) => a.getAttribute('aria-label')), 'Typing links retain complete accessible labels');
  home.d.dispatchEvent(new home.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check(disclosure.getAttribute('aria-expanded') === 'false' &&
    !home.d.body.classList.contains('is-intro-opening') &&
    home.d.activeElement === disclosure,
  'Escape cancels the Home introduction and focuses Emma Xu');
  home.click(disclosure);
  check(!home.d.body.classList.contains('is-revealed'), 'Emma Xu restarts the spotlight after cancellation');
  check(!home.d.querySelector('.motion-toggle') && !home.w.siteMotion.stopped, 'Pause UI and stored pause functionality removed');
  check(!home.d.querySelector('.mobile-navigation, .menu-disclosure'), 'Mobile reuses desktop text navigation without duplicate dropdown');
  check(home.w.getComputedStyle(disclosure).minHeight === '44px' &&
    home.w.getComputedStyle(disclosure).pointerEvents === 'auto' &&
    !label(home, '.spotlight-reveal, .spotlight-replay'),
  'Selected Emma Xu remains a touch-sized action without bottom controls');
  check(home.w.getComputedStyle(label(home, '.prelude-mask')).getPropertyValue('--reveal-radius').includes('64px'), 'Smaller spotlight applies only to mobile');
  home.click(disclosure);
  home.advance(350);
  let destinationActivated = false;
  label(home, '.page-menu a[href="projects.html"]').addEventListener('click', (event) => { destinationActivated = true; event.preventDefault(); });
  home.click(label(home, '.page-menu a[href="projects.html"]'));
  check(destinationActivated && disclosure.getAttribute('aria-expanded') === 'false', 'Desktop-style mobile menu destinations activate immediately');
  home.hide(true);
  home.advance(1000);
  check(home.tasks.size === 0, 'Hidden Home has no queued motion or typing');
  home.close();

  const autoHome = page('index.html', { reduced: true });
  autoHome.click(label(autoHome, '.page-menu a[href="index.html"]'));
  check(autoHome.navigations.length === 1 &&
    autoHome.w.sessionStorage.getItem('emma-home-revealed') === 'true',
  'Reduced motion Emma Xu entry opens the unchanged Projects page immediately');
  autoHome.close();

  const introHome = page('index.html');
  for (const href of ['projects.html', 'who-i-am.html']) {
    label(introHome, `.page-menu a[href="${href}"]`).typewriter.playOnce = (done) => done();
  }
  introHome.click(label(introHome, '.page-menu a[href="index.html"]'));
  introHome.advance(650);
  check(introHome.d.body.classList.contains('is-project-chosen') &&
    introHome.w.getComputedStyle(label(introHome, '.page-menu a[href="projects.html"]')).fontWeight === 'bold' &&
    !introHome.d.body.classList.contains('is-splitting'),
  'Projects becomes the selected Home link before the navigation splits');
  introHome.advance(600);
  check(introHome.d.body.classList.contains('is-splitting') &&
    !introHome.d.body.classList.contains('is-assembling'),
  'The navigation starts splitting before silhouette assembly');
  introHome.w.Path2D = class { constructor(path) { this.path = path; } };
  introHome.advance(280);
  check(introHome.d.body.classList.contains('is-assembling') &&
    introHome.d.activeElement !== label(introHome, '.page-menu a[href="projects.html"]'),
    'Silhouette assembly does not move focus onto the animated Projects link');
  introHome.d.dispatchEvent(new introHome.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  introHome.advance(7000);
  check(!introHome.d.body.classList.contains('is-splitting') &&
    introHome.navigations.length === 0,
  'Escape cancels the split and its pending automatic navigation');
  introHome.close();

  const typeHome = page('index.html', { saved: { 'emma-home-revealed': 'true' } });
  const typeTrigger = label(typeHome, '.page-menu a[href="index.html"]');
  const typeOrder = [];
  for (const href of ['projects.html', 'who-i-am.html']) {
    const link = label(typeHome, `.page-menu a[href="${href}"]`);
    const playOnce = link.typewriter.playOnce;
    link.typewriter.playOnce = (done) => { typeOrder.push(href); playOnce(done); };
  }
  typeHome.click(typeTrigger);
  check(!typeHome.d.body.classList.contains('is-revealed') &&
    typeTrigger.getAttribute('aria-label') === 'Emma Xu, continue to Projects',
    'Selecting Emma Xu on revealed Home restarts the spotlight');
  typeHome.click(typeTrigger);
  typeHome.advance(350);
  check(typeOrder.length === 1 && typeOrder[0] === 'projects.html', 'Mobile Home types Projects first after spotlight dismissal');
  const cursorRules = [...typeHome.d.styleSheets].flatMap((sheet) => [...sheet.cssRules]);
  const cursorOnLink = cursorRules.find((rule) => rule.selectorText === '.site-nav .typewriter-link.is-typing::after');
  const cursorOnText = cursorRules.find((rule) => rule.selectorText === '.site-nav .typewriter-link.is-typing .typewriter-link__text::after');
  check(label(typeHome, '.page-menu a[href="projects.html"]').classList.contains('is-typing') &&
    cursorOnLink?.style.content === 'none' && cursorOnText?.style.display === 'inline-block' &&
    !cursorOnText?.style.position,
  'Compact navigation typing cursor is inline with the text instead of positioned on the link');
  typeHome.click(typeTrigger);
  const restartCount = typeOrder.length;
  typeHome.advance(3000);
  check(!typeHome.d.body.classList.contains('is-revealed') &&
    typeTrigger.getAttribute('aria-expanded') === 'false' &&
    typeOrder.length === restartCount,
    'Emma Xu restart closes the menu and cancels typing');
  typeHome.close();

  const stillHome = page('index.html', { reduced: true, saved: { 'emma-home-revealed': 'true' } });
  stillHome.click(label(stillHome, '.page-menu a[href="index.html"]'));
  stillHome.advance(1000);
  check([...stillHome.d.querySelectorAll('.page-menu a')].every((link) => !link.classList.contains('is-typing')),
    'Reduced motion keeps Home menu labels complete without typing');
  stillHome.close();
  const stillSpotlight = page('index.html', { reduced: true });
  stillSpotlight.click(label(stillSpotlight, '.page-menu a[href="index.html"]'));
  check(label(stillSpotlight, '.site-nav').classList.contains('is-ready'),
    'Reduced motion shows centered menu immediately when spotlight disappears');
  stillSpotlight.close();

  const sideWho = page('who-i-am.html', { reduced: true });
  const whoNav = label(sideWho, '.site-nav--portrait');
  const whoSelected = label(sideWho, '.page-menu a[href="who-i-am.html"]');
  const whoEmma = label(sideWho, '.page-menu a[href="index.html"]');
  const whoContact = label(sideWho, '.site-nav .contact-link');
  const whoOtherLink = label(sideWho, '.overview-navigation a');
  check(sideWho.w.getComputedStyle(whoNav).position === 'absolute' &&
    sideWho.w.getComputedStyle(whoNav).display === 'grid' &&
    sideWho.w.getComputedStyle(whoSelected).gridRow === '2' &&
    sideWho.w.getComputedStyle(whoNav).left.includes('var(--portrait-side-width)') &&
    sideWho.w.getComputedStyle(whoNav).right === 'auto' &&
    whoSelected.getAttribute('aria-expanded') === 'false',
  'Mobile Who I Am overview places the selected menu to the right of the portrait');
  check(whoSelected.getAttribute('aria-controls').split(' ').includes(whoContact.id),
    'Selected portrait label declares both revealed destinations as controlled content');
  check(label(sideWho, '.overview-navigation').querySelectorAll('a').length === 1 &&
    whoOtherLink.getAttribute('href') === 'projects.html' &&
    sideWho.w.getComputedStyle(label(sideWho, '.overview-navigation')).position === 'absolute' &&
    sideWho.w.getComputedStyle(label(sideWho, '.overview-navigation')).right.includes('var(--portrait-side-width)') &&
    sideWho.w.getComputedStyle(whoOtherLink).minHeight === '44px',
  'Existing Projects portrait link sits to the left without a duplicate');
  check(whoOtherLink.querySelector('[aria-hidden="true"]')?.textContent === '←' &&
    sideWho.w.getComputedStyle(whoOtherLink).textDecoration === 'none',
  'The left portrait destination has a decorative swipe arrow and no underline');
  check(sideWho.w.getComputedStyle(whoEmma).visibility === 'hidden' &&
    sideWho.w.getComputedStyle(whoContact).visibility === 'hidden' &&
    sideWho.w.getComputedStyle(label(sideWho, '.page-menu a[href="projects.html"]')).display === 'none',
  'Emma Xu and Contact start hidden while the duplicate menu destination stays absent');
  check(sideWho.w.getComputedStyle(whoEmma.querySelector('.typewriter-link__text')).transform === 'translateY(10px)' &&
    sideWho.w.getComputedStyle(whoContact.querySelector('.typewriter-link__text')).transform === 'translateY(-10px)' &&
    sideWho.w.getComputedStyle(whoEmma).minHeight === '44px' &&
    sideWho.w.getComputedStyle(whoContact).minHeight === '44px',
  'Who I Am overview labels sit closer vertically while their touch targets remain 44px');
  sideWho.click(whoSelected);
  check(whoSelected.getAttribute('aria-expanded') === 'true' &&
    sideWho.w.getComputedStyle(whoEmma).visibility === 'visible' &&
    sideWho.w.getComputedStyle(whoContact).visibility === 'visible',
  'Selected Who I Am label reveals Emma Xu above and Contact below');
  sideWho.click(whoSelected);
  check(whoSelected.getAttribute('aria-expanded') === 'false' &&
    sideWho.w.getComputedStyle(whoContact).visibility === 'hidden',
  'Second selected-label tap closes the mobile overview menu');
  let homeActivated = false;
  whoEmma.addEventListener('click', (event) => { homeActivated = true; event.preventDefault(); });
  sideWho.click(whoSelected);
  sideWho.click(whoEmma);
  check(homeActivated && whoSelected.getAttribute('aria-expanded') === 'false',
  'Revealed Emma Xu link navigates directly instead of opening another menu');
  let contactActivated = false;
  whoContact.addEventListener('click', (event) => { contactActivated = true; event.preventDefault(); });
  sideWho.click(whoSelected);
  sideWho.click(whoContact);
  check(contactActivated, 'Revealed Contact link remains tappable outside the page-menu container');
  sideWho.d.dispatchEvent(new sideWho.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check(whoSelected.getAttribute('aria-expanded') === 'false' && sideWho.d.activeElement === whoSelected,
  'Escape closes the side menu and restores focus to the selected page');
  sideWho.close();

  const typeWho = page('who-i-am.html');
  const typeWhoSelected = label(typeWho, '.page-menu a.selected');
  const portraitOrder = [];
  for (const [name, link] of [['Emma Xu', label(typeWho, '.page-menu a[href="index.html"]')],
    ['Contact', label(typeWho, '.site-nav .contact-link')]]) {
    const playOnce = link.typewriter.playOnce;
    link.typewriter.playOnce = (done) => { portraitOrder.push(name); playOnce(done); };
  }
  typeWho.click(typeWhoSelected);
  typeWho.advance(220);
  check(portraitOrder.join(',') === 'Emma Xu',
    'Mobile portrait overview starts typing Emma Xu after the selected label opens the menu');
  typeWho.advance(6000);
  check(portraitOrder.slice(0, 3).join(',') === 'Emma Xu,Contact,Emma Xu',
    'Emma Xu and Contact type in sequence and repeat while the overview menu stays open');
  typeWho.click(typeWhoSelected);
  const portraitStoppedCount = portraitOrder.length;
  typeWho.advance(6000);
  check(typeWhoSelected.getAttribute('aria-expanded') === 'false' &&
    portraitOrder.length === portraitStoppedCount &&
    !label(typeWho, '.site-nav .contact-link').classList.contains('is-typing'),
  'Closing the overview menu cancels both typewriters');
  typeWho.close();

  const sideProjects = page('projects.html', { reduced: true });
  const projectsSelected = label(sideProjects, '.site-nav .page-menu a[href="projects.html"]');
  const projectsOtherLink = label(sideProjects, '.overview-navigation a');
  check(sideProjects.d.body.classList.contains('portrait-overview-page') &&
    sideProjects.w.getComputedStyle(label(sideProjects, '.site-nav--portrait')).position === 'absolute' &&
    sideProjects.w.getComputedStyle(label(sideProjects, '.site-nav--portrait')).right.includes('var(--portrait-side-width)') &&
    label(sideProjects, '.overview-navigation').querySelectorAll('a').length === 1 &&
    projectsOtherLink.getAttribute('href') === 'who-i-am.html' &&
    sideProjects.w.getComputedStyle(label(sideProjects, '.overview-navigation')).left.includes('var(--portrait-side-width)'),
  'Projects overview uses the matching left-and-right portrait navigation');
  check(projectsOtherLink.querySelector('[aria-hidden="true"]')?.textContent === '→' &&
    sideProjects.w.getComputedStyle(projectsOtherLink).textDecoration === 'none',
  'The right portrait destination has a decorative swipe arrow and no underline');
  check(sideProjects.w.getComputedStyle(label(sideProjects, '.page-menu a[href="index.html"] .typewriter-link__text')).transform === 'translateY(10px)' &&
    sideProjects.w.getComputedStyle(label(sideProjects, '.contact-link .typewriter-link__text')).transform === 'translateY(-10px)',
  'Projects overview uses the same tighter vertical menu spacing');
  sideProjects.click(projectsSelected);
  check(projectsSelected.getAttribute('aria-expanded') === 'true' &&
    sideProjects.w.getComputedStyle(label(sideProjects, '.site-nav .contact-link')).visibility === 'visible',
  'Selected Projects label reveals the overview links');
  sideProjects.click(label(sideProjects, '[data-project="chip"]'));
  check(!sideProjects.d.body.classList.contains('portrait-overview-page') &&
    sideProjects.w.getComputedStyle(label(sideProjects, '.site-nav--portrait')).display === 'none' &&
    !label(sideProjects, '.projects-heading').hidden &&
    sideProjects.w.getComputedStyle(label(sideProjects, '.projects-back')).display !== 'none' &&
    label(sideProjects, '.overview-navigation').hidden &&
    !projectsSelected.hasAttribute('aria-expanded'),
  'Mobile project details hide the site navigation while retaining title and back controls');
  const detailContact = label(sideProjects, '.projects-detail-contact');
  const detailHeader = label(sideProjects, '.projects-detail-header');
  const detailBack = label(sideProjects, '.projects-detail-back');
  check(detailContact?.getAttribute('href') === 'contact.html' &&
    sideProjects.w.getComputedStyle(detailHeader).position === 'sticky' &&
    sideProjects.w.getComputedStyle(detailHeader).top === '0px' &&
    sideProjects.w.getComputedStyle(detailHeader).height === '56px' &&
    sideProjects.w.getComputedStyle(detailHeader).marginTop === '-12px' &&
    sideProjects.w.getComputedStyle(detailHeader).marginBottom === '-44px' &&
    sideProjects.w.getComputedStyle(detailHeader).width.includes('max(20px') &&
    sideProjects.w.getComputedStyle(label(sideProjects, '.projects-heading > .projects-back')).visibility === 'hidden' &&
    detailBack.typewriter &&
    sideProjects.w.getComputedStyle(detailContact).display === 'flex' &&
    sideProjects.w.getComputedStyle(detailContact).minHeight === '44px',
  'Mobile detail header stays sticky without adding page height');
  sideProjects.click(detailBack);
  await flush(sideProjects);
  check(sideProjects.d.body.classList.contains('portrait-overview-page') &&
    projectsSelected.getAttribute('aria-expanded') === 'false' &&
    !sideProjects.w.location.hash,
  'All projects restores the overview navigation');
  sideProjects.close();

  const swipeWho = page('who-i-am.html', { reduced: true });
  swipeWho.swipe(label(swipeWho, '.who-main'), -100);
  check(swipeWho.errors.length === 0 && swipeWho.w.location.pathname.endsWith('/who-i-am.html'),
    'Leftward swipe on Who I Am overview is ignored');
  swipeWho.swipe(label(swipeWho, '.who-main'), 100);
  check(swipeWho.navigations.length === 1,
    'Rightward swipe on Who I Am overview attempts the Projects navigation');
  swipeWho.close();

  const swipeProjects = page('projects.html', { reduced: true });
  swipeProjects.swipe(label(swipeProjects, '.projects-main'), 100);
  check(swipeProjects.errors.length === 0 && swipeProjects.w.location.pathname.endsWith('/projects.html'),
    'Rightward swipe on Projects overview is ignored');
  swipeProjects.swipe(label(swipeProjects, '.projects-main'), -100);
  check(swipeProjects.navigations.length === 1,
    'Leftward swipe on Projects overview attempts the Who I Am navigation');
  swipeProjects.close();

  const swipeDetail = page('projects.html', { hash: '#chip', reduced: true });
  swipeDetail.swipe(label(swipeDetail, '.projects-main'), -100);
  const nextDetail = swipeDetail.w.location.hash;
  swipeDetail.swipe(label(swipeDetail, '.projects-main'), 100);
  check(nextDetail === '#wit' && swipeDetail.w.location.hash === '#chip',
    'Project detail swipes still navigate in both directions');
  swipeDetail.close();

  const who = page('who-i-am.html');
  who.advance(1900);
  check(who.d.querySelectorAll('.who-keepsake.is-active').length === 1, 'Touch ghost previews one image');
  const keepsake = label(who, '[data-keepsake="drawing-closer"]');
  who.pointer(keepsake, 'pointerdown'); who.pointer(keepsake, 'pointerup'); who.click(keepsake);
  check(keepsake.getAttribute('aria-pressed') === 'true', 'Tap creates persistent selection');
  who.advance(9000);
  check(keepsake.classList.contains('is-active') && who.d.querySelectorAll('.who-keepsake.is-active').length === 1, 'Selection wins over ghost and motion');
  const other = label(who, '[data-keepsake="baby-me"]');
  who.pointer(other, 'pointerdown'); who.pointer(other, 'pointerup'); who.click(other);
  check(other.getAttribute('aria-pressed') === 'true' && keepsake.getAttribute('aria-pressed') === 'false', 'Tap switches selection directly');
  who.pointer(other, 'pointerdown'); who.pointer(other, 'pointerup'); who.click(other);
  check(other.getAttribute('aria-pressed') === 'false', 'Same-object tap deselects');
  who.advance(3100);
  check(who.d.querySelectorAll('.who-keepsake.is-active').length === 1, 'Ghost resumes after quiet interval');
  who.hide(true); who.advance(10000);
  check(!who.d.querySelector('.who-keepsake.is-active') && who.tasks.size === 0, 'Hidden overview cancels ghost and animation');
  who.hide(false); who.advance(1900);
  who.click(label(who, '.page-menu a[href="who-i-am.html"]'));
  check(!who.d.querySelector('.who-keepsake.is-active'), 'Expanded menu suspends ghost');
  who.d.dispatchEvent(new who.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  who.pointer(keepsake, 'pointerdown'); who.pointer(keepsake, 'pointerup'); who.click(keepsake);
  who.swipe(keepsake, 5, 100); who.click(keepsake, 1, false);
  check(keepsake.getAttribute('aria-pressed') === 'true', 'Vertical drag cannot toggle a selected object');
  const main = label(who, '.who-main');
  who.pointer(main, 'pointerdown'); who.pointer(main, 'pointerup'); who.click(main);
  check(keepsake.getAttribute('aria-pressed') === 'false', 'Fresh background tap clears selection after a drag');
  who.close();

  const projects = page('projects.html', { reduced: true });
  const choices = [...projects.d.querySelectorAll('.project-choice')];
  check(choices.length === 5 && choices.every((button) => button.getAttribute('aria-label')), 'Five directly activatable named project objects');
  const configuredProjects = projects.w.projectConfig.projects;
  check(configuredProjects.every((project) =>
    fs.existsSync(path.join(root, 'assets/projects/colour-map', project.colour))),
  'Every detail flip has a colour map matching its overview asset');
  const colourBytes = configuredProjects.reduce((total, project) => total +
    fs.statSync(path.join(root, 'assets/projects/colour', project.colour)).size, 0);
  const originalBytes = configuredProjects.reduce((total, project) => total +
    fs.statSync(path.join(root, 'assets/projects/images', project.original)).size, 0);
  check(colourBytes < originalBytes && choices.every((button) =>
    button.querySelector('.project-choice__colour')?.src.endsWith(`${button.dataset.project}.webp`) &&
    button.querySelectorAll('img').length === 1 &&
    projects.w.getComputedStyle(button.querySelector('img')).filter === 'brightness(0)'),
  'Overview uses one darkened colourized ASCII image per project');
  check(projects.w.getComputedStyle(choices[0].querySelector('.project-choice__colour')).transition === 'none',
    'Reduced motion switches overview colour without a fade');
  const overviewHover = page('projects.html', { width: 1512, height: 982, reduced: true });
  const hoverChoice = label(overviewHover, '[data-project="connect3"]');
  overviewHover.pointer(hoverChoice, 'pointermove', { pointerType: 'mouse', clientX: 180, clientY: 300 });
  check(hoverChoice.classList.contains('is-preview') &&
    overviewHover.w.getComputedStyle(hoverChoice.querySelector('.project-choice__colour')).filter === 'brightness(1)',
  'Desktop hover colours the same ASCII glyph image');
  overviewHover.pointer(hoverChoice, 'pointermove', { pointerType: 'mouse', clientX: 2000, clientY: 2000 });
  check(!overviewHover.d.querySelector('.project-choice.is-preview') &&
    overviewHover.w.getComputedStyle(hoverChoice.querySelector('.project-choice__colour')).filter === 'brightness(0)',
  'Moving off the portrait darkens the same ASCII glyph image');
  const failedColour = hoverChoice.querySelector('.project-choice__colour');
  failedColour.dispatchEvent(new overviewHover.w.Event('error'));
  hoverChoice.classList.add('is-preview');
  check(hoverChoice.classList.contains('is-colour-missing') &&
    failedColour.src.endsWith('Connect3%20small.svg') &&
    overviewHover.w.getComputedStyle(failedColour).filter === 'brightness(0)',
  'Missing colour asset falls back to dark supplied ASCII');
  overviewHover.close();
  const overviewGhost = page('projects.html');
  check(overviewGhost.w.getComputedStyle(label(overviewGhost, '.project-choice__colour')).transition.includes('filter 200ms') &&
    !overviewGhost.d.querySelector('.project-choice__ascii'),
  'Overview animates the one glyph image colour instead of crossfading duplicate glyphs');
  overviewGhost.advance(3300);
  check(overviewGhost.d.querySelectorAll('.project-choice.is-preview').length === 1 &&
    !overviewGhost.d.querySelector('.project-choice__original'),
  'Compact ghost previews one colourized ASCII project without a full image');
  overviewGhost.close();
  projects.click(choices[0]);
  check(projects.w.location.hash === '#chip' && label(projects, '.projects-title').textContent === 'Adventures of Chip', 'Project tap opens matching URL and title');
  check(label(projects, '.projects-title') === projects.d.activeElement, 'Explicit activation focuses heading');
  const next = label(projects, '.project-next');
  const previous = label(projects, '.project-previous');
  for (const id of ['wit', 'dk', 'cnn', 'connect3', 'chip']) {
    projects.w.scrollY = 250;
    projects.click(next);
    check(projects.w.location.hash === `#${id}` && projects.w.scrollY === 0, `Next ${id} starts at top, including wrap`);
  }
  projects.click(previous);
  check(projects.w.location.hash === '#connect3', 'Previous wraps first to fifth');
  check(label(projects, '.project-position').textContent === '5 / 5', 'Position indicator matches route');
  projects.swipe(label(projects, '.projects-main'), -100);
  check(projects.w.location.hash === '#chip', 'Detail swipe loops through projects');
  const before = projects.w.location.hash;
  projects.pointer(label(projects, '.projects-main'), 'pointerdown');
  projects.pointer(label(projects, '.projects-main'), 'pointerdown', { isPrimary: false, pointerId: 2 });
  projects.pointer(label(projects, '.projects-main'), 'pointerup', { clientX: 60 });
  check(projects.w.location.hash === before, 'Multi-touch cannot navigate');
  projects.w.visualViewport.scale = 2;
  projects.swipe(label(projects, '.projects-main'), -100);
  check(projects.w.location.hash === before, 'Zoomed gestures cannot navigate');
  projects.w.visualViewport.scale = 1;
  projects.pointer(label(projects, '.projects-main'), 'pointerdown', { clientX: 10 });
  projects.pointer(label(projects, '.projects-main'), 'pointerup', { clientX: 200 });
  check(projects.w.location.hash === before, 'Edge gestures are reserved for browser navigation');
  projects.swipe(label(projects, '.projects-copy'), 5, 100);
  check(projects.w.location.hash === before, 'Vertical detail gestures do not navigate');
  projects.click(label(projects, '.projects-back'));
  await flush(projects);
  check(!projects.w.location.hash && !label(projects, '.overview-navigation').hidden, 'All projects returns to overview across multiple details');
  check(projects.d.activeElement.dataset.project === 'chip', 'All projects restores opened object focus');
  const returnedChoice = projects.d.activeElement;
  check(returnedChoice.classList.contains('is-return-focus') &&
    projects.w.getComputedStyle(returnedChoice).outline === 'none',
  'Restored project focus has no immediate tile outline');
  returnedChoice.blur();
  check(!returnedChoice.classList.contains('is-return-focus'),
    'A later keyboard focus can use the normal tile outline');
  projects.w.history.forward(); await flush(projects);
  check(projects.w.location.hash === '#chip' && !label(projects, '.projects-heading').hidden, 'Browser Forward restores project state');
  projects.w.scrollY = 300;
  projects.click(next);
  projects.w.history.back(); await flush(projects);
  check(projects.w.location.hash === '#chip' && projects.w.scrollY === 300, 'Browser Back restores detail reading position');
  projects.close();

  const malformed = page('projects.html', { hash: '#%E0%A4%A', reduced: true });
  check(label(malformed, '.projects-heading').hidden, 'Malformed project URL safely shows overview');
  malformed.close();

  for (const id of ['chip', 'wit', 'dk', 'cnn', 'connect3']) {
    const direct = page('projects.html', { hash: `#${id}`, reduced: true });
    const project = direct.w.projectConfig.projects.find((item) => item.id === id);
    check([...direct.d.querySelectorAll('.project-choice__colour')].every((image) => !image.hasAttribute('src')),
      `Direct ${id} route does not request overview colour previews`);
    const largeSvg = fs.readFileSync(path.join(root, 'assets/projects/ascii', project.large), 'utf8');
    const viewBox = largeSvg.match(/\bviewBox="0 0 (\d+) (\d+)"/);
    check(viewBox && Number(viewBox[1]) === project.art.width && Number(viewBox[2]) === project.art.height,
      `Direct ${id} artwork frame matches its supplied large SVG`);
    if (project.detailCrop) {
      const originalFile = fs.readFileSync(path.join(root, 'assets/projects/images', project.original));
      check(originalFile.toString('ascii', 1, 4) === 'PNG' &&
        originalFile.readUInt32BE(16) === project.detailCrop.sourceWidth &&
        originalFile.readUInt32BE(20) === project.detailCrop.sourceHeight,
      `Direct ${id} crop uses the current original image dimensions`);
    }
    check(label(direct, '.projects-title').textContent === project.title, `Direct ${id} route renders matching content`);
    check(label(direct, '.projects-target__original').src.endsWith(encodeURIComponent(project.original)) &&
      label(direct, '.projects-original-toggle').textContent === 'View Original',
    `Direct ${id} route prepares its original image behind the ASCII`);
    const originalImage = label(direct, '.projects-target__original');
    check(direct.w.getComputedStyle(originalImage).objectFit === 'fill' && (!project.detailCrop ||
      Math.abs(parseFloat(originalImage.style.left) + project.detailCrop.x / project.detailCrop.width * 100) < 0.01 &&
      Math.abs(parseFloat(originalImage.style.top) + project.detailCrop.y / project.detailCrop.height * 100) < 0.01 &&
      Math.abs(parseFloat(originalImage.style.width) * project.detailCrop.width / project.detailCrop.sourceWidth - 100) < 0.01 &&
      Math.abs(parseFloat(originalImage.style.height) * project.detailCrop.height / project.detailCrop.sourceHeight - 100) < 0.01),
    `Direct ${id} original content maps to its full ASCII artwork frame`);
    check(!direct.d.body.classList.contains('portrait-overview-page') &&
      direct.w.getComputedStyle(label(direct, '.site-nav--portrait')).display === 'none',
    `Direct ${id} route also hides the mobile site navigation`);
    direct.click(label(direct, '.projects-back'));
    check(!direct.w.location.hash && label(direct, '.projects-heading').hidden, 'Direct-route All projects works');
    direct.close();
  }

  for (const [id, homepage] of [
    ['chip', 'https://play.unity.com/en/games/0198881a-52d3-47bd-b694-dfe287a2e0d8/webgl-builds'],
    ['wit', 'https://witunimelb.org.au/'], ['connect3', 'https://connect3.app/'],
  ]) {
    const embedded = page('projects.html', { hash: `#${id}`, reduced: true });
    const toggle = label(embedded, '.projects-original-toggle');
    const art = label(embedded, '.projects-target');
    check(!label(embedded, '.projects-site-preview') &&
      label(embedded, '.projects-copy a').href === homepage &&
      toggle.getAttribute('aria-label').includes('website'),
    `Direct ${id} keeps its homepage link and waits to create the website preview`);
    embedded.click(toggle);
    const panel = label(embedded, '.projects-site-preview');
    const frame = label(embedded, '.projects-site-preview__frame');
    const openSite = label(embedded, '.projects-site-preview__link');
    const colour = embedded.w.projectConfig.projects.find((item) => item.id === id).colour;
    check(colour && fs.existsSync(path.join(root, 'assets/projects/colour-map', colour)),
      `${id} has a detail colour map matching its overview preview`);
    check(frame?.src === homepage && frame.title === `${embedded.w.projectConfig.projects.find((item) => item.id === id).title} desktop homepage preview` &&
      frame.getAttribute('sandbox').includes('allow-scripts') &&
      frame.style.width === '1280px' && frame.style.height === '800px' &&
      panel.style.aspectRatio === '1280 / 800' &&
      openSite.href === homepage && openSite.target === '_blank' &&
      openSite.querySelector('svg[aria-hidden="true"]') && openSite.getAttribute('aria-label').includes('Open site:') &&
      panel?.parentElement === art.parentElement && frame.parentElement === panel &&
      art.classList.contains('is-site') &&
      label(embedded, '.projects-target__reveal').getAttribute('aria-hidden') === 'true' &&
      label(embedded, '.projects-stage').getAttribute('aria-label').includes('website preview'),
    `View Original embeds the ${id} homepage with a full-site escape link`);
    embedded.click(toggle);
    check(!label(embedded, '.projects-site-preview') &&
      !label(embedded, '.projects-site-preview__link') &&
      !art.classList.contains('is-site') &&
      label(embedded, '.projects-target__reveal').getAttribute('aria-hidden') === 'true',
    `View ASCII unloads the ${id} website preview`);
    if (id === 'wit') {
      embedded.click(toggle);
      embedded.click(label(embedded, '.project-next'));
      check(embedded.w.location.hash === '#dk' && !label(embedded, '.projects-site-preview'),
        'Paging away from a linked project unloads its website preview');
    }
    embedded.close();
  }

  const previewMotion = page('projects.html', { hash: '#wit', width: 1512, height: 982 });
  const motionToggle = label(previewMotion, '.projects-original-toggle');
  const motionArt = label(previewMotion, '.projects-target');
  const motionExperience = label(previewMotion, '.projects-experience');
  const asciiCopyOffset = motionExperience.style.getPropertyValue('--project-copy-offset');
  previewMotion.click(motionToggle);
  const motionPanel = label(previewMotion, '.projects-site-preview');
  const motionFrame = label(previewMotion, '.projects-site-preview__frame');
  check(motionPanel && !motionFrame.classList.contains('is-ready') &&
    !motionArt.classList.contains('is-site-ready') &&
    motionExperience.style.getPropertyValue('--project-copy-offset') === asciiCopyOffset,
  'Linked preview keeps ASCII and copy in place while its iframe loads');
  motionFrame.dispatchEvent(new previewMotion.w.Event('load'));
  await flush(previewMotion);
  check(motionFrame.classList.contains('is-ready') &&
    motionArt.classList.contains('is-flipping') &&
    label(previewMotion, '.projects-detail-flip') &&
    !motionPanel.classList.contains('is-visible') &&
    motionExperience.style.getPropertyValue('--project-copy-offset') === asciiCopyOffset,
  'Ready iframe starts flipping ASCII while the live website stays hidden');
  previewMotion.advance(280);
  check(!motionArt.classList.contains('is-site-ready') && !motionPanel.classList.contains('is-visible') &&
    motionArt.classList.contains('is-flipping') &&
    motionExperience.style.getPropertyValue('--project-copy-offset') === asciiCopyOffset,
  'ASCII glyphs flip in place while the website and copy wait');
  previewMotion.advance(260);
  check(motionArt.classList.contains('is-site-ready') && motionPanel.classList.contains('is-visible') &&
    label(previewMotion, '.projects-detail-flip') && motionPanel.inert &&
    motionPanel.style.clipPath.startsWith('inset(0 0') &&
    motionExperience.style.getPropertyValue('--project-copy-offset') !== asciiCopyOffset,
  'A top-down scan reveals the live website after the glyph flip');
  previewMotion.advance(200);
  check(!label(previewMotion, '.projects-detail-flip') && !motionPanel.inert,
    'Terminal flip finishes cleanly and the website becomes interactive');
  previewMotion.click(motionToggle);
  await flush(previewMotion);
  check(motionArt.classList.contains('is-flipping') && motionPanel.inert &&
    motionArt.classList.contains('is-site-ready') &&
    motionExperience.style.getPropertyValue('--project-copy-offset') === asciiCopyOffset,
  'View ASCII starts a reverse scan and returns the copy toward ASCII');
  previewMotion.advance(24);
  previewMotion.click(motionToggle);
  check(label(previewMotion, '.projects-site-preview') === motionPanel &&
    !motionArt.classList.contains('is-flipping') && !motionPanel.inert &&
    motionArt.classList.contains('is-site-ready'),
  'Rapid reactivation keeps the loaded iframe and cancels the gathering motion');
  previewMotion.click(motionToggle);
  await flush(previewMotion);
  previewMotion.advance(750);
  check(!label(previewMotion, '.projects-site-preview') &&
    !label(previewMotion, '.projects-detail-flip') &&
    motionExperience.style.getPropertyValue('--project-copy-offset') === asciiCopyOffset,
    'Restored ASCII replaces the preview and unloads its iframe');
  previewMotion.close();

  const imageMotion = page('projects.html', { hash: '#dk', width: 1512, height: 982 });
  const imageToggle = label(imageMotion, '.projects-original-toggle');
  const imageArt = label(imageMotion, '.projects-target');
  imageMotion.click(imageToggle);
  await flush(imageMotion);
  check(imageArt.classList.contains('is-flipping') &&
    label(imageMotion, '.projects-detail-flip') &&
    !imageArt.classList.contains('is-original'),
  'Image-only project flips its ASCII before revealing the original');
  imageMotion.advance(280);
  check(!imageArt.classList.contains('is-original') && imageArt.classList.contains('is-flipping'),
    'Original-image colours enter the ASCII glyphs before the image appears');
  imageMotion.advance(320);
  imageMotion.click(imageToggle);
  await flush(imageMotion);
  imageMotion.advance(750);
  check(!imageArt.classList.contains('is-original') &&
    !imageArt.classList.contains('is-flipping') &&
    !label(imageMotion, '.projects-detail-flip'),
  'Returning from an original image reassembles the ASCII and removes the canvas');
  imageMotion.close();

  for (const id of ['dk', 'cnn']) {
    const originalMotion = page('projects.html', {
      hash: `#${id}`, width: id === 'cnn' ? 390 : 1512, height: id === 'cnn' ? 844 : 982,
    });
    const motionLayer = label(originalMotion, '.projects-stage__motion');
    const toggle = label(originalMotion, '.projects-original-toggle');
    originalMotion.advance(48);
    check(motionLayer.style.transform.startsWith('translate3d('),
      `${id} ASCII artwork sways before the original is shown`);
    originalMotion.click(toggle);
    await flush(originalMotion);
    originalMotion.advance(920);
    check(label(originalMotion, '.projects-target').classList.contains('is-original') &&
      motionLayer.style.transform === 'none',
    `${id} original image settles the artwork sway`);
    originalMotion.advance(200);
    check(motionLayer.style.transform === 'none',
      `${id} original image stays still while it is viewed`);
    originalMotion.click(toggle);
    await flush(originalMotion);
    originalMotion.advance(920);
    check(!label(originalMotion, '.projects-target').classList.contains('is-original') &&
      motionLayer.style.transform.startsWith('translate3d('),
    `${id} ASCII artwork resumes swaying after the original closes`);
    originalMotion.close();
  }

  const mobileReveal = page('projects.html', { hash: '#cnn', reduced: true });
  const mobileArt = label(mobileReveal, '.projects-target');
  const mobileToggle = label(mobileReveal, '.projects-original-toggle');
  check(!label(mobileReveal, '.projects-target__toggle') && !mobileToggle.disabled,
    'Detail artwork is not a button and the metadata control is available');
  mobileReveal.click(mobileArt);
  check(mobileToggle.textContent === 'View Original' &&
    !mobileArt.classList.contains('is-original'),
  'Touching the ASCII artwork does not flip it');
  mobileReveal.click(mobileToggle);
  check(mobileToggle.textContent === 'View ASCII' &&
    label(mobileReveal, '.projects-target').classList.contains('is-original') &&
    !label(mobileReveal, '.projects-site-preview') &&
    label(mobileReveal, '.projects-meta').classList.contains('is-showing-original') &&
    mobileToggle.getAttribute('aria-label') === 'View ASCII' &&
    !mobileToggle.hasAttribute('aria-pressed'),
  'The metadata button reveals the original and names its next action');
  mobileReveal.click(mobileToggle);
  check(mobileToggle.textContent === 'View Original' &&
    !label(mobileReveal, '.projects-target').classList.contains('is-original') &&
    !label(mobileReveal, '.projects-meta').classList.contains('is-showing-original'),
  'Second metadata button press restores ASCII');
  mobileReveal.swipe(mobileToggle, -100);
  check(mobileReveal.w.location.hash === '#cnn', 'Swipe starting on metadata control does not navigate');
  mobileReveal.swipe(mobileArt, -100);
  check(mobileReveal.w.location.hash === '#connect3' &&
    label(mobileReveal, '.projects-original-toggle').textContent === 'View Original',
  'Swipe starting on non-interactive detail artwork still pages and resets the image');
  mobileReveal.close();

  const desktopReveal = page('projects.html', { hash: '#dk', width: 1512, height: 982, reduced: true });
  const desktopArt = label(desktopReveal, '.projects-target');
  const desktopToggle = label(desktopReveal, '.projects-original-toggle');
  const desktopTarget = label(desktopReveal, '.projects-target');
  desktopReveal.pointer(desktopToggle, 'mouseenter', { pointerType: 'mouse' });
  check(!desktopToggle.classList.contains('is-typing') && desktopToggle.textContent === 'View Original',
    'Reduced motion leaves the original toggle label still on hover');
  desktopReveal.pointer(desktopArt, 'pointerenter', { pointerType: 'mouse', clientX: 120, clientY: 200 });
  desktopReveal.pointer(desktopArt, 'pointermove', { pointerType: 'mouse', clientX: 220, clientY: 200 });
  check(!desktopTarget.classList.contains('is-original') &&
    !label(desktopReveal, '.projects-target__reveal').style.maskImage &&
    desktopToggle.textContent === 'View Original',
  'Desktop pointer movement leaves the ASCII artwork unchanged');
  desktopReveal.click(desktopArt, 0);
  check(!desktopTarget.classList.contains('is-original'), 'Art click does not flip the image');
  desktopReveal.click(desktopToggle, 0);
  check(desktopTarget.classList.contains('is-original') &&
    desktopToggle.textContent === 'View ASCII',
  'Keyboard activation of metadata control flips to the full original');
  desktopReveal.click(desktopToggle, 0);
  check(!desktopTarget.classList.contains('is-original') && desktopToggle.textContent === 'View Original',
    'Second keyboard activation of metadata control flips back to ASCII');
  desktopReveal.click(label(desktopReveal, '.project-next'));
  check(label(desktopReveal, '.projects-original-toggle').textContent === 'View Original',
    'Adjacent project starts with its ASCII artwork');
  desktopReveal.close();

  const hover = page('projects.html', { hash: '#dk', width: 1512, height: 982 });
  const hoverArt = label(hover, '.projects-target');
  const hoverToggle = label(hover, '.projects-original-toggle');
  const hoverBack = label(hover, '.projects-back');
  check(Boolean(hoverBack.typewriter) && hoverBack.getAttribute('aria-label') === '← All projects' &&
    Boolean(hoverBack.style.width) && hover.w.getComputedStyle(hoverBack).textAlign === 'left' &&
    hover.w.getComputedStyle(hoverBack).whiteSpace === 'nowrap',
  'All projects uses the shared typewriter with a stable desktop width and accessible label');
  const backWidth = hoverBack.style.width;
  hover.pointer(hoverBack, 'mouseenter', { pointerType: 'mouse' });
  check(hoverBack.classList.contains('is-typing') && hoverBack.textContent === '←' &&
    hoverBack.style.width === backWidth && hoverBack.getAttribute('aria-label') === '← All projects',
  'All projects types on desktop hover without shifting or changing its accessible name');
  hover.pointer(hoverBack, 'mouseleave', { pointerType: 'mouse' });
  check(!hoverBack.classList.contains('is-typing') && hoverBack.textContent === '← All projects',
  'All projects restores its full label when hover ends');
  hoverBack.focus();
  check(hoverBack.classList.contains('is-typing'), 'All projects also types on keyboard focus');
  hoverBack.blur();
  check(!hoverBack.classList.contains('is-typing') && hoverBack.textContent === '← All projects',
  'All projects restores its label after keyboard focus');
  check(Boolean(hoverToggle.typewriter) &&
    hover.w.getComputedStyle(hoverToggle).fontWeight === '700' &&
    hover.w.getComputedStyle(hoverToggle).textDecoration === 'none',
  'Original toggle uses the shared typewriter and bold, non-underlined metadata styling');
  hover.pointer(hoverToggle, 'mouseenter', { pointerType: 'mouse' });
  check(hoverToggle.classList.contains('is-typing') &&
    hoverToggle.textContent === 'V' &&
    hoverToggle.getAttribute('aria-label') === 'View Original',
  'Original toggle types on desktop hover while retaining its full accessible name');
  hover.pointer(hoverToggle, 'mouseleave', { pointerType: 'mouse' });
  check(!hoverToggle.classList.contains('is-typing') && hoverToggle.textContent === 'View Original',
    'Original toggle restores its full label when the pointer leaves');
  hover.pointer(hoverArt, 'pointerenter', { pointerType: 'mouse', clientX: 120, clientY: 200 });
  hover.pointer(hoverArt, 'pointermove', { pointerType: 'mouse', clientX: 320, clientY: 200 });
  hover.advance(1800);
  check(!hoverArt.classList.contains('is-original') &&
    !label(hover, '.projects-target__reveal').style.maskImage,
  'Ordinary desktop hover does not reveal the original');
  hover.close();

  const flip = page('projects.html');
  flip.click(label(flip, '[data-project="chip"]'));
  const info = label(flip, '.projects-heading > div');
  const flipCopy = label(flip, '.projects-copy');
  check(flip.w.getComputedStyle(info).backgroundColor === 'rgba(0, 0, 0, 0)' && flip.w.getComputedStyle(info).boxShadow === 'none', 'Mobile transition heading has no backing box');
  check(flip.w.getComputedStyle(flipCopy).backgroundColor === 'rgba(0, 0, 0, 0)' && flip.w.getComputedStyle(flipCopy).boxShadow === 'none', 'Mobile transition copy has no backing box');
  check(info.style.getPropertyValue('--project-transition-ink') === '#000' && flipCopy.style.getPropertyValue('--project-transition-ink') === '#000', 'Mobile transition starts with dark text on light background');
  await flush(flip); flip.advance(600);
  check(info.style.getPropertyValue('--project-transition-ink') === '#fff' && flipCopy.style.getPropertyValue('--project-transition-ink') === '#fff', 'Mobile transition flips text to light as background darkens');
  flip.advance(800);
  check(!info.style.getPropertyValue('--project-transition-ink'), 'Settled detail restores its original warm text palette');
  flip.click(label(flip, '.projects-back'));
  await flush(flip);
  await flush(flip);
  check(!label(flip, '.projects-experience').classList.contains('is-copy-fading') &&
    flip.w.getComputedStyle(flipCopy).backgroundColor === 'rgba(0, 0, 0, 0)',
  'Mobile return keeps the copy background transparent without desktop fade styling');
  flip.close();

  const alignment = page('projects.html');
  const alignmentStage = label(alignment, '.projects-stage');
  Object.defineProperty(alignmentStage, 'clientHeight', {
    get: () => alignment.d.body.classList.contains('portrait-overview-page') ? 614 : 710,
  });
  alignmentStage.getBoundingClientRect = () => {
    const overview = alignment.d.body.classList.contains('portrait-overview-page');
    if (overview && alignment.w.scrollY > 0) alignment.w.scrollY = 0; // A short overview clamps detail scroll.
    const left = 20, top = (overview ? 132 : 20) - alignment.w.scrollY;
    const width = alignmentStage.clientWidth, height = alignmentStage.clientHeight;
    return { x: left, y: top, top, left, right: left + width, bottom: top + height, width, height };
  };
  alignment.click(label(alignment, '[data-project="chip"]'));
  await flush(alignment);
  alignment.advance(1500);
  alignment.w.scrollY = 300;
  alignment.click(label(alignment, '.projects-back'));
  await flush(alignment);
  await flush(alignment);
  const projectedSource = label(alignment, '.projects-figure');
  const morph = label(alignment, '.projects-morph');
  const projectedTop = alignmentStage.getBoundingClientRect().top + parseFloat(projectedSource.style.top);
  const projectedLeft = alignmentStage.getBoundingClientRect().left + parseFloat(projectedSource.style.left);
  check(alignment.w.scrollY === 300 && Math.abs(projectedTop - 132) < 1 &&
    parseFloat(morph.style.left) <= parseFloat(projectedSource.style.left) &&
    parseFloat(morph.style.left) + parseFloat(morph.style.width) >=
      parseFloat(projectedSource.style.left) + parseFloat(projectedSource.style.width) &&
    parseFloat(morph.style.top) + parseFloat(morph.style.height) >=
      parseFloat(projectedSource.style.top) + parseFloat(projectedSource.style.height),
  'Mobile return morph reaches the centred overview portrait without clipping');
  alignment.advance(1500);
  const settledTop = alignmentStage.getBoundingClientRect().top + parseFloat(projectedSource.style.top);
  const settledLeft = alignmentStage.getBoundingClientRect().left + parseFloat(projectedSource.style.left);
  check(Math.abs(settledTop - projectedTop) < 1 && Math.abs(settledLeft - projectedLeft) < 1,
    'Mobile overview portrait stays in place when the return morph settles');
  alignment.close();

  const animated = page('projects.html');
  animated.click(label(animated, '[data-project="chip"]'));
  check(label(animated, '.projects-heading').classList.contains('is-title-visible') && !label(animated, '.projects-copy').inert, 'Text usable while morph loads');
  animated.click(label(animated, '.project-next'));
  animated.click(label(animated, '.project-next'));
  await flush(animated);
  animated.advance(1500);
  check(animated.w.location.hash === '#dk' && label(animated, '.projects-title').textContent === 'Donkey Kong', 'Rapid navigation discards stale morph work');
  animated.media.get('(prefers-reduced-motion: reduce)').matches = true;
  animated.media.get('(prefers-reduced-motion: reduce)').dispatchEvent(new animated.w.Event('change'));
  animated.advance(1000);
  check(animated.w.siteMotion.stopped && animated.tasks.size === 0, 'Live system motion change settles animations');
  animated.close();

  const gesture = page('projects.html', { reduced: true, hash: '#wit' });
  const contentLink = label(gesture, '.projects-copy a');
  gesture.swipe(contentLink, -100);
  check(gesture.w.location.hash === '#wit', 'Gestures starting on links retain native link interaction');
  gesture.close();

  const mouse = page('who-i-am.html', { width: 1512, height: 982 });
  mouse.pointer(label(mouse, '.who-main'), 'pointermove', { pointerType: 'mouse', clientX: 2000, clientY: 2000 });
  mouse.advance(6000);
  check(!mouse.d.querySelector('.who-keepsake.is-active'), 'Mouse input suppresses automatic touch previews');
  mouse.close();

  const desktopHome = page('index.html', { width: 1512, height: 982,
    saved: { 'emma-motion-paused': 'true' } });
  check(!desktopHome.w.siteLayout.matches && !desktopHome.w.siteMotion.stopped, 'Obsolete pause state does not alter desktop motion');
  check(!label(desktopHome, '.site-nav').classList.contains('is-ready'), 'Desktop Home starts with original masked navigation');
  check(!label(desktopHome, '.prelude').hidden && !label(desktopHome, '.prelude-title').hidden &&
    label(desktopHome, '.prelude-title').textContent === 'Emma Xu', 'Desktop masked name restored');
  check(label(desktopHome, '.prelude-title').tagName === 'BUTTON' &&
    label(desktopHome, '.prelude-title').getAttribute('aria-label') === 'Emma Xu, continue to Projects' &&
    !label(desktopHome, '.spotlight-tools'),
    'Desktop masked Emma Xu name gives keyboard users an entry action without bottom controls');
  check(!desktopHome.d.querySelector('.motion-toggle'), 'Desktop has no motion button');
  desktopHome.click(label(desktopHome, '.prelude'));
  desktopHome.advance(350);
  check(label(desktopHome, '.prelude').hidden && label(desktopHome, '.site-nav').classList.contains('is-ready'), 'Desktop click dismissal and 350ms navigation reveal restored');
  check(!label(desktopHome, '.page-menu a span').style.width, 'Desktop typewriter uses original measured link width');
  desktopHome.w.siteLayout.matches = true;
  desktopHome.w.siteLayout.dispatchEvent(new desktopHome.w.Event('change'));
  check(!desktopHome.w.siteMotion.stopped && desktopHome.d.body.classList.contains('is-revealed'),
    'Changing to mobile keeps revealed state and ignores removed pause setting');
  desktopHome.w.siteLayout.matches = false;
  desktopHome.w.siteLayout.dispatchEvent(new desktopHome.w.Event('change'));
  check(!desktopHome.w.siteMotion.stopped && label(desktopHome, '.site-nav').classList.contains('is-ready') &&
    label(desktopHome, '.prelude').hidden, 'Changing back keeps the revealed Home state');
  desktopHome.close();

  const returnHome = page('index.html', { width: 1512, height: 982,
    saved: { 'emma-home-revealed': 'true' } });
  check(label(returnHome, '.site-nav').classList.contains('is-ready') &&
    label(returnHome, '.prelude').hidden &&
    label(returnHome, '.site-nav a[href="index.html"]').getAttribute('aria-label') === 'Emma Xu, restart spotlight',
  'Returning Home shows navigation with an Emma Xu restart action');
  returnHome.w.sessionStorage.setItem('emma-home-revealed', 'false');
  returnHome.w.dispatchEvent(new returnHome.w.Event('pageshow'));
  check(!label(returnHome, '.prelude').hidden && !label(returnHome, '.prelude-title').hidden &&
    !returnHome.d.body.classList.contains('is-revealed'),
  'Selecting Emma Xu reactivates the spotlight on a restored desktop Home page');
  returnHome.close();

  const compactReturnHome = page('index.html', { saved: { 'emma-home-revealed': 'true' } });
  compactReturnHome.w.sessionStorage.setItem('emma-home-revealed', 'false');
  compactReturnHome.w.dispatchEvent(new compactReturnHome.w.Event('pageshow'));
  check(!compactReturnHome.d.body.classList.contains('is-revealed') &&
    !label(compactReturnHome, '.site-nav').inert &&
    label(compactReturnHome, '.page-menu a[href="index.html"]').getAttribute('aria-label') === 'Emma Xu, continue to Projects',
  'Selecting Emma Xu reactivates the spotlight on a restored compact Home page');
  compactReturnHome.close();

  const navToHome = page('projects.html', { width: 1512, height: 982,
    saved: { 'emma-home-revealed': 'true' } });
  const emmaLink = label(navToHome, '.site-nav a[href="index.html"]');
  emmaLink.dispatchEvent(new navToHome.w.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
  check(navToHome.w.sessionStorage.getItem('emma-home-revealed') === 'true',
  'Opening Emma Xu in another tab leaves this tab’s Home state alone');
  navToHome.click(emmaLink);
  check(navToHome.w.sessionStorage.getItem('emma-home-revealed') === 'false',
  'Selecting Emma Xu from Projects requests the active spotlight');
  navToHome.close();

  const reducedDesktopHome = page('index.html', { width: 1512, height: 982, reduced: true });
  reducedDesktopHome.click(label(reducedDesktopHome, '.prelude-title'));
  check(reducedDesktopHome.navigations.length === 1 &&
    label(reducedDesktopHome, '.prelude').hidden,
  'Reduced motion desktop Emma Xu entry opens Projects without waiting for the mask fade');
  reducedDesktopHome.close();

  const desktopProjects = page('projects.html', { width: 1512, height: 982 });
  check(label(desktopProjects, '.overview-navigation').hidden,
    'Direct desktop Projects overview keeps its existing navigation');
  desktopProjects.click(label(desktopProjects, '[data-project="chip"]'));
  await flush(desktopProjects);
  check(desktopProjects.w.getComputedStyle(label(desktopProjects, '.site-nav--portrait')).display === 'flex',
    'Desktop project detail navigation remains visible');
  check(desktopProjects.w.getComputedStyle(label(desktopProjects, '.projects-detail-header')).display === 'none',
    'Desktop details keep Contact in the existing site navigation');
  check(!label(desktopProjects, '.projects-heading').classList.contains('is-title-visible'), 'Desktop title waits for original morph phase');
  check(label(desktopProjects, '.projects-copy').inert, 'Desktop copy retains original reveal phase');
  check(!label(desktopProjects, '.project-pagination').hidden &&
    label(desktopProjects, '.project-pagination').inert,
  'Desktop project controls wait for the detail copy reveal');
  check(desktopProjects.w.getComputedStyle(label(desktopProjects, '.projects-back')).paddingTop === '0px', 'Desktop back-button spacing restored');
  desktopProjects.advance(680);
  check(label(desktopProjects, '.projects-heading').classList.contains('is-title-visible'), 'Desktop title reveals in latter half of morph');
  check(label(desktopProjects, '.projects-copy').inert, 'Desktop copy follows title in morph');
  desktopProjects.advance(650);
  check(!label(desktopProjects, '.projects-copy').inert, 'Desktop settled project copy usable');
  check(!label(desktopProjects, '.project-pagination').inert &&
    desktopProjects.w.getComputedStyle(label(desktopProjects, '.project-pagination')).visibility === 'visible',
  'Desktop project controls appear and become usable with the copy');
  desktopProjects.click(label(desktopProjects, '.projects-back'));
  await flush(desktopProjects);
  const closingCopy = label(desktopProjects, '.projects-copy');
  check(label(desktopProjects, '.projects-experience').classList.contains('is-copy-fading') &&
    desktopProjects.w.getComputedStyle(closingCopy).opacity === '0' &&
    desktopProjects.w.getComputedStyle(closingCopy.querySelector('p')).opacity === '1' && closingCopy.inert,
  'Desktop return fades the entire copy block and disables its links at closing start');
  desktopProjects.advance(1300);
  check(!desktopProjects.w.location.hash && label(desktopProjects, '.projects-heading').hidden, 'Desktop original Back return preserved');
  desktopProjects.close();
  const desktopDk = page('projects.html', { width: 1512, height: 982, hash: '#dk', reduced: true });
  check(label(desktopDk, '.projects-copy').hidden && !label(desktopDk, '.project-pagination').hidden &&
    label(desktopDk, '.project-pagination').textContent.includes('3 / 5'),
  'Desktop project without copy still shows positioned project controls');
  desktopDk.close();

  const desktopGesture = page('projects.html', { width: 1512, height: 982, reduced: true });
  const desktopMain = label(desktopGesture, '.projects-main');
  desktopGesture.wheel(desktopMain, 100);
  desktopGesture.d.dispatchEvent(new desktopGesture.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  check(!desktopGesture.w.location.hash, 'Desktop overview ignores detail navigation inputs');
  desktopGesture.click(label(desktopGesture, '[data-project="chip"]'));
  check(desktopGesture.d.activeElement === label(desktopGesture, '.projects-title'),
    'Opening a desktop project still focuses its heading');
  check(desktopGesture.w.getComputedStyle(desktopGesture.d.body).getPropertyValue('--project-focus').trim() === '#d2c5b0',
    'Detail focus outlines use the softer sandstone colour');
  desktopGesture.d.dispatchEvent(new desktopGesture.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  check(desktopGesture.w.location.hash === '#wit' &&
    desktopGesture.d.activeElement !== label(desktopGesture, '.projects-title'),
  'Arrow navigation removes the old title focus instead of outlining the new title');
  desktopGesture.d.dispatchEvent(new desktopGesture.w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  check(desktopGesture.w.location.hash === '#chip', 'Reverse arrow returns to the starting detail');
  const horizontalWheel = desktopGesture.wheel(desktopMain, 140);
  desktopGesture.wheel(desktopMain, -140);
  check(desktopGesture.w.location.hash === '#chip' && !horizontalWheel.defaultPrevented,
    'Desktop horizontal trackpad scrolling leaves project navigation and browser gestures alone');
  desktopGesture.d.dispatchEvent(new desktopGesture.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  check(desktopGesture.w.location.hash === '#wit' &&
    desktopGesture.d.activeElement !== label(desktopGesture, '.projects-title') &&
    label(desktopGesture, '.project-announcement').textContent.includes('WIT'),
  'Right arrow opens and announces the next desktop detail without focusing its heading');
  const desktopContentLink = label(desktopGesture, '.projects-copy a');
  desktopContentLink.focus();
  desktopContentLink.dispatchEvent(new desktopGesture.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  check(desktopGesture.w.location.hash === '#wit', 'Desktop arrow keys leave focused content links alone');
  desktopGesture.d.dispatchEvent(new desktopGesture.w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  check(desktopGesture.w.location.hash === '#chip', 'Left arrow opens the previous desktop detail');
  const desktopNextButton = label(desktopGesture, '.project-next');
  desktopNextButton.focus();
  desktopNextButton.dispatchEvent(new desktopGesture.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  check(desktopGesture.w.location.hash === '#wit' && desktopGesture.d.activeElement === desktopNextButton,
    'Arrow navigation works while a pagination button retains focus');
  desktopNextButton.dispatchEvent(new desktopGesture.w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  check(desktopGesture.w.location.hash === '#chip', 'Left arrow also works from a pagination button');
  desktopGesture.d.dispatchEvent(new desktopGesture.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, repeat: true }));
  check(desktopGesture.w.location.hash === '#chip', 'Held arrow keys cannot skip through projects');
  desktopGesture.click(label(desktopGesture, '.project-previous'));
  check(desktopGesture.w.location.hash === '#connect3' &&
    label(desktopGesture, '.project-position').textContent === '5 / 5',
  'Desktop previous control wraps and updates its position');
  desktopGesture.w.scrollY = 240;
  desktopGesture.w.dispatchEvent(new desktopGesture.w.Event('scroll'));
  desktopGesture.advance(32);
  desktopGesture.w.history.back(); await flush(desktopGesture);
  desktopGesture.w.history.forward(); await flush(desktopGesture);
  check(desktopGesture.w.location.hash === '#connect3' && desktopGesture.w.scrollY === 240,
  'Desktop Back and Forward restore the selected detail and its reading position');
  desktopGesture.click(label(desktopGesture, '.projects-back'));
  await flush(desktopGesture);
  check(!desktopGesture.w.location.hash && label(desktopGesture, '.project-pagination').hidden &&
    desktopGesture.d.activeElement.dataset.project === 'connect3',
  'Desktop All projects returns to the overview after several detail changes');
  desktopGesture.close();

  const desktopWho = page('who-i-am.html', { width: 1512, height: 982 });
  const desktopKeepsake = label(desktopWho, '[data-keepsake="drawing-closer"]');
  desktopWho.pointer(desktopKeepsake, 'pointerdown', { pointerType: 'mouse' });
  desktopWho.click(desktopKeepsake, 1, false);
  check(desktopKeepsake.getAttribute('aria-pressed') === 'false', 'Desktop mouse clicks do not create persistent selection');
  desktopWho.click(desktopKeepsake, 0);
  check(desktopKeepsake.getAttribute('aria-pressed') === 'true', 'Original desktop keyboard selection preserved');
  desktopWho.pointer(label(desktopWho, '.site-nav'), 'pointerdown', { pointerType: 'mouse' });
  check(desktopKeepsake.getAttribute('aria-pressed') === 'false', 'Desktop outside dismissal restored');
  check([...desktopWho.d.querySelectorAll('.who-keepsake img')].every((image) =>
    fs.existsSync(path.join(root, image.getAttribute('src')))) &&
    fs.existsSync(path.join(root, 'assets/whoIAm/ascii/silhouette.svg')),
  'Renamed Who I Am artwork paths resolve');
  desktopWho.close();

  const desktopContact = page('contact.html', { width: 1512, height: 982 });
  check(label(desktopContact, '.contact-portrait').getAttribute('src') === 'assets/contact/emma.webp' &&
    fs.existsSync(path.join(root, 'assets/contact/emma (1).svg')) &&
    fs.existsSync(path.join(root, 'assets/contact/emma.webp')) && label(desktopContact, '.contact-morph'),
  'Contact scroll scene uses the supplied ASCII portrait and a morph canvas');
  check(desktopContact.d.querySelectorAll('.contact-links a').length === 4 &&
    [...desktopContact.d.querySelectorAll('.contact-links a')].every((link) => link.typewriter) &&
    !label(desktopContact, '.contact-submenu') &&
    label(desktopContact, '.contact-link').getAttribute('href') === 'contact.html' &&
    label(desktopContact, '.contact-link').getAttribute('aria-current') === 'page',
  'Contact methods are real links below the copy, outside the selected navigation link');
  const contactMethod = label(desktopContact, '.contact-links a');
  check(desktopContact.w.getComputedStyle(contactMethod).textDecoration === 'underline' &&
    desktopContact.w.getComputedStyle(contactMethod.querySelector('.typewriter-link__text')).textDecoration === 'underline' &&
    desktopContact.w.getComputedStyle(contactMethod).whiteSpace === 'nowrap',
  'Contact methods stay underlined and keep the typing cursor on one line');
  desktopContact.pointer(contactMethod, 'mouseenter', { pointerType: 'mouse' });
  check(contactMethod.classList.contains('is-typing') &&
    contactMethod.querySelector('.typewriter-link__text').textContent === 'L',
  'Contact methods type on hover');
  desktopContact.pointer(contactMethod, 'mouseleave', { pointerType: 'mouse' });
  check(!contactMethod.classList.contains('is-typing') &&
    contactMethod.querySelector('.typewriter-link__text').textContent === 'LinkedIn',
  'Contact method text restores after hover');
  check(desktopContact.w.getComputedStyle(label(desktopContact, '.contact-stage')).position === 'sticky' &&
    desktopContact.w.getComputedStyle(label(desktopContact, '.contact-portrait')).top === '40px' &&
    desktopContact.w.getComputedStyle(label(desktopContact, '.contact-page .site-nav')).top === '80%' &&
    desktopContact.w.getComputedStyle(label(desktopContact, '.contact-intro')).fontSize === '16px' &&
    desktopContact.w.getComputedStyle(label(desktopContact, '.contact-intro')).textAlign === 'justify' &&
    desktopContact.w.getComputedStyle(label(desktopContact, '.contact-intro')).textAlignLast === 'justify' &&
    desktopContact.w.getComputedStyle(label(desktopContact, '.contact-intro')).textWrap === 'balance' &&
    !label(desktopContact, '.intro-row, .intro-line') &&
    desktopContact.w.getComputedStyle(label(desktopContact, '.contact-links a')).fontSize === '16px' &&
    desktopContact.w.getComputedStyle(label(desktopContact, '.contact-links a')).fontWeight === '700',
  'Desktop Contact holds its lower navigation and uses matching 16px copy and links');
  desktopContact.close();

  const hybrid = page('who-i-am.html', { width: 1512, height: 450, coarse: true, hover: true });
  check(!hybrid.w.siteLayout.matches, 'Hybrid mouse laptop and short desktop keep desktop layout');
  hybrid.advance(4000);
  check(!hybrid.d.querySelector('.who-keepsake.is-active'), 'Hybrid desktop does not run mobile ghost previews');
  hybrid.close();

  const contact = page('contact.html', { saved: { 'emma-motion-paused': 'true' } });
  check(!contact.w.siteMotion.stopped && !contact.d.querySelector('.motion-toggle'), 'Old pause setting has no effect on Contact');
  check(contact.d.querySelectorAll('.contact-links a').length === 4 &&
    label(contact, '.contact-art source').getAttribute('srcset') === 'assets/contact/emma_mobile.webp' &&
    fs.existsSync(path.join(root, 'assets/contact/emma_mobile.svg')) &&
    fs.existsSync(path.join(root, 'assets/contact/emma_mobile.webp')) &&
    contact.w.getComputedStyle(label(contact, '.contact-page .site-nav')).position === 'fixed' &&
    contact.w.getComputedStyle(label(contact, '.contact-stage')).position === 'relative',
  'Compact Contact uses the supplied portrait and keeps its top navigation visible');
  check(!label(contact, '.intro-row, .intro-line') &&
    contact.w.getComputedStyle(label(contact, '.contact-intro')).fontSize === '16px' &&
    contact.w.getComputedStyle(label(contact, '.contact-intro')).textAlignLast === 'left' &&
    contact.w.getComputedStyle(label(contact, '.contact-links')).flexWrap === 'wrap' &&
    contact.w.getComputedStyle(label(contact, '.contact-links a')).fontSize === '16px' &&
    contact.w.getComputedStyle(label(contact, '.contact-links a')).minWidth === '44px' &&
    contact.w.getComputedStyle(label(contact, '.contact-links a')).minHeight === '44px',
  'Compact Contact copy wraps at 16px and contact links wrap with touch targets');
  const compactContactMethod = label(contact, '.contact-links a');
  contact.pointer(compactContactMethod, 'pointerenter', { pointerType: 'mouse' });
  contact.advance(0);
  check(compactContactMethod.classList.contains('is-typing'),
  'Compact Contact methods use the shared hover typewriter');
  contact.pointer(compactContactMethod, 'pointerleave', { pointerType: 'mouse' });
  for (const p of [contact]) {
    check(!p.errors.length, 'No DOM runtime errors');
    p.close();
  }
  console.log(`Passed ${checks} DOM interaction checks. Layout, native gestures and assistive technology require browser/device QA.`);
})();

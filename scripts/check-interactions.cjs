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
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));
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
  function hide(value) { hidden = value; w.document.dispatchEvent(new w.Event('visibilitychange')); }
  return { w, d: w.document, advance, pointer, click, swipe, hide, media, observers, tasks, errors, close: () => { assert.equal(errors.length, 0, errors.map((e) => e.message).join('\n')); dom.window.close(); } };
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
    const result = new Map(rules.map((rule) => [rule.selectorText, rule.style.cssText.replace(/\s+/g, ' ').trim()]));
    dom.window.close();
    return result;
  }
  let cssDeclarations = 0;
  for (const [cssFile, baselineFile] of [['global.css', 'global.css'], ['projects.css', 'projects.css'], ['who-i-am.css', 'who-i-am.css'], ['home.css', 'index.html'], ['contact.css', 'contact.html']]) {
    let source = baselineSource(baselineFile);
    if (baselineFile.endsWith('.html')) source = source.match(/<style>([\s\S]*?)<\/style>/)[1];
    const before = desktopRules(source);
    const after = desktopRules(fs.readFileSync(path.join(root, cssFile), 'utf8'));
    for (const [selector, declaration] of before) {
      if (selector === '.mobile-scroll') continue; // Retired mobile prototype has no desktop layout box.
      assert.equal(after.get(selector), declaration, `Original desktop CSS changed: ${cssFile} ${selector}`);
      cssDeclarations++;
    }
  }
  console.log(`Desktop CSS baseline matches ${cssDeclarations} original rules.`);
  const home = page('index.html', { saved: { 'emma-motion-paused': 'true' } });
  const area = label(home, '.home-artwork');
  check(!label(home, '.spotlight-reveal').hidden, 'Home has Reveal before interaction');
  check(!label(home, '.site-nav').classList.contains('is-ready') && label(home, '.site-nav').inert &&
    label(home, '.site-nav').getAttribute('aria-hidden') === 'true' &&
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
  home.swipe(area, 100);
  home.click(area);
  check(!home.d.body.classList.contains('is-revealed'), 'Dragging/releasing artwork cannot reveal Home');
  home.click(label(home, '.spotlight-reveal'));
  check(home.d.body.classList.contains('is-revealed') && !label(home, '.site-nav').classList.contains('is-ready'),
  'Reveal begins dismissing spotlight before showing menu');
  check(home.w.getComputedStyle(label(home, '.prelude-title')).display === 'none' &&
    home.w.getComputedStyle(label(home, '.site-nav')).visibility === 'hidden',
    'Single Emma Xu label waits for the menu reveal during the spotlight fade');
  home.advance(350);
  check(label(home, '.site-nav').classList.contains('is-ready') && !label(home, '.site-nav').inert,
  'Centered menu appears once spotlight has gone');
  home.click(label(home, '.spotlight-replay'));
  check(!home.d.body.classList.contains('is-revealed') && label(home, '.site-nav').inert,
  'Replay restores mask and hides the menu');
  home.click(label(home, '.spotlight-reveal'));
  home.advance(350);
  const disclosure = label(home, '.page-menu a[href="index.html"]');
  home.click(disclosure);
  check(disclosure.getAttribute('aria-expanded') === 'true', 'Disclosure opens');
  check([...home.d.querySelectorAll('.page-menu a')].every((a) => a.getAttribute('aria-label')), 'Typing links retain complete accessible labels');
  home.advance(100);
  home.click(disclosure); home.click(disclosure);
  home.d.dispatchEvent(new home.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check(disclosure.getAttribute('aria-expanded') === 'false' && home.d.activeElement === disclosure, 'Escape dismisses and restores focus');
  home.click(disclosure);
  home.pointer(area, 'pointerdown');
  check(disclosure.getAttribute('aria-expanded') === 'false', 'Outside pointer dismisses menu');
  check(!home.d.querySelector('.motion-toggle') && !home.w.siteMotion.stopped, 'Pause UI and stored pause functionality removed');
  check(!home.d.querySelector('.mobile-navigation, .menu-disclosure'), 'Mobile reuses desktop text navigation without duplicate dropdown');
  const revealStyle = home.w.getComputedStyle(label(home, '.spotlight-reveal'));
  check(revealStyle.fontSize === '12px' && revealStyle.borderTopWidth === '0px' && revealStyle.backgroundColor === 'rgba(0, 0, 0, 0)', 'Reveal is small text without a border or background');
  check(home.w.getComputedStyle(label(home, '.prelude-mask')).getPropertyValue('--reveal-radius').includes('64px'), 'Smaller spotlight applies only to mobile');
  home.click(disclosure);
  let destinationActivated = false;
  label(home, '.page-menu a[href="projects.html"]').addEventListener('click', (event) => { destinationActivated = true; event.preventDefault(); });
  home.click(label(home, '.page-menu a[href="projects.html"]'));
  check(destinationActivated && disclosure.getAttribute('aria-expanded') === 'false', 'Desktop-style mobile menu destinations activate immediately');
  home.hide(true);
  home.advance(1000);
  check(home.tasks.size === 0, 'Hidden Home has no queued motion or typing');
  home.close();

  const typeHome = page('index.html', { saved: { 'emma-home-revealed': 'true' } });
  const typeTrigger = label(typeHome, '.page-menu a[href="index.html"]');
  const typeOrder = [];
  for (const href of ['projects.html', 'who-i-am.html']) {
    const link = label(typeHome, `.page-menu a[href="${href}"]`);
    const playOnce = link.typewriter.playOnce;
    link.typewriter.playOnce = (done) => { typeOrder.push(href); playOnce(done); };
  }
  typeHome.click(typeTrigger);
  typeHome.advance(220);
  check(typeOrder.length === 1 && typeOrder[0] === 'projects.html', 'Mobile Home types Projects first after revealing both links');
  const cursorRules = [...typeHome.d.styleSheets].flatMap((sheet) => [...sheet.cssRules]);
  const cursorOnLink = cursorRules.find((rule) => rule.selectorText === '.site-nav .typewriter-link.is-typing::after');
  const cursorOnText = cursorRules.find((rule) => rule.selectorText === '.site-nav .typewriter-link.is-typing .typewriter-link__text::after');
  check(label(typeHome, '.page-menu a[href="projects.html"]').classList.contains('is-typing') &&
    cursorOnLink?.style.content === 'none' && cursorOnText?.style.display === 'inline-block' &&
    !cursorOnText?.style.position,
  'Compact navigation typing cursor is inline with the text instead of positioned on the link');
  typeHome.advance(6000);
  check(typeOrder.slice(0, 3).join(',') === 'projects.html,who-i-am.html,projects.html',
    'Mobile Home types Who I am next and repeats the sequence while open');
  typeHome.click(typeTrigger);
  const stoppedCount = typeOrder.length;
  typeHome.advance(6000);
  check(typeTrigger.getAttribute('aria-expanded') === 'false' && typeOrder.length === stoppedCount,
    'Second Emma Xu tap closes menu and stops its typing sequence');
  typeHome.click(typeTrigger);
  typeHome.advance(220);
  typeHome.click(label(typeHome, '.spotlight-replay'));
  const replayCount = typeOrder.length;
  typeHome.advance(3000);
  check(label(typeHome, '.site-nav').inert && typeTrigger.getAttribute('aria-expanded') === 'false' &&
    typeOrder.length === replayCount, 'Replay hides and closes the menu and cancels typing');
  typeHome.close();

  const stillHome = page('index.html', { reduced: true, saved: { 'emma-home-revealed': 'true' } });
  stillHome.click(label(stillHome, '.page-menu a[href="index.html"]'));
  stillHome.advance(1000);
  check([...stillHome.d.querySelectorAll('.page-menu a')].every((link) => !link.classList.contains('is-typing')),
    'Reduced motion keeps Home menu labels complete without typing');
  stillHome.close();
  const stillSpotlight = page('index.html', { reduced: true });
  stillSpotlight.click(label(stillSpotlight, '.spotlight-reveal'));
  check(label(stillSpotlight, '.site-nav').classList.contains('is-ready'),
    'Reduced motion shows centered menu immediately when spotlight disappears');
  stillSpotlight.close();

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
  who.click(label(who, '.page-menu a[href="index.html"]'));
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
    check(label(direct, '.projects-title').textContent === direct.w.projectConfig.projects.find((p) => p.id === id).title, `Direct ${id} route renders matching content`);
    direct.click(label(direct, '.projects-back'));
    check(!direct.w.location.hash && label(direct, '.projects-heading').hidden, 'Direct-route All projects works');
    direct.close();
  }

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
  check(!label(flip, '.projects-experience').classList.contains('is-copy-fading') &&
    flip.w.getComputedStyle(flipCopy).backgroundColor === 'rgba(0, 0, 0, 0)',
  'Mobile return keeps the copy background transparent without desktop fade styling');
  flip.close();

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
    saved: { 'emma-home-revealed': 'true', 'emma-motion-paused': 'true' } });
  check(!desktopHome.w.siteLayout.matches && !desktopHome.w.siteMotion.stopped, 'Mobile session state does not alter desktop motion');
  check(!label(desktopHome, '.site-nav').classList.contains('is-ready'), 'Desktop Home starts with original masked navigation');
  check(!label(desktopHome, '.prelude').hidden && !label(desktopHome, '.prelude-title').hidden &&
    label(desktopHome, '.prelude-title').textContent === 'Emma Xu', 'Desktop masked name restored');
  check(desktopHome.w.getComputedStyle(label(desktopHome, '.spotlight-tools')).display === 'none', 'Reveal/Replay controls remain mobile only');
  check(!desktopHome.d.querySelector('.motion-toggle'), 'Desktop has no motion button');
  desktopHome.click(label(desktopHome, '.prelude'));
  desktopHome.advance(350);
  check(label(desktopHome, '.prelude').hidden && label(desktopHome, '.site-nav').classList.contains('is-ready'), 'Desktop click dismissal and 350ms navigation reveal restored');
  check(!label(desktopHome, '.page-menu a span').style.width, 'Desktop typewriter uses original measured link width');
  desktopHome.w.siteLayout.matches = true;
  desktopHome.w.siteLayout.dispatchEvent(new desktopHome.w.Event('change'));
  check(!desktopHome.w.siteMotion.stopped && !label(desktopHome, '.spotlight-replay').hidden, 'Changing to mobile keeps revealed state and ignores removed pause setting');
  desktopHome.w.siteLayout.matches = false;
  desktopHome.w.siteLayout.dispatchEvent(new desktopHome.w.Event('change'));
  check(!desktopHome.w.siteMotion.stopped && !label(desktopHome, '.site-nav').classList.contains('is-ready') &&
    !label(desktopHome, '.prelude-title').hidden, 'Changing back restores desktop controller and masked name');
  desktopHome.close();

  const desktopProjects = page('projects.html', { width: 1512, height: 982 });
  check(label(desktopProjects, '.overview-navigation').hidden, 'Desktop overview hints remain hidden');
  desktopProjects.click(label(desktopProjects, '[data-project="chip"]'));
  await flush(desktopProjects);
  check(!label(desktopProjects, '.projects-heading').classList.contains('is-title-visible'), 'Desktop title waits for original morph phase');
  check(label(desktopProjects, '.projects-copy').inert, 'Desktop copy retains original reveal phase');
  check(label(desktopProjects, '.project-pagination').hidden, 'Desktop has no added pagination');
  check(desktopProjects.w.getComputedStyle(label(desktopProjects, '.projects-back')).paddingTop === '0px', 'Desktop back-button spacing restored');
  desktopProjects.advance(680);
  check(label(desktopProjects, '.projects-heading').classList.contains('is-title-visible'), 'Desktop title reveals in latter half of morph');
  check(label(desktopProjects, '.projects-copy').inert, 'Desktop copy follows title in morph');
  desktopProjects.advance(650);
  check(!label(desktopProjects, '.projects-copy').inert, 'Desktop settled project copy usable');
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
  check(label(desktopDk, '.projects-copy').hidden && label(desktopDk, '.project-pagination').hidden, 'Desktop project without copy keeps original layout');
  desktopDk.close();

  const desktopWho = page('who-i-am.html', { width: 1512, height: 982 });
  const desktopKeepsake = label(desktopWho, '[data-keepsake="drawing-closer"]');
  desktopWho.pointer(desktopKeepsake, 'pointerdown', { pointerType: 'mouse' });
  desktopWho.click(desktopKeepsake, 1, false);
  check(desktopKeepsake.getAttribute('aria-pressed') === 'false', 'Desktop mouse clicks do not create persistent selection');
  desktopWho.click(desktopKeepsake, 0);
  check(desktopKeepsake.getAttribute('aria-pressed') === 'true', 'Original desktop keyboard selection preserved');
  desktopWho.pointer(label(desktopWho, '.site-nav'), 'pointerdown', { pointerType: 'mouse' });
  check(desktopKeepsake.getAttribute('aria-pressed') === 'false', 'Desktop outside dismissal restored');
  desktopWho.close();

  const desktopContact = page('contact.html', { width: 1512, height: 982 });
  check(label(desktopContact, '.contact-menu .contact-submenu'), 'Desktop Contact submenu restored in original navigation');
  check(desktopContact.w.getComputedStyle(label(desktopContact, '.contact-submenu')).visibility === 'hidden', 'Desktop Contact links start hidden');
  check(label(desktopContact, '.contact-link').getAttribute('href') === '#contact-links', 'Desktop Contact trigger controls submenu');
  desktopContact.click(label(desktopContact, '.contact-link'));
  check(label(desktopContact, '.contact-link').getAttribute('aria-expanded') === 'true', 'Desktop Contact click opens submenu');
  label(desktopContact, '.contact-menu').dispatchEvent(new desktopContact.w.Event('mouseleave'));
  check(label(desktopContact, '.contact-link').getAttribute('aria-expanded') === 'false', 'Desktop Contact mouse leave dismisses submenu');
  label(desktopContact, '.contact-submenu a').focus();
  check(label(desktopContact, '.contact-link').getAttribute('aria-expanded') === 'true', 'Desktop Contact submenu remains keyboard accessible');
  check(desktopContact.w.getComputedStyle(label(desktopContact, '.contact-intro')).lineHeight === '1.1', 'Desktop introduction typography restored');
  desktopContact.close();

  const hybrid = page('who-i-am.html', { width: 1512, height: 450, coarse: true, hover: true });
  check(!hybrid.w.siteLayout.matches, 'Hybrid mouse laptop and short desktop keep desktop layout');
  hybrid.advance(4000);
  check(!hybrid.d.querySelector('.who-keepsake.is-active'), 'Hybrid desktop does not run mobile ghost previews');
  hybrid.close();

  const contact = page('contact.html', { saved: { 'emma-motion-paused': 'true' } });
  check(!contact.w.siteMotion.stopped && !contact.d.querySelector('.motion-toggle'), 'Old pause setting has no effect on Contact');
  check(contact.d.querySelectorAll('.contact-submenu a').length === 4, 'Mobile Contact reuses the four desktop submenu links');
  check(label(contact, '.contact-link').getAttribute('href') === '#contact-links', 'Mobile Contact uses the desktop menu trigger');
  contact.click(label(contact, '.contact-link'));
  check(label(contact, '.contact-link').getAttribute('aria-expanded') === 'true' && contact.w.getComputedStyle(label(contact, '.contact-submenu')).visibility === 'visible', 'Touch opens Contact submenu');
  contact.click(label(contact, '.contact-link'));
  check(label(contact, '.contact-link').getAttribute('aria-expanded') === 'false', 'Second touch closes Contact submenu');
  contact.click(label(contact, '.contact-link'));
  contact.d.dispatchEvent(new contact.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check(label(contact, '.contact-link').getAttribute('aria-expanded') === 'false' && contact.d.activeElement === label(contact, '.contact-link'), 'Contact Escape dismissal restores focus');
  contact.click(label(contact, '.contact-link'));
  contact.pointer(label(contact, '.contact-intro'), 'pointerdown');
  check(label(contact, '.contact-link').getAttribute('aria-expanded') === 'false', 'Outside tap dismisses Contact submenu');
  for (const p of [contact]) {
    check(!p.errors.length, 'No DOM runtime errors');
    p.close();
  }
  console.log(`Passed ${checks} DOM interaction checks. Layout, native gestures and assistive technology require browser/device QA.`);
})();

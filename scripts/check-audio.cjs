const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

// Focused sound checks; run with the same separate jsdom install as check-interactions.cjs.
const root = path.resolve(__dirname, '..');
const dom = new JSDOM(`<!doctype html><body><nav class="site-nav is-ready"><div class="page-menu"><a class="selected" href="projects.html">Projects</a><a href="index.html">Emma Xu</a><a href="who-i-am.html">Who I am</a></div><a class="contact-link" href="contact.html">Contact</a></nav><a id="compact-link">Compact link</a></body>`, {
  url: 'https://portfolio.example/projects.html', runScripts: 'outside-only', pretendToBeVisual: true,
});
const w = dom.window;
let hidden = false;
let clock = 0;
let blockSamples = false;
let blockedAttempts = 0;
Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => hidden });
Object.defineProperty(w.performance, 'now', { configurable: true, value: () => clock });
w.requestAnimationFrame = (callback) => w.setTimeout(() => callback(clock + 25), 0);
w.cancelAnimationFrame = (id) => w.clearTimeout(id);
const states = new WeakMap();
const state = (audio) => {
  if (!states.has(audio)) states.set(audio, { paused: true, time: 0, plays: 0 });
  return states.get(audio);
};
const proto = w.HTMLMediaElement.prototype;
Object.defineProperties(proto, {
  paused: { get() { return state(this).paused; } },
  readyState: { get() { return 4; } },
  duration: { get() { return this.src.includes('ghosts') ? 133.824 : 0.26; } },
  currentTime: {
    get() { return state(this).time; },
    set(value) { state(this).time = value; },
  },
});
proto.play = function () {
  if (blockSamples && this.src.includes('keypress-')) {
    blockedAttempts++;
    return Promise.reject(new w.DOMException('Blocked', 'NotAllowedError'));
  }
  state(this).plays++;
  state(this).paused = false;
  this.dispatchEvent(new w.Event('playing'));
  return Promise.resolve();
};
proto.pause = function () {
  if (state(this).paused) return;
  state(this).paused = true;
  this.dispatchEvent(new w.Event('pause'));
};
const motion = { stopped: false, subscribe() {} };
const layout = new w.EventTarget();
layout.matches = false;
w.siteMotion = motion;
w.siteLayout = layout;
w.sessionStorage.setItem('emma-background-music', JSON.stringify({ time: 31, playing: true }));
w.eval(fs.readFileSync(`${root}/music.js`, 'utf8'));
w.eval(fs.readFileSync(`${root}/navigation.js`, 'utf8'));
w.dispatchEvent(new w.Event('pageshow'));
const [music, ...samples] = w.document.querySelectorAll('audio');
const button = w.document.querySelector('.music-toggle');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const playCount = () => samples.reduce((count, audio) => count + state(audio).plays, 0);
const playingSamples = () => samples.filter((audio) => !audio.paused);
const finishSample = (audio) => {
  state(audio).paused = true;
  audio.dispatchEvent(new w.Event('ended'));
};

(async () => {
  assert.equal(music.currentTime, 0, 'new track resets the old saved position');
  assert.equal(music.paused, false, 'prior enabled setting carries to the new track');
  assert.equal(button.getAttribute('aria-label'), 'Mute all sound');
  assert.equal(samples.length, 6, 'only the six keypress clips are loaded');
  samples.forEach((audio, index) => assert.ok(audio.src.endsWith(`keypress-0${index + 1}.wav`)));

  const link = w.document.querySelector('a[href="projects.html"]');
  link.typewriter.playOnce();
  assert.equal(link.querySelector('.typewriter-link__text').textContent, 'P');
  assert.equal(playCount(), 1, 'first visible character triggers one keypress');
  link.typewriter.reset();
  await wait(50);
  assert.equal(playingSamples().length, 0, 'cancel fades and stops its keypress');

  const first = {}, second = {};
  clock += 100;
  w.siteTypingAudio.character(first, 'A');
  assert.equal(playCount(), 2);
  w.siteTypingAudio.character(second, 'B');
  assert.equal(playCount(), 2, 'simultaneous labels obey the combined rate cap');
  clock += 65;
  w.siteTypingAudio.character(second, 'C');
  assert.equal(playCount(), 3, 'the next interval can use a second sample');
  assert.equal(playingSamples().length, 2);
  w.siteTypingAudio.cancel(first);
  await wait(50);
  assert.equal(playingSamples().length, 1, 'cancel stops only that writer');
  w.siteTypingAudio.stop(second);
  assert.equal(playingSamples().length, 1, 'completed keypress finishes naturally');
  finishSample(playingSamples()[0]);
  assert.equal(playingSamples().length, 0);

  const whitespace = {};
  clock += 100;
  w.siteTypingAudio.character(whitespace, ' ');
  w.siteTypingAudio.character(whitespace, '\n');
  assert.equal(playCount(), 3, 'spaces and newlines stay silent');
  w.siteTypingAudio.character(whitespace, 'D');
  assert.equal(playCount(), 4);
  button.click();
  assert.equal(music.paused, true);
  assert.equal(playingSamples().length, 0, 'master mute stops keypresses immediately');
  button.click();
  assert.equal(music.paused, false);
  assert.equal(playCount(), 4, 'unmute never replays a missed character');
  clock += 100;
  w.siteTypingAudio.character(whitespace, 'E');
  assert.equal(playCount(), 5, 'the next visible character sounds after unmute');
  w.siteTypingAudio.cancel(whitespace);
  await wait(50);

  layout.matches = true;
  const compact = w.document.querySelector('#compact-link');
  w.attachTypewriter(compact);
  clock += 100;
  compact.typewriter.play(40);
  const beforeCompact = playCount();
  assert.equal(playCount(), beforeCompact, 'a delayed animation starts silent');
  await wait(60);
  assert.equal(playCount(), beforeCompact + 1, 'compact first character triggers a sample');
  compact.typewriter.reset();
  await wait(50);
  assert.equal(playingSamples().length, 0);

  clock += 100;
  w.siteTypingAudio.character({}, 'H');
  assert.equal(playingSamples().length, 1);
  hidden = true;
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(playingSamples().length, 0, 'hidden page stops effects immediately');
  hidden = false;
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(playingSamples().length, 0, 'returning does not replay missed keypresses');
  motion.stopped = true;
  clock += 100;
  const beforeReduced = playCount();
  w.siteTypingAudio.character({}, 'R');
  assert.equal(playCount(), beforeReduced, 'reduced motion suppresses sound');
  motion.stopped = false;

  blockSamples = true;
  clock += 100;
  const blockedWriter = {};
  w.siteTypingAudio.character(blockedWriter, 'X');
  await Promise.resolve();
  clock += 100;
  w.siteTypingAudio.character(blockedWriter, 'Y');
  assert.equal(blockedAttempts, 1, 'blocked playback does not retry within the animation');
  w.siteTypingAudio.stop(blockedWriter);
  assert.equal(playingSamples().length, 0, 'blocked sound never queues a replay');

  music.currentTime = 42;
  w.dispatchEvent(new w.Event('pagehide'));
  assert.equal(JSON.parse(w.sessionStorage.getItem('emma-background-music')).time, 42,
    'page exit saves the exact music position');

  dom.window.close();
  console.log('Focused audio checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

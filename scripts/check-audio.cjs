const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

// Focused sound-state checks; run with the same separate jsdom install as check-interactions.cjs.
const root = path.resolve(__dirname, '..');
const dom = new JSDOM(`<!doctype html><body><nav class="site-nav is-ready"><div class="page-menu"><a class="selected" href="projects.html">Projects</a><a href="index.html">Emma Xu</a><a href="who-i-am.html">Who I am</a></div><a class="contact-link" href="contact.html">Contact</a></nav><a id="compact-link">Compact link</a></body>`, {
  url: 'https://portfolio.example/projects.html', runScripts: 'outside-only', pretendToBeVisual: true,
});
const w = dom.window;
let hidden = false;
Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => hidden });
const states = new WeakMap();
const state = (audio) => {
  if (!states.has(audio)) states.set(audio, { paused: true, time: 0, plays: 0 });
  return states.get(audio);
};
const proto = w.HTMLMediaElement.prototype;
Object.defineProperties(proto, {
  paused: { get() { return state(this).paused; } },
  readyState: { get() { return 4; } },
  duration: { get() { return this.src.includes('ghosts') ? 133.824 : 70.896; } },
  currentTime: {
    get() { return state(this).time; },
    set(value) { state(this).time = value; },
  },
});
proto.play = function () {
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
const [music, typing] = w.document.querySelectorAll('audio');
const button = w.document.querySelector('.music-toggle');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  assert.equal(music.currentTime, 0, 'new track resets the old saved position');
  assert.equal(music.paused, false, 'prior enabled setting carries to new track');
  assert.equal(button.getAttribute('aria-label'), 'Mute all sound');

  const link = w.document.querySelector('a[href="projects.html"]');
  link.typewriter.playOnce();
  assert.equal(link.querySelector('.typewriter-link__text').textContent, 'P');
  assert.equal(typing.paused, false, 'first character starts typing audio');
  assert.equal(typing.currentTime, 0.06, 'recording skips leading silence');
  link.typewriter.reset();
  await wait(120);
  assert.equal(typing.paused, true, 'reset fades and stops typing audio');

  const first = {}, second = {};
  w.siteTypingAudio.character(first);
  const plays = state(typing).plays;
  w.siteTypingAudio.character(second);
  assert.equal(state(typing).plays, plays, 'overlapping writers share one playback');
  w.siteTypingAudio.stop(first);
  assert.equal(typing.paused, false, 'first cancellation leaves second writer audible');
  button.click();
  assert.equal(music.paused, true);
  assert.equal(typing.paused, true, 'master mute stops both immediately');
  button.click();
  assert.equal(music.paused, false);
  assert.equal(typing.paused, false, 'unmute resumes active typing');
  w.siteTypingAudio.stop(second);
  await wait(120);
  assert.equal(typing.paused, true, 'last writer stops the effect');

  layout.matches = true;
  const compact = w.document.querySelector('#compact-link');
  w.attachTypewriter(compact);
  compact.typewriter.play(80);
  assert.equal(typing.paused, true, 'compact delayed typing is silent before its first character');
  await wait(100);
  assert.equal(typing.paused, false, 'compact first character starts the effect');
  compact.typewriter.reset();
  await wait(120);
  assert.equal(typing.paused, true, 'compact cancellation stops it');

  const hiddenWriter = {};
  w.siteTypingAudio.character(hiddenWriter);
  assert.equal(typing.paused, false);
  hidden = true;
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(typing.paused, true, 'hiding the page stops effects immediately');
  hidden = false;
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(typing.paused, true, 'returning to the page does not replay effects');
  motion.stopped = true;
  const reducedWriter = {};
  w.siteTypingAudio.character(reducedWriter);
  assert.equal(typing.paused, true, 'reduced motion suppresses typing audio');
  w.siteTypingAudio.stop(reducedWriter);
  motion.stopped = false;

  let blockedAttempts = 0;
  typing.play = () => {
    blockedAttempts++;
    return Promise.reject(new w.DOMException('Blocked', 'NotAllowedError'));
  };
  const blockedWriter = {};
  w.siteTypingAudio.character(blockedWriter);
  await Promise.resolve();
  w.siteTypingAudio.character(blockedWriter);
  assert.equal(blockedAttempts, 1, 'blocked playback does not retry on later characters');
  w.siteTypingAudio.stop(blockedWriter);
  await wait(100);
  assert.equal(blockedAttempts, 1, 'blocked sound does not replay after the animation');

  music.currentTime = 42;
  w.dispatchEvent(new w.Event('pagehide'));
  assert.equal(JSON.parse(w.sessionStorage.getItem('emma-background-music')).time, 42,
    'page exit saves the exact music position');

  dom.window.close();
  console.log('Focused audio checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

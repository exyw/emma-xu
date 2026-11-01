(() => {
  // One master control owns music and per-character typing sounds on all pages.
  // Session storage carries the opt-in setting and track position across page loads.
  const storageKey = 'emma-background-music';
  const soundSettings = Object.freeze({
    track: 'ghosts-like-me',
    musicVolume: 0.42,
    typingVolume: 0.45,
    typingMinIntervalMs: 65,
    typingFadeMs: 25,
  });
  const music = document.createElement('audio');
  music.src = new URL('audio/ghosts-like-me.mp3', document.baseURI).href;
  music.loop = true;
  music.preload = 'metadata';
  music.volume = soundSettings.musicVolume;
  music.hidden = true;

  const keypresses = Array.from({ length: 6 }, (_, index) => {
    const audio = document.createElement('audio');
    audio.src = new URL(`audio/typing-keypresses/keypress-0${index + 1}.wav`, document.baseURI).href;
    audio.preload = 'auto';
    audio.volume = soundSettings.typingVolume;
    audio.hidden = true;
    return { audio, writer: null, busy: false, version: 0, fadeFrame: null };
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'music-toggle';
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon);

  function readState() {
    try {
      const state = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
      return {
        time: state.track === soundSettings.track && Number.isFinite(state.time) && state.time >= 0 ? state.time : 0,
        enabled: state.enabled === true || (state.enabled == null && state.playing === true),
      };
    } catch (_) {
      return { time: 0, enabled: false };
    }
  }

  const initialState = readState();
  let savedTime = initialState.time;
  let seekPending = false;
  let enabled = initialState.enabled;
  let musicBlocked = false;
  let resumePending = false;
  let leaving = false;
  let musicPlayVersion = 0;
  let lastTimeSave = 0;

  // Each typewriter owns a token, so cancellation only stops its own keypresses.
  const activeWriters = new Set();
  let typingBlocked = false;
  let lastKeypressAt = -Infinity;
  let lastKeypressIndex = -1;

  function updateButton() {
    const soundOn = enabled && !musicBlocked;
    icon.textContent = soundOn ? '[Ⅱ]' : '[▶]';
    button.setAttribute('aria-label', `${soundOn ? 'Mute' : 'Enable'} all sound`);
    button.title = `${soundOn ? 'Mute' : 'Enable'} all sound`;
  }

  function saveState(captureTime = true) {
    if (captureTime && !seekPending && Number.isFinite(music.currentTime) && music.currentTime >= 0) {
      savedTime = music.currentTime;
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        track: soundSettings.track, time: savedTime, enabled,
      }));
    } catch (_) { /* Sound still works when storage is unavailable. */ }
  }

  function restorePosition() {
    // Metadata must arrive before seeking; modulo handles a saved position
    // beyond the duration of the current copy of the track.
    if (!seekPending || music.readyState < 1) return;
    const duration = music.duration;
    const time = Number.isFinite(duration) && duration > 0 ? savedTime % duration : savedTime;
    try {
      music.currentTime = time;
      seekPending = false;
    } catch (_) { /* Try again after metadata arrives. */ }
  }

  function stopKeypress(keypress, immediate = false) {
    if (!keypress.busy) return;
    ++keypress.version;
    if (keypress.fadeFrame !== null) cancelAnimationFrame(keypress.fadeFrame);
    keypress.fadeFrame = null;
    const finish = () => {
      keypress.audio.volume = 0;
      keypress.audio.pause();
      keypress.audio.volume = soundSettings.typingVolume;
      keypress.busy = false;
      keypress.writer = null;
    };
    if (immediate || keypress.audio.paused) { finish(); return; }
    const start = performance.now();
    const initialVolume = keypress.audio.volume;
    function fade(now) {
      keypress.fadeFrame = null;
      const amount = Math.min(1, (now - start) / soundSettings.typingFadeMs);
      keypress.audio.volume = initialVolume * (1 - amount);
      if (amount < 1) keypress.fadeFrame = requestAnimationFrame(fade);
      else finish();
    }
    keypress.fadeFrame = requestAnimationFrame(fade);
  }

  function stopKeypresses(immediate = false, writer = null) {
    keypresses.forEach((keypress) => {
      if (writer === null || keypress.writer === writer) stopKeypress(keypress, immediate);
    });
  }

  keypresses.forEach((keypress) => {
    keypress.audio.addEventListener('ended', () => {
      if (keypress.fadeFrame !== null) cancelAnimationFrame(keypress.fadeFrame);
      keypress.fadeFrame = null;
      keypress.audio.volume = soundSettings.typingVolume;
      keypress.busy = false;
      keypress.writer = null;
    });
  });

  function playKeypress(writer, character) {
    // Drop sounds when busy or rate limited; delayed keypresses would no longer
    // line up with the typewriter's visible characters.
    if (!character || /\s/u.test(character) || !enabled || musicBlocked || leaving ||
        document.hidden || window.siteMotion.stopped || typingBlocked) return;
    const now = performance.now();
    if (now - lastKeypressAt < soundSettings.typingMinIntervalMs) return;
    const available = keypresses.filter((keypress) => !keypress.busy && keypress.audio.readyState >= 2);
    if (!available.length) return;
    const alternatives = available.filter((keypress) => keypresses.indexOf(keypress) !== lastKeypressIndex);
    const choices = alternatives.length ? alternatives : available;
    const keypress = choices[Math.floor(Math.random() * choices.length)];
    const index = keypresses.indexOf(keypress);
    keypress.busy = true;
    keypress.writer = writer;
    keypress.audio.volume = soundSettings.typingVolume;
    const version = ++keypress.version;
    try {
      keypress.audio.currentTime = 0;
      lastKeypressAt = now;
      lastKeypressIndex = index;
      keypress.audio.play()?.catch(() => {
        if (version !== keypress.version || leaving) return;
        typingBlocked = true;
        stopKeypresses(true);
      });
    } catch (_) {
      typingBlocked = true;
      stopKeypresses(true);
    }
  }

  window.siteTypingAudio = Object.freeze({
    character(writer, character) {
      if (!activeWriters.size) typingBlocked = false;
      activeWriters.add(writer);
      playKeypress(writer, character);
    },
    stop(writer) {
      activeWriters.delete(writer);
    },
    cancel(writer) {
      activeWriters.delete(writer);
      stopKeypresses(false, writer);
    },
  });

  function tryPlayMusic() {
    const version = ++musicPlayVersion;
    musicBlocked = false;
    updateButton();
    const result = music.play();
    result?.catch((error) => {
      if (leaving || version !== musicPlayVersion) return;
      if (error.name === 'NotAllowedError') {
        musicBlocked = true;
      } else {
        enabled = false;
        saveState();
      }
      stopKeypresses(true);
      updateButton();
    });
  }

  function restore() {
    leaving = false;
    const state = readState();
    savedTime = state.time;
    seekPending = true;
    enabled = state.enabled;
    musicBlocked = false;
    resumePending = enabled;
    restorePosition();
    if (resumePending && !seekPending) {
      resumePending = false;
      tryPlayMusic();
    }
    updateButton();
  }

  music.addEventListener('loadedmetadata', () => {
    restorePosition();
    if (resumePending && !seekPending && !leaving) {
      resumePending = false;
      tryPlayMusic();
    }
  });
  music.addEventListener('playing', () => {
    if (leaving) return;
    if (!enabled) { music.pause(); return; }
    musicBlocked = false;
    updateButton();
    saveState(false);
  });
  music.addEventListener('pause', () => {
    if (leaving || !enabled || !music.paused) return;
    musicBlocked = true;
    stopKeypresses(true);
    updateButton();
  });
  music.addEventListener('timeupdate', () => {
    if (leaving || !enabled || musicBlocked || seekPending || performance.now() - lastTimeSave < 250) return;
    lastTimeSave = performance.now();
    saveState();
  });
  button.addEventListener('click', () => {
    if (enabled && !musicBlocked) {
      ++musicPlayVersion;
      enabled = false;
      resumePending = false;
      stopKeypresses(true);
      music.pause();
      saveState();
      updateButton();
      return;
    }
    enabled = true;
    musicBlocked = false;
    typingBlocked = false;
    resumePending = false;
    restorePosition();
    saveState(false);
    tryPlayMusic();
  });

  document.addEventListener('keydown', (event) => {
    if (window.siteLayout.matches || (event.code !== 'Space' && event.key !== ' ') ||
        event.defaultPrevented || event.repeat || event.isComposing ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        event.target.closest?.('a, button, input, textarea, select, summary, [contenteditable], [role="button"], [role="textbox"]')) return;
    event.preventDefault();
    button.click();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    activeWriters.clear();
    stopKeypresses(true);
  });
  window.addEventListener('pagehide', () => {
    saveState();
    leaving = true;
    ++musicPlayVersion;
    activeWriters.clear();
    stopKeypresses(true);
    music.pause();
  });
  window.addEventListener('pageshow', restore);
  updateButton();
  document.body.append(music, ...keypresses.map(({ audio }) => audio), button);
})();

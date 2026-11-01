(() => {
  const storageKey = 'emma-background-music';
  const soundSettings = Object.freeze({
    track: 'ghosts-like-me',
    musicVolume: 0.42,
    typingStartOffset: 0.06,
    typingVolume: 0.75,
    typingFadeMs: 65,
  });
  const music = document.createElement('audio');
  music.src = new URL('audio/ghosts-like-me.mp3', document.baseURI).href;
  music.loop = true;
  music.preload = 'metadata';
  music.volume = soundSettings.musicVolume;
  music.hidden = true;

  const typing = document.createElement('audio');
  typing.src = new URL('audio/ES_Computers, Keyboard & Mouse, Keyboard, Razer, Typing, Slow - Epidemic Sound.mp3', document.baseURI).href;
  typing.loop = true;
  typing.preload = 'auto';
  typing.volume = soundSettings.typingVolume;
  typing.hidden = true;

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

  // Each typewriter owns a token. Future per-character samples can be triggered
  // here without changing the typewriter's start/stop bookkeeping.
  const activeWriters = new Set();
  let typingBlocked = false;
  let typingPending = false;
  let typingNeedsStart = true;
  let typingPlayVersion = 0;
  let typingFadeFrame = null;

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
    if (!seekPending || music.readyState < 1) return;
    const duration = music.duration;
    const time = Number.isFinite(duration) && duration > 0 ? savedTime % duration : savedTime;
    try {
      music.currentTime = time;
      seekPending = false;
    } catch (_) { /* Try again after metadata arrives. */ }
  }

  function resetTypingPosition() {
    if (typing.readyState < 1) return;
    const duration = typing.duration;
    const offset = Number.isFinite(duration) && duration > 0
      ? Math.min(soundSettings.typingStartOffset, Math.max(0, duration - 0.05))
      : soundSettings.typingStartOffset;
    try { typing.currentTime = offset; } catch (_) { /* Retry on the next burst. */ }
  }

  function cancelTypingFade() {
    if (typingFadeFrame !== null) cancelAnimationFrame(typingFadeFrame);
    typingFadeFrame = null;
    typing.volume = soundSettings.typingVolume;
  }

  function stopTyping(immediate = false) {
    ++typingPlayVersion;
    typingPending = false;
    if (typingFadeFrame !== null) cancelAnimationFrame(typingFadeFrame);
    typingFadeFrame = null;
    if (immediate || typing.paused) {
      typing.volume = 0;
      if (!typing.paused) typing.pause();
      resetTypingPosition();
      typing.volume = soundSettings.typingVolume;
      return;
    }
    const start = performance.now();
    const initialVolume = typing.volume;
    function fade(now) {
      typingFadeFrame = null;
      const amount = Math.min(1, (now - start) / soundSettings.typingFadeMs);
      typing.volume = initialVolume * (1 - amount);
      if (amount < 1) {
        typingFadeFrame = requestAnimationFrame(fade);
      } else {
        typing.pause();
        resetTypingPosition();
        typing.volume = soundSettings.typingVolume;
      }
    }
    typingFadeFrame = requestAnimationFrame(fade);
  }

  function startTypingIfCurrent() {
    if (!enabled || musicBlocked || leaving || document.hidden || window.siteMotion.stopped ||
        !activeWriters.size || typingBlocked) return;
    cancelTypingFade();
    if (!typing.paused) return;
    if (typing.readyState < 1) {
      typingPending = true;
      return;
    }
    typingPending = false;
    if (typingNeedsStart) {
      resetTypingPosition();
      typingNeedsStart = false;
    }
    const version = ++typingPlayVersion;
    const result = typing.play();
    result?.catch(() => {
      if (version !== typingPlayVersion || leaving) return;
      typingBlocked = true;
      stopTyping(true);
    });
  }

  window.siteTypingAudio = Object.freeze({
    character(writer) {
      if (!activeWriters.size) {
        typingBlocked = false;
        typingNeedsStart = true;
      }
      activeWriters.add(writer);
      startTypingIfCurrent();
    },
    stop(writer) {
      if (!activeWriters.delete(writer)) return;
      if (!activeWriters.size) stopTyping();
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
      stopTyping(true);
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
    stopTyping(true);
    updateButton();
  });
  music.addEventListener('timeupdate', () => {
    if (leaving || !enabled || musicBlocked || seekPending || performance.now() - lastTimeSave < 250) return;
    lastTimeSave = performance.now();
    saveState();
  });
  typing.addEventListener('loadedmetadata', () => {
    if (typingPending && activeWriters.size) startTypingIfCurrent();
    else resetTypingPosition();
  });

  button.addEventListener('click', () => {
    if (enabled && !musicBlocked) {
      ++musicPlayVersion;
      enabled = false;
      resumePending = false;
      stopTyping(true);
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
    startTypingIfCurrent();
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
    stopTyping(true);
  });
  window.addEventListener('pagehide', () => {
    saveState();
    leaving = true;
    ++musicPlayVersion;
    activeWriters.clear();
    stopTyping(true);
    music.pause();
  });
  window.addEventListener('pageshow', restore);
  updateButton();
  document.body.append(music, typing, button);
})();

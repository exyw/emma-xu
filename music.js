(() => {
  const storageKey = 'emma-background-music';
  const audio = document.createElement('audio');
  audio.src = new URL('audio/ES_Sad Dad Eyes (Instrumental Version) - Mattias Tell - 0000-63803.wav', document.baseURI).href;
  audio.loop = true;
  audio.preload = 'metadata';
  audio.hidden = true;

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
        time: Number.isFinite(state.time) && state.time >= 0 ? state.time : 0,
        playing: state.playing === true,
      };
    } catch (_) {
      return { time: 0, playing: false };
    }
  }

  const initialState = readState();
  let savedTime = initialState.time;
  let seekPending = false;
  let wantsPlayback = initialState.playing;
  let playBlocked = false;
  let resumePending = false;
  let leaving = false;
  let playVersion = 0;
  let lastTimeSave = 0;

  function updateButton() {
    const playing = (!audio.paused && !audio.ended) || (wantsPlayback && !playBlocked);
    icon.textContent = playing ? '[Ⅱ]' : '[▶]';
    button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} background music`);
    button.title = `${playing ? 'Pause' : 'Play'} background music`;
  }

  function saveState(captureTime = true) {
    if (captureTime && !seekPending && Number.isFinite(audio.currentTime) && audio.currentTime >= 0) {
      savedTime = audio.currentTime;
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ time: savedTime, playing: wantsPlayback }));
    } catch (_) { /* Playback still works when storage is unavailable. */ }
  }

  function restorePosition() {
    if (!seekPending || audio.readyState < 1) return;
    const duration = audio.duration;
    const time = Number.isFinite(duration) && duration > 0 ? savedTime % duration : savedTime;
    try {
      audio.currentTime = time;
      seekPending = false;
    } catch (_) { /* Keep the saved position for a later metadata event. */ }
  }

  function tryPlay() {
    const version = ++playVersion;
    playBlocked = false;
    updateButton();
    const result = audio.play();
    result?.catch((error) => {
      if (leaving || version !== playVersion) return;
      if (error.name === 'NotAllowedError') {
        playBlocked = true;
      } else {
        wantsPlayback = false;
        saveState();
      }
      updateButton();
    });
  }

  function restore() {
    leaving = false;
    const state = readState();
    savedTime = state.time;
    seekPending = true;
    wantsPlayback = state.playing;
    playBlocked = false;
    resumePending = wantsPlayback;
    restorePosition();
    if (resumePending && !seekPending) {
      resumePending = false;
      tryPlay();
    }
    updateButton();
  }

  audio.addEventListener('loadedmetadata', () => {
    restorePosition();
    if (resumePending && !seekPending && !leaving) {
      resumePending = false;
      tryPlay();
    }
  });
  audio.addEventListener('playing', () => {
    if (leaving) return;
    wantsPlayback = true;
    playBlocked = false;
    updateButton();
    saveState(false);
  });
  audio.addEventListener('pause', () => {
    if (leaving) return;
    wantsPlayback = false;
    updateButton();
    saveState();
  });
  audio.addEventListener('timeupdate', () => {
    if (leaving || !wantsPlayback || seekPending || performance.now() - lastTimeSave < 250) return;
    lastTimeSave = performance.now();
    saveState();
  });

  button.addEventListener('click', () => {
    if (wantsPlayback && !playBlocked) {
      ++playVersion;
      wantsPlayback = false;
      resumePending = false;
      audio.pause();
      saveState();
      updateButton();
      return;
    }
    wantsPlayback = true;
    playBlocked = false;
    resumePending = false;
    restorePosition();
    saveState(false);
    tryPlay();
  });

  document.addEventListener('keydown', (event) => {
    if (window.siteLayout.matches || (event.code !== 'Space' && event.key !== ' ') ||
        event.defaultPrevented || event.repeat || event.isComposing ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        event.target.closest?.('a, button, input, textarea, select, summary, [contenteditable], [role="button"], [role="textbox"]')) return;
    event.preventDefault();
    button.click();
  });

  window.addEventListener('pagehide', () => {
    saveState(false);
    leaving = true;
    ++playVersion;
    audio.pause();
  });
  window.addEventListener('pageshow', restore);
  updateButton();
  document.body.append(audio, button);
})();

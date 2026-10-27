(() => {
  const page = document.querySelector('.contact-page');
  const sequence = document.querySelector('.contact-sequence');
  const stage = document.querySelector('.contact-stage');
  const portrait = document.querySelector('.contact-portrait');
  const canvas = document.querySelector('.contact-morph');
  const content = document.querySelector('.contact-content');
  const intro = content.querySelector('.contact-intro');
  const links = document.querySelector('.contact-links');
  const nav = document.querySelector('.site-nav');
  const cue = stage.querySelector('.scroll-cue');
  const contactLinks = [...links.querySelectorAll('a')];
  const compact = window.siteLayout;
  const motion = window.siteMotion;
  const context = canvas.getContext('2d');
  if (!context) return;

  page.classList.add('has-contact-motion');
  links.inert = true;
  contactLinks.forEach(window.attachTypewriter);

  let sourceBuffer = null;
  let targetBuffer = null;
  let fragments = [];
  let scrollFrame = null;
  let resizeFrame = null;
  let ready = false;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const ease = (value) => value * value * (3 - 2 * value);
  const random = (seed) => {
    const value = Math.sin(seed * 127.1 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  function canvasOf(width, height) {
    const result = document.createElement('canvas');
    result.width = Math.max(1, Math.ceil(width));
    result.height = Math.max(1, Math.ceil(height));
    return result;
  }

  function sample(buffer, step) {
    const { width, height } = buffer;
    const pixels = buffer.getContext('2d').getImageData(0, 0, width, height).data;
    const points = [];
    for (let y = 1; y < height - 1; y += step) {
      for (let x = 1; x < width - 1; x += step) {
        if (pixels[(y * width + x) * 4 + 3] >= 72) points.push([x, y]);
      }
    }
    return points;
  }

  function drawTextMask(target, stageRect) {
    // Sample the rendered letters, including the links, so responsive wrapping
    // and the final DOM copy share the same destination geometry.
    const drawing = target.getContext('2d');
    drawing.fillStyle = '#fff';
    drawing.textBaseline = 'middle';
    const range = document.createRange();
    for (const root of [document.querySelector('.contact-intro'), links]) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const style = getComputedStyle(node.parentElement);
        drawing.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        for (let index = 0; index < node.textContent.length; index += 1) {
          const character = node.textContent[index];
          if (/\s/.test(character)) continue;
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const rect = range.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          drawing.fillText(character, rect.left - stageRect.left,
            rect.top - stageRect.top + rect.height / 2);
        }
      }
    }
    range.detach?.();
  }

  function progress() {
    const start = sequence.getBoundingClientRect().top + window.scrollY;
    const travelled = window.scrollY - start;
    if (compact.matches) {
      // Reveal the copy before it reaches the pinned navigation on short screens.
      const scrollRange = Math.max(1, sequence.getBoundingClientRect().height - window.innerHeight);
      const introTop = intro.getBoundingClientRect().top - sequence.getBoundingClientRect().top;
      const navBottom = document.querySelector('.site-nav').getBoundingClientRect().bottom;
      const revealRange = Math.max(1, introTop - navBottom - 12);
      return clamp(travelled / Math.min(scrollRange, revealRange));
    }
    return clamp(travelled / Math.max(1, sequence.offsetHeight - window.innerHeight));
  }

  function setLinksInteractive(interactive) {
    if (links.inert === !interactive) return;
    if (!interactive) {
      if (links.contains(document.activeElement)) document.activeElement.blur();
      contactLinks.forEach((link) => link.typewriter?.reset());
    }
    links.inert = !interactive;
    page.classList.toggle('is-settled', interactive);
  }

  function draw(amount) {
    if (!ready) return;
    cue.style.opacity = String(1 - ease(clamp(amount / 0.18)));
    if (motion.stopped) {
      const settled = amount >= 0.5;
      portrait.style.opacity = settled ? '0' : '1';
      content.style.opacity = settled ? '1' : '0';
      canvas.style.opacity = '0';
      setLinksInteractive(settled);
      return;
    }

    const eased = ease(amount);
    const portraitOpacity = 1 - ease(clamp((amount - 0.02) / 0.18));
    const contentOpacity = ease(clamp((amount - 0.82) / 0.18));
    const particleOpacity = ease(clamp((amount - 0.04) / 0.14)) *
      (1 - ease(clamp((amount - 0.88) / 0.12)));
    portrait.style.opacity = portraitOpacity.toFixed(3);
    content.style.opacity = contentOpacity.toFixed(3);
    canvas.style.opacity = particleOpacity.toFixed(3);
    setLinksInteractive(amount >= 0.96);
    if (particleOpacity <= 0.001) return;

    const width = sourceBuffer.width;
    const height = sourceBuffer.height;
    context.clearRect(0, 0, width, height);
    const scatter = Math.sin(Math.PI * amount);
    const patch = compact.matches ? 4 : 5;
    const useTargetTexture = amount > 0.58;
    for (const fragment of fragments) {
      const { from, to, scatterX, scatterY } = fragment;
      const x = from[0] + (to[0] - from[0]) * eased +
        scatterX * scatter;
      const y = from[1] + (to[1] - from[1]) * eased +
        scatterY * scatter;
      const texture = useTargetTexture ? targetBuffer : sourceBuffer;
      const samplePoint = useTargetTexture ? to : from;
      context.drawImage(texture, samplePoint[0] - patch / 2, samplePoint[1] - patch / 2,
        patch, patch, x - patch / 2, y - patch / 2, patch, patch);
    }
  }

  function update() {
    scrollFrame = null;
    draw(progress());
  }

  function requestUpdate() {
    if (scrollFrame === null) scrollFrame = requestAnimationFrame(update);
  }

  function fallback() {
    ready = false;
    page.classList.remove('has-contact-motion');
    page.classList.add('is-settled');
    links.inert = false;
    stage.style.removeProperty('height');
    stage.style.removeProperty('--contact-mobile-nav-bottom');
    stage.style.removeProperty('--contact-mobile-viewport-height');
    content.style.removeProperty('top');
    portrait.style.opacity = '';
    content.style.opacity = '';
    canvas.style.opacity = '0';
  }

  function rebuild() {
    resizeFrame = null;
    if (!portrait.complete || !portrait.naturalWidth) return;
    try {
      contactLinks.forEach((link) => link.typewriter?.reset());
      if (compact.matches) {
        const viewportHeight = window.innerHeight;
        const navBottom = nav.getBoundingClientRect().bottom;
        const contentHeight = content.getBoundingClientRect().height;
        const centeredTop = navBottom + (viewportHeight - navBottom - contentHeight) / 2;
        const settledTop = Math.max(navBottom + 12, centeredTop);
        const revealDistance = 160;
        const contentTop = revealDistance + settledTop;
        const stageHeight = Math.max(viewportHeight + revealDistance,
          contentTop + contentHeight + 8);
        stage.style.height = `${stageHeight}px`;
        stage.style.setProperty('--contact-mobile-nav-bottom', `${navBottom}px`);
        stage.style.setProperty('--contact-mobile-viewport-height', `${viewportHeight}px`);
        content.style.top = `${contentTop}px`;
      } else {
        stage.style.removeProperty('height');
        stage.style.removeProperty('--contact-mobile-nav-bottom');
        stage.style.removeProperty('--contact-mobile-viewport-height');
        content.style.removeProperty('top');
      }
      const stageRect = stage.getBoundingClientRect();
      const portraitRect = portrait.getBoundingClientRect();
      if (compact.matches) cue.style.top = `${Math.ceil(portraitRect.bottom - stageRect.top + 24)}px`;
      else cue.style.removeProperty('top');
      const width = Math.ceil(stageRect.width);
      const height = Math.ceil(stageRect.height);
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      sourceBuffer = canvasOf(width, height);
      // Tint the portrait once; scroll frames only move small pieces of it.
      const sourceContext = sourceBuffer.getContext('2d');
      sourceContext.drawImage(portrait, portraitRect.left - stageRect.left,
        portraitRect.top - stageRect.top, portraitRect.width, portraitRect.height);
      sourceContext.globalCompositeOperation = 'source-in';
      sourceContext.fillStyle = '#f7eee0';
      sourceContext.fillRect(0, 0, width, height);
      sourceContext.globalCompositeOperation = 'source-over';

      targetBuffer = canvasOf(width, height);
      drawTextMask(targetBuffer, stageRect);
      const sourcePoints = sample(sourceBuffer, compact.matches ? 3 : 4);
      const targetPoints = sample(targetBuffer, compact.matches ? 2 : 3);
      const count = Math.min(compact.matches ? 1900 : 3200, sourcePoints.length, targetPoints.length);
      if (count < 120) throw new Error('Contact morph has too few visible points');
      fragments = Array.from({ length: count }, (_, index) => ({
        from: sourcePoints[Math.floor(index * sourcePoints.length / count)],
        to: targetPoints[Math.floor(index * targetPoints.length / count)],
        scatterX: (random(index + 11) - 0.5) * 140,
        scatterY: (random(index + 2791) - 0.5) * 90,
      }));
      ready = true;
      requestUpdate();
    } catch (error) {
      console.warn('Contact morph could not be prepared:', error);
      fallback();
    }
  }

  function requestRebuild() {
    if (resizeFrame === null) resizeFrame = requestAnimationFrame(rebuild);
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestRebuild);
  compact.addEventListener('change', () => {
    contactLinks.forEach((link) => {
      link.typewriter?.destroy();
      window.attachTypewriter(link);
    });
    requestRebuild();
  });
  motion.subscribe(requestUpdate);
  window.addEventListener('pageshow', requestRebuild);
  window.addEventListener('pagehide', () => {
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    scrollFrame = resizeFrame = null;
  });
  document.fonts?.ready.then(requestRebuild);

  portrait.addEventListener('load', requestRebuild);
  portrait.addEventListener('error', fallback);
  if (portrait.complete && portrait.naturalWidth) requestRebuild();
})();

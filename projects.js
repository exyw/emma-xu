(() => {
  const stage = document.querySelector("[data-project-stage]");
  if (!stage) return;

  const experience = document.querySelector(".projects-experience");
  const heading = document.querySelector(".projects-heading");
  const headingInfo = heading.querySelector("div");
  const title = document.querySelector(".projects-title");
  const meta = document.querySelector(".projects-meta");
  const metaText = document.querySelector(".projects-meta__text");
  const copy = document.querySelector(".projects-copy");
  const back = document.querySelector(".projects-back");
  const nav = document.querySelector(".site-nav--portrait");
  const projectsLink = nav.querySelector('.page-menu a[aria-current="page"]');
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileNav = window.matchMedia("(max-width: 640px)");
  const compactMotion = window.matchMedia("(max-width: 640px), (max-height: 740px)");
  const svgNS = "http://www.w3.org/2000/svg";
  const { crop, projects } = window.projectConfig;
  const assets = "assets/projects/";
  // Match the visible portrait width after the cropped-height correction.
  const sourceWidthScale = 0.886;
  const navCopyGap = 24;
  const navEaseDistance = 96;
  const motion = {
    swayCycle: 6, desktopAmplitude: 12, compactAmplitude: 8,
    nearDelay: 0.65, farDelay: 1.15, nearOpacity: 0.43, farOpacity: 0.34,
    burstInterval: 5.8, burstStart: 4.35, burstDuration: 0.7,
    burstAttackFraction: 0.2, desktopSplit: 24, compactSplit: 12,
    nearSplitFraction: 0.6, initialTime: 3.1,
    charcoal: [36, 34, 31], grey: [83, 77, 70],
    ivory: [248, 240, 227], lightGrey: [167, 159, 147],
    amber: [188, 121, 40], coral: [186, 77, 62],
  };

  // The labels are verified artwork names. Only CHIP has supplied public copy.
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const points = window.projectMorphPoints;
  const svg = (tag, attributes = {}) => {
    const element = document.createElementNS(svgNS, tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    return element;
  };
  const url = (path) => new URL(path, document.baseURI).href;
  const asciiUrl = (name) => url(`${assets}ascii/${name}`);
  const imageUrl = (name) => url(`${assets}images/${name}`);
  const rgb = (value) => `rgb(${value.join(" ")})`;
  const mix = (a, b, fraction) => a.map((channel, index) => Math.round(channel + (b[index] - channel) * fraction));
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const ease = (value) => value * value * (3 - 2 * value);
  const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

  function makeSourceArt() {
    const art = svg("svg", {
      class: "projects-figure__art", viewBox: `${crop.x} ${crop.y} ${crop.width} ${crop.height}`,
      preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false",
    });
    const defs = svg("defs");
    const silhouetteId = "projects-silhouette-mask";
    const colourId = "projects-colour-field";
    const mask = svg("mask", {
      id: silhouetteId, x: crop.x - 50, y: crop.y - 20,
      width: crop.width + 100, height: crop.height + 40,
      maskUnits: "userSpaceOnUse", maskContentUnits: "userSpaceOnUse",
      style: "mask-type: alpha",
    });
    mask.append(svg("image", {
      href: asciiUrl("Silhouette ASCII.svg"), x: 0, y: 0,
      width: 1200, height: 912, preserveAspectRatio: "none",
    }));
    const colour = svg("linearGradient", {
      id: colourId, x1: 0, y1: 0, x2: 125, y2: 180,
      gradientUnits: "userSpaceOnUse", spreadMethod: "repeat",
    });
    [
      ["0%", "#BC7928", "0.08"], ["16%", "#BC7928", "0.95"],
      ["38%", "#BA4D3E", "0.85"], ["55%", "#BA4D3E", "0.05"],
      ["76%", "#BC7928", "0.85"], ["100%", "#BC7928", "0.08"],
    ].forEach(([offset, colourValue, opacity]) => colour.append(svg("stop", {
      offset, "stop-color": colourValue, "stop-opacity": opacity,
    })));
    defs.append(mask, colour);
    art.append(defs);
    const echoes = svg("g");
    const far = svg("g", { mask: `url(#${silhouetteId})`, opacity: motion.farOpacity });
    const farFill = svg("rect", { x: crop.x, y: crop.y, width: crop.width, height: crop.height, fill: rgb(motion.grey) });
    far.append(farFill);
    const near = svg("g", { mask: `url(#${silhouetteId})`, opacity: motion.nearOpacity });
    const nearFill = svg("rect", { x: crop.x, y: crop.y, width: crop.width, height: crop.height, fill: rgb(motion.grey) });
    near.append(nearFill);
    echoes.append(far, near);
    const main = svg("g", { mask: `url(#${silhouetteId})` });
    main.append(svg("rect", { x: crop.x, y: crop.y, width: crop.width, height: crop.height, fill: rgb(motion.charcoal) }));
    const warmFill = svg("rect", {
      x: crop.x, y: crop.y, width: crop.width, height: crop.height,
      fill: `url(#${colourId})`, opacity: 0,
    });
    main.append(warmFill);
    art.append(echoes, main);
    return { art, echoes, near, far, nearFill, farFill, warmFill, colour };
  }

  function makeTargetArt(project) {
    const { width, height } = project.art;
    const wrapper = document.createElement("div");
    wrapper.className = "projects-target";
    wrapper.setAttribute("aria-hidden", "true");
    const art = svg("svg", {
      class: "projects-target__art", viewBox: `0 0 ${width} ${height}`,
      "aria-hidden": "true", focusable: "false",
    });
    const maskId = `projects-target-${project.id}`;
    const mask = svg("mask", {
      id: maskId, x: -100, y: -30, width: width + 200, height: height + 60,
      maskUnits: "userSpaceOnUse", maskContentUnits: "userSpaceOnUse",
      style: "mask-type: alpha",
    });
    mask.append(svg("image", {
      href: asciiUrl(project.large), x: 0, y: 0,
      width, height, preserveAspectRatio: "none",
    }));
    const defs = svg("defs");
    defs.append(mask);
    art.append(defs);
    const makeLayer = (fill, opacity) => {
      const group = svg("g", { mask: `url(#${maskId})`, opacity });
      group.append(svg("rect", { x: 0, y: 0, width, height, fill }));
      art.append(group);
      return group;
    };
    const far = makeLayer(rgb(motion.lightGrey), motion.farOpacity);
    const near = makeLayer(rgb(motion.lightGrey), motion.nearOpacity);
    makeLayer(rgb(motion.ivory), 1);
    wrapper.append(art);
    return { wrapper, near, far };
  }

  const layer = document.createElement("div");
  layer.className = "projects-stage__motion";
  const source = document.createElement("div");
  source.className = "projects-figure";
  source.setAttribute("role", "group");
  source.setAttribute("aria-label", "Five projects in an ASCII portrait");
  const sourceArt = makeSourceArt();
  source.append(sourceArt.art);
  const targetHost = document.createElement("div");
  targetHost.hidden = true;
  const morphCanvas = document.createElement("canvas");
  morphCanvas.className = "projects-morph";
  morphCanvas.setAttribute("aria-hidden", "true");
  morphCanvas.hidden = true;
  layer.append(source, targetHost, morphCanvas);
  stage.append(layer);
  const buttons = new Map();
  let targetArt = null;
  let active = null;
  let state = "overview";
  let progress = 0;
  let hoveredId = null;
  let focusedId = null;
  let time = motion.initialTime;
  let lastTimestamp = null;
  let frameId = null;
  let pageActive = true;
  let isIntersecting = true;
  let requestVersion = 0;
  let geometry = null;
  let buffers = null;
  let navRelease = 0;
  let navFrameId = null;
  let overviewScrollY = 0;
  let hasOverviewScroll = false;
  let pendingHeadingFocus = null;
  let renderedProjectId = null;
  const imageCache = new Map();
  const transitionDuration = 1.2;
  const originalScrollRestoration = history.scrollRestoration;
  const themeControls = [...nav.querySelectorAll("a"), back];
  const lightBackground = [
    [0, [237, 228, 211]], [0.5, [210, 197, 176]], [1, [182, 165, 141]],
  ];
  const darkBackground = [
    [0, [36, 34, 31]], [0.6, [34, 32, 29]], [1, [28, 27, 25]],
  ];

  function gradientColour(x, y, width, height, stops) {
    // CSS's default farthest-corner ellipse reaches each corner at radius 1.
    const radius = Math.min(1, Math.hypot(
      (x - width / 2) * Math.SQRT2 / width,
      (y - height / 2) * Math.SQRT2 / height,
    ));
    for (let index = 1; index < stops.length; index += 1) {
      const [end, endColour] = stops[index];
      if (radius > end) continue;
      const [start, startColour] = stops[index - 1];
      return mix(startColour, endColour, (radius - start) / (end - start));
    }
    return stops[stops.length - 1][1];
  }

  function luminance(colour) {
    const [red, green, blue] = colour.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  }

  function updateControlInk(fade) {
    if (state === "overview" || state === "detail") {
      themeControls.forEach((control) => control.style.removeProperty("--project-transition-ink"));
      return;
    }
    if (fade === 0 || fade === 1) {
      const ink = fade === 0 ? "#000" : "#fff";
      themeControls.forEach((control) => control.style.setProperty("--project-transition-ink", ink));
      return;
    }
    const bodyRect = document.body.getBoundingClientRect();
    for (const control of themeControls) {
      const rect = control.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const light = gradientColour(x - bodyRect.left, y - bodyRect.top,
        bodyRect.width, bodyRect.height, lightBackground);
      const dark = gradientColour(x, y, window.innerWidth, window.innerHeight, darkBackground);
      // Black and white both exceed 4.5:1 near this luminance, so the flip
      // remains readable as the gradient moves beneath each control.
      const ink = luminance(mix(light, dark, fade)) >= 0.179 ? "#000" : "#fff";
      if (control.style.getPropertyValue("--project-transition-ink") !== ink) {
        control.style.setProperty("--project-transition-ink", ink);
      }
    }
  }

  function updateTheme() {
    // Finish darkening before the title appears, while sharing the morph's progress.
    const fade = ease(clamp(progress / 0.6, 0, 1));
    document.body.style.setProperty("--detail-fade", String(fade));
    document.body.classList.toggle("is-inverted", progress > 0.15);
    updateControlInk(fade);
  }

  function revealDetailContent() {
    const titleVisible = state === "detail" ||
      ((state === "opening" || state === "closing") && progress >= 0.55);
    const copyVisible = state === "detail" ||
      ((state === "opening" || state === "closing") && progress >= 0.65);
    heading.classList.toggle("is-title-visible", titleVisible);
    headingInfo.setAttribute("aria-hidden", String(!titleVisible));
    copy.classList.toggle("is-content-visible", copyVisible);
    copy.inert = !copyVisible;
    copy.setAttribute("aria-hidden", String(!copyVisible));
    if (titleVisible && pendingHeadingFocus &&
        pendingHeadingFocus.version === requestVersion &&
        pendingHeadingFocus.projectId === active?.id &&
        (state === "opening" || state === "detail")) {
      pendingHeadingFocus = null;
      title.focus({ preventScroll: true });
    }
  }

  function updateTransitionView() {
    experience.classList.toggle("is-transitioning", state === "opening" || state === "closing");
    revealDetailContent();
    updateNavRelease();
    updateTheme();
  }

  function resetNavRelease() {
    navRelease = 0;
    nav.style.removeProperty("--portrait-nav-release");
  }

  function updateNavRelease() {
    if (!experience.classList.contains("is-detail") || copy.hidden ||
        !copy.classList.contains("is-content-visible") || mobileNav.matches) {
      resetNavRelease();
      return;
    }
    const copyTop = copy.getBoundingClientRect().top + window.scrollY;
    // Include the full menu box so its links stay clear when they expand.
    const navBottomAtRest = nav.getBoundingClientRect().bottom + navRelease;
    const overrun = window.scrollY + navBottomAtRest + navCopyGap - copyTop;
    let nextRelease = Math.max(0, overrun);
    if (!reducedMotion.matches && Math.abs(overrun) < navEaseDistance / 2) {
      // Ease from stationary to scroll speed without shrinking the final gap.
      const ramp = overrun + navEaseDistance / 2;
      nextRelease = ramp * ramp / (2 * navEaseDistance);
    }
    if (Math.abs(nextRelease - navRelease) < 0.5) return;
    navRelease = nextRelease;
    nav.style.setProperty("--portrait-nav-release", `${navRelease}px`);
  }

  function queueNavRelease() {
    if (navFrameId !== null) return;
    navFrameId = window.requestAnimationFrame(() => {
      navFrameId = null;
      updateNavRelease();
    });
  }

  projects.forEach((project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-choice";
    button.dataset.project = project.id;
    button.setAttribute("aria-label", `Open ${project.title} project`);
    const slot = project.slot;
    button.style.left = `${((slot.x - crop.x) / crop.width) * 100}%`;
    button.style.top = `${((slot.y - crop.y) / crop.height) * 100}%`;
    button.style.width = `${(slot.width / crop.width) * 100}%`;
    button.style.height = `${(slot.height / crop.height) * 100}%`;
    const original = document.createElement("img");
    original.className = "project-choice__original";
    original.src = imageUrl(project.original);
    original.alt = "";
    original.setAttribute("aria-hidden", "true");
    original.draggable = false;
    if (project.preview) Object.assign(original.style, project.preview);
    const ascii = document.createElement("img");
    ascii.className = "project-choice__ascii";
    ascii.src = asciiUrl(project.small);
    ascii.alt = "";
    ascii.setAttribute("aria-hidden", "true");
    ascii.draggable = false;
    button.append(original, ascii);
    button.addEventListener("focus", () => {
      focusedId = button.matches(":focus-visible") ? project.id : null;
      showPreview();
    });
    button.addEventListener("blur", () => {
      if (focusedId === project.id) focusedId = null;
      showPreview();
    });
    button.addEventListener("click", () => {
      if (state !== "overview") return;
      history.pushState({ projectsPage: true }, "", `#${project.id}`);
      openProject(project, true);
    });
    source.append(button);
    buttons.set(project.id, button);
  });

  function showPreview() {
    const preview = state === "overview" ? (focusedId || hoveredId) : null;
    buttons.forEach((button, id) => button.classList.toggle("is-preview", id === preview));
  }

  // A stationary pointer does not generate pointermove, so sway cannot dismiss a reveal.
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || state !== "overview") return;
    let next = null;
    for (const [id, button] of buttons) {
      const bounds = button.getBoundingClientRect();
      if (event.clientX >= bounds.left && event.clientX <= bounds.right &&
          event.clientY >= bounds.top && event.clientY <= bounds.bottom) next = id;
    }
    if (next === hoveredId) return;
    hoveredId = next;
    showPreview();
  });
  document.addEventListener("pointerdown", (event) => {
    if (source.contains(event.target)) return;
    hoveredId = null;
    focusedId = null;
    showPreview();
  });

  function rects() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const figureWidth = height * crop.width / crop.height * sourceWidthScale;
    const sourceRect = { x: (width - figureWidth) / 2, y: 0, width: figureWidth, height };
    let targetRect = null;
    if (active) {
      const art = active.art;
      const scale = Math.min(
        Math.min(art.maxWidth, width - 28) / art.width,
        Math.min(art.maxHeight, height * 0.54) / art.height,
      );
      const targetWidth = art.width * scale;
      const targetHeight = art.height * scale;
      const artGap = mobileNav.matches ? 24 : 28;
      const headingTop = parseFloat(getComputedStyle(experience).paddingTop) || 0;
      const targetY = Math.max(0, headingTop + heading.offsetHeight + artGap - stage.offsetTop);
      targetRect = {
        x: (width - targetWidth) / 2, y: targetY,
        width: targetWidth, height: targetHeight,
      };
    }
    return { width, height, sourceRect, targetRect };
  }

  function updateGeometry() {
    geometry = rects();
    const { sourceRect, targetRect } = geometry;
    Object.assign(source.style, {
      left: `${sourceRect.x}px`, top: `${sourceRect.y}px`,
      width: `${sourceRect.width}px`, height: `${sourceRect.height}px`,
    });
    if (targetArt && targetRect) Object.assign(targetArt.wrapper.style, {
      left: `${targetRect.x}px`, top: `${targetRect.y}px`,
      width: `${targetRect.width}px`, height: `${targetRect.height}px`,
    });
    morphCanvas.width = Math.max(1, Math.round(geometry.width));
    morphCanvas.height = Math.max(1, Math.round(geometry.height));
    buffers = null;
  }

  function positionDetailContent() {
    if (!experience.classList.contains("is-detail") || !geometry.targetRect) return;
    const { y, height } = geometry.targetRect;
    const artGap = mobileNav.matches ? 24 : 28;
    experience.style.setProperty("--project-heading-top",
      `${stage.offsetTop + y - heading.offsetHeight - artGap}px`);
    experience.style.setProperty("--project-copy-offset",
      `${y + height + artGap - stage.clientHeight}px`);
    experience.style.setProperty("--project-divider-offset", `${-artGap / 2}px`);
  }

  function showTarget(project) {
    targetHost.replaceChildren();
    targetArt = makeTargetArt(project);
    targetHost.append(targetArt.wrapper);
    updateGeometry();
  }

  function renderCopy(project) {
    renderedProjectId = project.id;
    title.textContent = project.title;
    metaText.textContent = (project.meta || "").replace(/ · /g, "\u00a0·\u00a0");
    meta.hidden = !project.meta;
    copy.replaceChildren();
    for (const paragraph of project.paragraphs || []) {
      const element = document.createElement("p");
      if (typeof paragraph === "string") {
        element.textContent = paragraph;
      } else {
        for (const part of paragraph) {
          if (typeof part === "string") {
            element.append(document.createTextNode(part));
          } else {
            const link = document.createElement("a");
            link.href = part.href;
            link.textContent = part.text;
            element.append(link);
          }
        }
      }
      copy.append(element);
    }
    copy.hidden = !copy.childElementCount;
    copy.querySelectorAll("a").forEach(window.attachTypewriter);
  }

  function settleDetail(focus = false) {
    if (!active) return;
    history.scrollRestoration = "manual";
    state = "detail";
    progress = 1;
    source.hidden = true;
    source.inert = true;
    source.style.pointerEvents = "none";
    targetHost.hidden = false;
    targetHost.style.opacity = "1";
    morphCanvas.hidden = true;
    heading.hidden = false;
    if (renderedProjectId !== active.id) renderCopy(active);
    stage.setAttribute("aria-label", `${active.title} ASCII artwork`);
    stage.removeAttribute("aria-busy");
    experience.classList.add("is-detail");
    positionDetailContent();
    if (!focus) pendingHeadingFocus = null;
    updateTransitionView();
    drawMotion();
  }

  function settleOverview(focusId = null) {
    pendingHeadingFocus = null;
    state = "overview";
    progress = 0;
    source.hidden = false;
    source.inert = false;
    source.style.opacity = "1";
    source.style.pointerEvents = "";
    targetHost.hidden = true;
    morphCanvas.hidden = true;
    heading.hidden = true;
    copy.hidden = true;
    stage.setAttribute("aria-label", "Select a project from the ASCII portrait");
    stage.removeAttribute("aria-busy");
    experience.classList.remove("is-detail");
    experience.style.removeProperty("--project-heading-top");
    experience.style.removeProperty("--project-copy-offset");
    experience.style.removeProperty("--project-divider-offset");
    resetNavRelease();
    active = null;
    hoveredId = null;
    focusedId = null;
    showPreview();
    updateTransitionView();
    if (focusId) buttons.get(focusId)?.focus({ preventScroll: true });
    if (focusId) window.scrollTo(0, hasOverviewScroll ? overviewScrollY : 0);
    history.scrollRestoration = originalScrollRestoration;
    drawMotion();
  }

  function loadImage(path) {
    if (imageCache.has(path)) return imageCache.get(path);
    const image = new Image();
    image.src = path;
    const pending = image.decode().then(() => image);
    imageCache.set(path, pending);
    return pending;
  }

  function canvasOf(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  function tint(canvas, colour) {
    const tinted = canvasOf(canvas.width, canvas.height);
    const context = tinted.getContext("2d");
    context.drawImage(canvas, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = colour;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return tinted;
  }

  async function prepareBuffers(project) {
    const expectedWidth = Math.round(stage.clientWidth);
    const expectedHeight = Math.round(stage.clientHeight);
    if (buffers?.projectId === project.id && buffers.width === expectedWidth && buffers.height === expectedHeight) return buffers;
    const [silhouette, ...art] = await Promise.all([
      loadImage(asciiUrl("Silhouette ASCII.svg")),
      ...projects.map((item) => loadImage(asciiUrl(item.small))),
      loadImage(asciiUrl(project.large)),
    ]);
    if (active?.id !== project.id) return null;
    if (!geometry || geometry.width !== stage.clientWidth || geometry.height !== stage.clientHeight) updateGeometry();
    const { width, height, sourceRect, targetRect } = geometry;
    const sourceCanvas = canvasOf(width, height);
    const sourceContext = sourceCanvas.getContext("2d");
    sourceContext.drawImage(
      silhouette, crop.x, crop.y, crop.width, crop.height,
      sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height,
    );
    projects.forEach((item, index) => {
      const slot = item.slot;
      const x = sourceRect.x + (slot.x - crop.x) / crop.width * sourceRect.width;
      const y = sourceRect.y + (slot.y - crop.y) / crop.height * sourceRect.height;
      const width = slot.width / crop.width * sourceRect.width;
      const height = slot.height / crop.height * sourceRect.height;
      sourceContext.drawImage(art[index], x, y, width, height);
    });
    const targetCanvas = canvasOf(width, height);
    targetCanvas.getContext("2d").drawImage(
      art[art.length - 1], targetRect.x, targetRect.y, targetRect.width, targetRect.height,
    );
    buffers = {
      projectId: project.id, width: Math.round(width), height: Math.round(height),
      source: {
        charcoal: tint(sourceCanvas, rgb(motion.charcoal)),
        grey: tint(sourceCanvas, rgb(motion.grey)),
        ivory: tint(sourceCanvas, rgb(motion.ivory)),
        lightGrey: tint(sourceCanvas, rgb(motion.lightGrey)),
        amber: tint(sourceCanvas, rgb(motion.amber)),
        coral: tint(sourceCanvas, rgb(motion.coral)),
      },
      target: {
        charcoal: tint(targetCanvas, rgb(motion.charcoal)),
        grey: tint(targetCanvas, rgb(motion.grey)),
        ivory: tint(targetCanvas, rgb(motion.ivory)),
        lightGrey: tint(targetCanvas, rgb(motion.lightGrey)),
        amber: tint(targetCanvas, rgb(motion.amber)),
        coral: tint(targetCanvas, rgb(motion.coral)),
      },
    };
    return buffers;
  }

  function drawMorph(nearDelta, farDelta) {
    if (!active || !buffers || !points) return;
    const context = morphCanvas.getContext("2d");
    const { width, height, sourceRect, targetRect } = geometry;
    context.clearRect(0, 0, width, height);
    const amount = ease(progress);
    const start = points.source;
    const end = points[active.id];
    const count = Math.max(start.length, end.length);
    const fromArt = amount < 0.5;
    const selected = fromArt ? buffers.source : buffers.target;
    const lightAmount = ease(clamp(progress / 0.6, 0, 1));
    const warm = Math.pow(Math.max(0, 1 - Math.abs(progress - 0.18) / 0.34), 1.5);
    const size = 6;
    const passes = [
      { offset: farDelta, colour: warm > 0.28 ? "coral" : "grey", opacity: motion.farOpacity },
      { offset: nearDelta, colour: warm > 0.28 ? "amber" : "grey", opacity: motion.nearOpacity },
      { offset: 0, colour: "charcoal", opacity: 1 },
    ];
    for (const pass of passes) {
      const texture = selected[pass.colour];
      const lightTexture = selected[pass.opacity === 1 ? "ivory" : "lightGrey"];
      context.globalAlpha = pass.opacity;
      for (let index = 0; index < count; index += 1) {
        const a = start[Math.floor(index * start.length / count)];
        const b = end[Math.floor(index * end.length / count)];
        const sx = sourceRect.x + a[0] / 10000 * sourceRect.width;
        const sy = sourceRect.y + a[1] / 10000 * sourceRect.height;
        const tx = targetRect.x + b[0] / 10000 * targetRect.width;
        const ty = targetRect.y + b[1] / 10000 * targetRect.height;
        const x = sx + (tx - sx) * amount + pass.offset;
        const y = sy + (ty - sy) * amount;
        const sampleX = fromArt ? sx : tx;
        const sampleY = fromArt ? sy : ty;
        context.drawImage(texture, sampleX - size / 2, sampleY - size / 2,
          size, size, x - size / 2, y - size / 2, size, size);
        if (lightAmount > 0) {
          context.globalAlpha = pass.opacity * lightAmount;
          context.drawImage(lightTexture, sampleX - size / 2, sampleY - size / 2,
            size, size, x - size / 2, y - size / 2, size, size);
          context.globalAlpha = pass.opacity;
        }
      }
    }
    if (warm > 0.02) {
      context.globalAlpha = warm * 0.68;
      const texture = selected.amber;
      for (let index = 0; index < count; index += 1) {
        const a = start[Math.floor(index * start.length / count)];
        const b = end[Math.floor(index * end.length / count)];
        const sx = sourceRect.x + a[0] / 10000 * sourceRect.width;
        const sy = sourceRect.y + a[1] / 10000 * sourceRect.height;
        const tx = targetRect.x + b[0] / 10000 * targetRect.width;
        const ty = targetRect.y + b[1] / 10000 * targetRect.height;
        const x = sx + (tx - sx) * amount;
        const y = sy + (ty - sy) * amount;
        context.drawImage(texture, (fromArt ? sx : tx) - size / 2,
          (fromArt ? sy : ty) - size / 2, size, size,
          x - size / 2, y - size / 2, size, size);
      }
    }
    context.globalAlpha = 1;
    source.hidden = false;
    targetHost.hidden = false;
    source.style.opacity = String(clamp((0.18 - progress) / 0.18, 0, 1));
    targetHost.style.opacity = String(clamp((progress - 0.82) / 0.18, 0, 1));
  }

  function burstIntensity() {
    if (state !== "overview") return 0;
    const cycle = mod(time, motion.burstInterval);
    const u = (cycle - motion.burstStart) / motion.burstDuration;
    if (u < 0 || u > 1) return 0;
    return u < motion.burstAttackFraction
      ? u / motion.burstAttackFraction
      : Math.pow((1 - u) / (1 - motion.burstAttackFraction), 2);
  }

  function drawStatic() {
    layer.style.transform = "none";
    sourceArt.echoes.style.display = "none";
    sourceArt.warmFill.setAttribute("opacity", 0);
    if (targetArt) {
      targetArt.near.style.display = "none";
      targetArt.far.style.display = "none";
    }
  }

  function drawMotion() {
    if (reducedMotion.matches) { drawStatic(); return; }
    if (!geometry) updateGeometry();
    const amplitude = compactMotion.matches ? motion.compactAmplitude : motion.desktopAmplitude;
    const split = compactMotion.matches ? motion.compactSplit : motion.desktopSplit;
    const angle = 2 * Math.PI / motion.swayCycle;
    const sway = (at) => amplitude * Math.sin(angle * at);
    const mainX = sway(time);
    const burst = burstIntensity();
    const direction = Math.cos(angle * time) >= 0 ? 1 : -1;
    const nearX = sway(time - motion.nearDelay) - direction * motion.nearSplitFraction * split * burst;
    const farX = sway(time - motion.farDelay) - direction * split * burst;
    const nearDelta = nearX - mainX;
    const farDelta = farX - mainX;
    layer.style.transform = `translate3d(${mainX.toFixed(3)}px, 0, 0)`;
    sourceArt.echoes.style.display = "";
    const sourceUnitsPerPixel = crop.width / geometry.sourceRect.width;
    sourceArt.near.setAttribute("transform", `translate(${(nearDelta * sourceUnitsPerPixel).toFixed(3)} 0)`);
    sourceArt.far.setAttribute("transform", `translate(${(farDelta * sourceUnitsPerPixel).toFixed(3)} 0)`);
    sourceArt.nearFill.setAttribute("fill", rgb(mix(motion.grey, motion.amber, burst)));
    sourceArt.farFill.setAttribute("fill", rgb(mix(motion.grey, motion.coral, burst)));
    sourceArt.warmFill.setAttribute("opacity", (burst * 0.78).toFixed(3));
    sourceArt.colour.setAttribute("gradientTransform", `translate(${(time * 31).toFixed(2)} ${(time * -64).toFixed(2)})`);
    if (active && targetArt && geometry.targetRect) {
      const unitsPerPixel = active.art.width / geometry.targetRect.width;
      targetArt.near.style.display = "";
      targetArt.far.style.display = "";
      targetArt.near.setAttribute("transform", `translate(${(nearDelta * unitsPerPixel).toFixed(3)} 0)`);
      targetArt.far.setAttribute("transform", `translate(${(farDelta * unitsPerPixel).toFixed(3)} 0)`);
    }
    if ((state === "opening" || state === "closing") && buffers) drawMorph(nearDelta, farDelta);
  }

  function tick(timestamp) {
    frameId = null;
    if (lastTimestamp !== null) {
      const delta = Math.max(0, timestamp - lastTimestamp) / 1000;
      time += delta;
      if (state === "opening") progress = Math.min(1, progress + delta / transitionDuration);
      if (state === "closing") progress = Math.max(0, progress - delta / transitionDuration);
    }
    lastTimestamp = timestamp;
    if (state === "opening" && progress >= 1) settleDetail(true);
    if (state === "closing" && progress <= 0) settleOverview(active?.id);
    if (state === "opening" || state === "closing") updateTransitionView();
    drawMotion();
    frameId = window.requestAnimationFrame(tick);
  }

  function updateRunState() {
    if (reducedMotion.matches) {
      if (state === "opening") settleDetail(true);
      if (state === "closing") settleOverview(active?.id);
    }
    const shouldRun = pageActive && !document.hidden && isIntersecting && !reducedMotion.matches;
    if (!shouldRun) {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      lastTimestamp = null;
      if (reducedMotion.matches) drawStatic();
      return;
    }
    if (frameId === null) {
      drawMotion();
      frameId = window.requestAnimationFrame(tick);
    }
  }

  async function openProject(project, moveFocus) {
    const version = ++requestVersion;
    const previousState = state;
    const previousProgress = progress;
    const previousProjectId = active?.id;
    pendingHeadingFocus = moveFocus ? { version, projectId: project.id } : null;
    history.scrollRestoration = "manual";
    if (previousState === "overview") {
      overviewScrollY = window.scrollY;
      hasOverviewScroll = true;
      window.scrollTo(0, 0);
    }
    const projectChanged = active?.id !== project.id;
    active = project;
    heading.hidden = false;
    renderCopy(project);
    experience.classList.add("is-detail");
    if (projectChanged) showTarget(project);
    hoveredId = null;
    focusedId = null;
    showPreview();
    positionDetailContent();
    stage.setAttribute("aria-busy", "true");
    // A changed URL can request another detail while one is already visible.
    if (reducedMotion.matches || (previousState !== "overview" &&
        previousState !== "closing" && previousProjectId !== project.id)) {
      settleDetail(moveFocus);
      return;
    }
    state = "loading";
    progress = previousState === "closing" ? previousProgress : 0;
    updateTransitionView();
    source.style.pointerEvents = "none";
    source.inert = true;
    try {
      await prepareBuffers(project);
    } catch (error) {
      console.error("Project artwork could not be prepared", error);
      if (version === requestVersion) settleDetail(moveFocus);
      return;
    }
    if (version !== requestVersion || active?.id !== project.id) return;
    state = "opening";
    progress = previousState === "closing" ? previousProgress : 0;
    morphCanvas.hidden = false;
    source.hidden = false;
    targetHost.hidden = false;
    source.style.pointerEvents = "none";
    updateTransitionView();
    drawMotion();
    updateRunState();
  }

  async function closeProject() {
    if (state === "overview" || !active) return;
    const project = active;
    const previousState = state;
    const version = ++requestVersion;
    pendingHeadingFocus = null;
    if (document.activeElement === title) back.focus({ preventScroll: true });
    if (state === "loading") {
      settleOverview(project.id);
      return;
    }
    stage.setAttribute("aria-busy", "true");
    if (reducedMotion.matches) {
      settleOverview(project.id);
      source.style.pointerEvents = "";
      return;
    }
    if (!buffers || buffers.projectId !== project.id) {
      try { await prepareBuffers(project); }
      catch (error) { console.error("Project artwork could not be prepared", error); }
    }
    if (version !== requestVersion) return;
    if (!buffers) {
      settleOverview(project.id);
      source.style.pointerEvents = "";
      return;
    }
    state = "closing";
    if (progress === 0 && previousState === "detail") progress = 1;
    if (progress === 0) {
      settleOverview(project.id);
      return;
    }
    morphCanvas.hidden = false;
    source.hidden = false;
    targetHost.hidden = false;
    updateTransitionView();
    drawMotion();
    updateRunState();
  }

  function currentHashProject() {
    try { return projectById.get(decodeURIComponent(location.hash.slice(1))) || null; }
    catch { return null; }
  }

  function syncFromLocation() {
    const project = currentHashProject();
    if (!project) {
      closeProject();
    } else if (active?.id !== project.id || state === "closing") {
      openProject(project, true);
    }
  }

  function returnToProjects() {
    if (history.state?.projectsPage) {
      history.back();
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      closeProject();
    }
  }

  back.addEventListener("click", returnToProjects);
  projectsLink.addEventListener("click", (event) => {
    if (state === "overview" || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (state !== "closing") returnToProjects();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state !== "overview") back.click();
  });
  window.addEventListener("popstate", syncFromLocation);
  window.addEventListener("hashchange", syncFromLocation);
  window.addEventListener("resize", () => {
    updateGeometry();
    positionDetailContent();
    updateNavRelease();
    if ((state === "opening" || state === "closing") && active) prepareBuffers(active).then(() => drawMotion());
    else drawMotion();
  });
  window.addEventListener("scroll", queueNavRelease, { passive: true });
  document.addEventListener("visibilitychange", updateRunState);
  window.addEventListener("pagehide", () => {
    pageActive = false;
    history.scrollRestoration = originalScrollRestoration;
    updateRunState();
  });
  window.addEventListener("pageshow", () => {
    pageActive = true;
    history.scrollRestoration = state === "overview" ? originalScrollRestoration : "manual";
    updateRunState();
  });
  reducedMotion.addEventListener("change", () => {
    updateRunState();
    updateNavRelease();
  });
  compactMotion.addEventListener("change", drawMotion);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      isIntersecting = entries[0].isIntersecting;
      updateRunState();
    }, { threshold: 0.01 });
    observer.observe(stage);
  }

  updateGeometry();
  const initialProject = currentHashProject();
  if (initialProject) {
    active = initialProject;
    heading.hidden = false;
    renderCopy(initialProject);
    experience.classList.add("is-detail");
    showTarget(initialProject);
    settleDetail(false);
  } else {
    settleOverview();
  }
  document.documentElement.classList.remove("projects-initial-detail");
  updateRunState();
})();

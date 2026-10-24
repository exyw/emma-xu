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
  const projectsLinks = nav.querySelectorAll('a[href="projects.html"][aria-current="page"]');
  const overviewNavigation = document.querySelector('.overview-navigation');
  const overviewTitle = document.querySelector('.projects-overview-title');
  const pagination = document.querySelector('.project-pagination');
  const previousButton = document.querySelector('.project-previous');
  const nextButton = document.querySelector('.project-next');
  const position = document.querySelector('.project-position');
  const announcement = document.querySelector('.project-announcement');
  const main = document.querySelector('.projects-main');
  const mobileNav = window.siteLayout;
  function setPortraitOverview(value) {
    document.body.classList.toggle('portrait-overview-page', value);
    nav.dispatchEvent(new Event('site-nav-layout'));
  }
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

  // All navigation uses the verified order and content in projects-config.js.
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const points = window.projectMorphPoints;
  const svg = (tag, attributes = {}) => {
    const element = document.createElementNS(svgNS, tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    return element;
  };
  const url = (path) => new URL(path, document.baseURI).href;
  const asciiUrl = (name) => url(`${assets}ascii/${name}`);
  const colourUrl = (name) => url(`${assets}colour/${name}`);
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
    wrapper.className = `projects-target${project.id === 'cnn' ? ' projects-target--cnn' : ''}`;
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
  let ghostId = null;
  let ghost = null;
  let returnFocusId = null;
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
  let closingToOverview = false;
  let navRelease = 0;
  let navFrameId = null;
  let overviewScrollY = 0;
  let hasOverviewScroll = false;
  let pendingHeadingFocus = null;
  let renderedProjectId = null;
  const imageCache = new Map();
  const transitionDuration = 1.2;
  const originalScrollRestoration = history.scrollRestoration;
  const themeControls = [...nav.querySelectorAll("a, button"), back];
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
    // Mobile copy is available during the morph; flip each text region at its own contrast threshold.
    const controls = mobileNav.matches ? [
      ...themeControls, headingInfo, meta, copy, pagination,
      ...copy.querySelectorAll('p, a'), ...pagination.querySelectorAll('button'),
    ] : themeControls;
    if (state === "overview" || state === "detail") {
      controls.forEach((control) => control.style.removeProperty("--project-transition-ink"));
      return;
    }
    if (fade === 0 || fade === 1) {
      const ink = fade === 0 ? "#000" : "#fff";
      controls.forEach((control) => control.style.setProperty("--project-transition-ink", ink));
      return;
    }
    const bodyRect = document.body.getBoundingClientRect();
    for (const control of controls) {
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
    // Desktop copy waits for the darker phase; mobile text tracks contrast throughout the morph.
    const fade = ease(clamp(progress / 0.6, 0, 1));
    document.body.style.setProperty("--detail-fade", String(fade));
    document.body.classList.toggle("is-inverted", progress > 0.15);
    updateControlInk(fade);
  }

  function revealDetailContent() {
    const titleVisible = mobileNav.matches
      ? Boolean(active) && state !== 'overview' && (state !== 'closing' || progress >= .55)
      : state === 'detail' || ((state === 'opening' || state === 'closing') && progress >= .55);
    const copyVisible = mobileNav.matches ? titleVisible : state === 'detail' ||
      (state === 'opening' && progress >= .65);
    heading.classList.toggle("is-title-visible", titleVisible);
    headingInfo.setAttribute("aria-hidden", String(!titleVisible));
    copy.classList.toggle("is-content-visible", copyVisible);
    copy.inert = !copyVisible;
    copy.setAttribute("aria-hidden", String(!copyVisible));
    pagination.inert = pagination.hidden || (!mobileNav.matches && !copyVisible);
    pagination.setAttribute("aria-hidden", String(pagination.inert));
    if (titleVisible && pendingHeadingFocus &&
        pendingHeadingFocus.version === requestVersion &&
        pendingHeadingFocus.projectId === active?.id &&
        (state === "opening" || state === "detail")) {
      pendingHeadingFocus = null;
      title.focus({ preventScroll: true });
    }
  }

  function updateTransitionView() {
    experience.classList.toggle("is-transitioning", (mobileNav.matches && state === "loading") || state === "opening" || state === "closing");
    experience.classList.toggle("is-copy-fading", !mobileNav.matches && state === "closing");
    ghost?.sync();
    revealDetailContent();
    updateNavRelease();
    updateTheme();
  }

  function resetNavRelease() {
    navRelease = 0;
    nav.style.removeProperty("--portrait-nav-release");
  }

  function updateNavRelease() {
    const content = copy.hidden ? pagination : copy;
    if (!experience.classList.contains("is-detail") || content.hidden ||
        !copy.classList.contains("is-content-visible") || mobileNav.matches) {
      resetNavRelease();
      return;
    }
    const copyTop = content.getBoundingClientRect().top + window.scrollY;
    // Include the full menu box so its links stay clear when they expand.
    const navBottomAtRest = nav.getBoundingClientRect().bottom + navRelease;
    const overrun = window.scrollY + navBottomAtRest + navCopyGap - copyTop;
    let nextRelease = Math.max(0, overrun);
    if (!window.siteMotion.stopped && Math.abs(overrun) < navEaseDistance / 2) {
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
      saveReadingPosition();
    });
  }

  projects.forEach((project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-choice";
    button.dataset.project = project.id;
    if (mobileNav.matches) button.title = project.title;
    button.setAttribute("aria-label", `Open ${project.title} project`);
    const slot = project.slot;
    button.style.left = `${((slot.x - crop.x) / crop.width) * 100}%`;
    button.style.top = `${((slot.y - crop.y) / crop.height) * 100}%`;
    button.style.width = `${(slot.width / crop.width) * 100}%`;
    button.style.height = `${(slot.height / crop.height) * 100}%`;
    const colour = document.createElement("img");
    colour.className = "project-choice__colour";
    colour.alt = "";
    colour.setAttribute("aria-hidden", "true");
    colour.decoding = "async";
    colour.draggable = false;
    colour.addEventListener("error", () => {
      if (button.classList.contains("is-colour-missing")) return;
      button.classList.add("is-colour-missing");
      colour.src = asciiUrl(project.small);
    });
    button.append(colour);
    button.addEventListener("focus", () => {
      focusedId = button.matches(":focus-visible") ? project.id : null;
      ghost?.sync();
      showPreview();
    });
    button.addEventListener("blur", () => {
      if (focusedId === project.id) focusedId = null;
      ghost?.quiet();
      showPreview();
    });
    button.addEventListener("click", () => {
      if (state !== "overview") return;
      navigateProject(project);
    });
    source.append(button);
    buttons.set(project.id, button);
  });

  function showPreview() {
    const preview = state === "overview" ? (focusedId || hoveredId || ghostId) : null;
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
    ghost?.quiet();
    showPreview();
  });
  document.addEventListener("pointerdown", (event) => {
    if (source.contains(event.target)) return;
    hoveredId = null;
    focusedId = null;
    ghost?.quiet();
    showPreview();
  });
  ghost = window.createGhostPreview({
    element: stage, ids: projects.map((project) => project.id),
    show(id) { ghostId = id; showPreview(); },
    blocked: () => state !== 'overview' || Boolean(hoveredId || focusedId),
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

  function overviewSourceRect() {
    // Measure the settled overview without painting an intermediate frame.
    // Its centred stage differs from the detail layout used during the morph.
    const current = stage.getBoundingClientRect();
    const detailScrollY = window.scrollY;
    const copyWasHidden = copy.hidden;
    const paginationWasHidden = pagination.hidden;
    const stageMinHeight = stage.style.getPropertyValue('--project-stage-min-height');
    const wasDetail = experience.classList.contains('is-detail');
    const wasOverview = document.body.classList.contains('portrait-overview-page');
    let overview;
    let measuredScrollY;
    try {
      copy.hidden = true;
      pagination.hidden = true;
      experience.classList.remove('is-detail');
      document.body.classList.add('portrait-overview-page');
      stage.style.removeProperty('--project-stage-min-height');
      overview = stage.getBoundingClientRect();
      measuredScrollY = window.scrollY;
    } finally {
      if (stageMinHeight) stage.style.setProperty('--project-stage-min-height', stageMinHeight);
      document.body.classList.toggle('portrait-overview-page', wasOverview);
      experience.classList.toggle('is-detail', wasDetail);
      copy.hidden = copyWasHidden;
      pagination.hidden = paginationWasHidden;
      if (window.scrollY !== detailScrollY) window.scrollTo(0, detailScrollY);
    }
    const figureWidth = overview.height * crop.width / crop.height * sourceWidthScale;
    const overviewScrollTarget = hasOverviewScroll ? overviewScrollY : 0;
    return {
      x: overview.left - current.left + (overview.width - figureWidth) / 2,
      y: overview.top + measuredScrollY - overviewScrollTarget - current.top,
      width: figureWidth, height: overview.height,
    };
  }

  function updateGeometry() {
    // Let wrapped/enlarged headings grow the stage instead of clipping the morph.
    if (active && mobileNav.matches) {
      const art = active.art;
      const artHeight = Math.min(art.maxHeight, art.height * Math.min(art.maxWidth, stage.clientWidth - 28) / art.width);
      stage.style.setProperty('--project-stage-min-height', `${heading.offsetHeight + artHeight + 72}px`);
    } else {
      stage.style.removeProperty('--project-stage-min-height');
    }
    geometry = rects();
    geometry.stageWidth = geometry.width;
    geometry.stageHeight = geometry.height;
    geometry.canvasLeft = 0;
    geometry.canvasTop = 0;
    if (closingToOverview && mobileNav.matches) {
      geometry.sourceRect = overviewSourceRect();
      const { sourceRect, targetRect } = geometry;
      geometry.canvasLeft = Math.min(0, sourceRect.x, targetRect?.x ?? 0);
      geometry.canvasTop = Math.min(0, sourceRect.y, targetRect?.y ?? 0);
      geometry.width = Math.max(geometry.stageWidth, sourceRect.x + sourceRect.width,
        (targetRect?.x ?? 0) + (targetRect?.width ?? 0)) - geometry.canvasLeft;
      geometry.height = Math.max(geometry.stageHeight, sourceRect.y + sourceRect.height,
        (targetRect?.y ?? 0) + (targetRect?.height ?? 0)) - geometry.canvasTop;
      Object.assign(morphCanvas.style, {
        left: `${geometry.canvasLeft}px`, top: `${geometry.canvasTop}px`,
        right: 'auto', bottom: 'auto',
        width: `${geometry.width}px`, height: `${geometry.height}px`,
      });
    } else {
      ['left', 'top', 'right', 'bottom', 'width', 'height'].forEach((property) =>
        morphCanvas.style.removeProperty(property));
    }
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
    experience.style.setProperty("--project-rule-gap", `${artGap / 2}px`);
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
    metaText.textContent = mobileNav.matches ? project.meta || '' : (project.meta || '').replace(/ · /g, '\u00a0·\u00a0');
    meta.hidden = !project.meta;
    window.detachTypewriters(copy);
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
    copy.hidden = !mobileNav.matches && !copy.childElementCount;
    pagination.hidden = false;
    overviewNavigation.hidden = true;
    overviewTitle.hidden = true;
    const index = projects.indexOf(project);
    const previous = projects[mod(index - 1, projects.length)];
    const next = projects[mod(index + 1, projects.length)];
    previousButton.textContent = `← ${previous.title}`;
    nextButton.textContent = `${next.title} →`;
    previousButton.setAttribute('aria-label', `Previous project: ${previous.title}`);
    nextButton.setAttribute('aria-label', `Next project: ${next.title}`);
    position.textContent = `${index + 1} / ${projects.length}`;
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
    if (closingToOverview) {
      closingToOverview = false;
      updateGeometry();
    }
    positionDetailContent();
    if (!focus) pendingHeadingFocus = null;
    updateTransitionView();
    drawMotion();
  }

  function settleOverview(focusId = null) {
    pendingHeadingFocus = null;
    announcement.textContent = "";
    state = "overview";
    progress = 0;
    source.hidden = false;
    source.inert = false;
    projects.forEach((project) => {
      const colour = buttons.get(project.id).querySelector(".project-choice__colour");
      if (!colour.hasAttribute("src")) colour.src = colourUrl(project.colour);
    });
    source.style.opacity = "1";
    source.style.pointerEvents = "";
    targetHost.hidden = true;
    morphCanvas.hidden = true;
    heading.hidden = true;
    copy.hidden = true;
    pagination.hidden = true;
    overviewNavigation.hidden = !mobileNav.matches;
    overviewTitle.hidden = false;
    stage.setAttribute("aria-label", "Select a project from the ASCII portrait");
    stage.removeAttribute("aria-busy");
    experience.classList.remove("is-detail");
    setPortraitOverview(true);
    closingToOverview = false;
    experience.style.removeProperty("--project-heading-top");
    experience.style.removeProperty("--project-copy-offset");
    experience.style.removeProperty("--project-divider-offset");
    experience.style.removeProperty("--project-rule-gap");
    resetNavRelease();
    active = null;
    hoveredId = null;
    focusedId = null;
    updateGeometry();
    showPreview();
    updateTransitionView();
    if (focusId) buttons.get(returnFocusId || focusId)?.focus({ preventScroll: true });
    returnFocusId = null;
    if (focusId) window.scrollTo(0, hasOverviewScroll ? overviewScrollY : 0);
    history.scrollRestoration = originalScrollRestoration;
    ghost?.quiet();
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
    const expectedWidth = Math.round(geometry.width);
    const expectedHeight = Math.round(geometry.height);
    if (buffers?.projectId === project.id && buffers.width === expectedWidth && buffers.height === expectedHeight) return buffers;
    const [silhouette, ...art] = await Promise.all([
      loadImage(asciiUrl("Silhouette ASCII.svg")),
      ...projects.map((item) => loadImage(asciiUrl(item.small))),
      loadImage(asciiUrl(project.large)),
    ]);
    if (active?.id !== project.id) return null;
    if (!geometry || geometry.stageWidth !== stage.clientWidth || geometry.stageHeight !== stage.clientHeight) updateGeometry();
    const { width, height, sourceRect, targetRect, canvasLeft, canvasTop } = geometry;
    const sourceCanvas = canvasOf(width, height);
    const sourceContext = sourceCanvas.getContext("2d");
    sourceContext.drawImage(
      silhouette, crop.x, crop.y, crop.width, crop.height,
      sourceRect.x - canvasLeft, sourceRect.y - canvasTop, sourceRect.width, sourceRect.height,
    );
    projects.forEach((item, index) => {
      const slot = item.slot;
      const x = sourceRect.x - canvasLeft + (slot.x - crop.x) / crop.width * sourceRect.width;
      const y = sourceRect.y - canvasTop + (slot.y - crop.y) / crop.height * sourceRect.height;
      const width = slot.width / crop.width * sourceRect.width;
      const height = slot.height / crop.height * sourceRect.height;
      sourceContext.drawImage(art[index], x, y, width, height);
    });
    const targetCanvas = canvasOf(width, height);
    targetCanvas.getContext("2d").drawImage(
      art[art.length - 1], targetRect.x - canvasLeft, targetRect.y - canvasTop,
      targetRect.width, targetRect.height,
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
    const { width, height, sourceRect, targetRect, canvasLeft, canvasTop } = geometry;
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
        const sx = sourceRect.x - canvasLeft + a[0] / 10000 * sourceRect.width;
        const sy = sourceRect.y - canvasTop + a[1] / 10000 * sourceRect.height;
        const tx = targetRect.x - canvasLeft + b[0] / 10000 * targetRect.width;
        const ty = targetRect.y - canvasTop + b[1] / 10000 * targetRect.height;
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
        const sx = sourceRect.x - canvasLeft + a[0] / 10000 * sourceRect.width;
        const sy = sourceRect.y - canvasTop + a[1] / 10000 * sourceRect.height;
        const tx = targetRect.x - canvasLeft + b[0] / 10000 * targetRect.width;
        const ty = targetRect.y - canvasTop + b[1] / 10000 * targetRect.height;
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
    if (window.siteMotion.stopped) { drawStatic(); return; }
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
    if (window.siteMotion.stopped) {
      if (state === "opening") settleDetail(true);
      if (state === "closing") settleOverview(active?.id);
    }
    const shouldRun = pageActive && !document.hidden && isIntersecting && !window.siteMotion.stopped;
    if (!shouldRun) {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      lastTimestamp = null;
      if (window.siteMotion.stopped) drawStatic();
      return;
    }
    if (frameId === null) {
      drawMotion();
      frameId = window.requestAnimationFrame(tick);
    }
  }

  async function openProject(project, moveFocus, restoreY = 0) {
    const version = ++requestVersion;
    const previousState = state;
    const previousProgress = progress;
    const previousProjectId = active?.id;
    pendingHeadingFocus = moveFocus ? { version, projectId: project.id } : null;
    history.scrollRestoration = "manual";
    if (previousState === "overview") {
      overviewScrollY = window.scrollY;
      hasOverviewScroll = true;
    }
    const projectChanged = active?.id !== project.id;
    active = project;
    heading.hidden = false;
    setPortraitOverview(false);
    renderCopy(project);
    experience.classList.add("is-detail");
    if (projectChanged) showTarget(project);
    hoveredId = null;
    focusedId = null;
    showPreview();
    positionDetailContent();
    if (mobileNav.matches || previousState === 'overview' || projectChanged) window.scrollTo(0, restoreY);
    if (mobileNav.matches) requestAnimationFrame(() => { if (version === requestVersion) window.scrollTo(0, restoreY); });
    stage.setAttribute("aria-busy", "true");
    // A changed URL can request another detail while one is already visible.
    if (window.siteMotion.stopped || (previousState !== "overview" &&
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
    if (window.siteMotion.stopped) {
      settleOverview(project.id);
      source.style.pointerEvents = "";
      return;
    }
    if (mobileNav.matches) {
      closingToOverview = true;
      updateGeometry();
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
      openProject(project, !mobileNav.matches, history.state?.readingY || 0);
    }
  }

  function saveReadingPosition() {
    history.replaceState({ ...history.state, readingY: window.scrollY }, '', location.href);
  }

  function navigateProject(project, moveFocus = true) {
    saveReadingPosition();
    const depth = state === 'overview' ? 1 : history.state?.overviewDepth ? history.state.overviewDepth + 1 : 0;
    history.pushState({ projectsPage: true, overviewDepth: depth, readingY: 0 }, '', `#${project.id}`);
    openProject(project, moveFocus);
  }

  function adjacentProject(direction) {
    if (!active) return;
    const project = projects[mod(projects.indexOf(active) + direction, projects.length)];
    if (!mobileNav.matches && document.activeElement === title) title.blur();
    navigateProject(project, mobileNav.matches);
    if (!mobileNav.matches) {
      announcement.textContent = `Project ${projects.indexOf(project) + 1} of ${projects.length}: ${project.title}`;
    }
  }
  previousButton.addEventListener('click', () => adjacentProject(-1));
  nextButton.addEventListener('click', () => adjacentProject(1));
  window.addHorizontalSwipe(main, (direction) => {
    if (state === 'overview') {
      if (direction === 1) location.href = 'who-i-am.html'; // Swipe left to reveal Who I am on the right.
    } else if (state !== 'closing') adjacentProject(direction);
  });

  function returnToProjects() {
    returnFocusId = active?.id;
    saveReadingPosition();
    if (history.state?.overviewDepth) {
      history.go(-history.state.overviewDepth);
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      closeProject();
    }
  }

  back.addEventListener("click", returnToProjects);
  projectsLinks.forEach((projectsLink) => projectsLink.addEventListener("click", (event) => {
    if (state === "overview" || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (state !== "closing") returnToProjects();
  }));
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    if (event.key === "Escape" && state !== "overview") {
      back.click();
      return;
    }
    if (mobileNav.matches || !active || state === 'closing' || event.repeat || event.isComposing ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        getSelection()?.toString() ||
        (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') ||
        event.target.closest?.('a, input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    adjacentProject(event.key === 'ArrowRight' ? 1 : -1);
  });
  window.addEventListener("popstate", syncFromLocation);
  window.addEventListener("hashchange", syncFromLocation);
  function reflow() {
    projects.forEach((project) => {
      const button = buttons.get(project.id);
      if (mobileNav.matches) button.title = project.title;
      else button.removeAttribute('title');
    });
    pagination.hidden = !active;
    overviewNavigation.hidden = !mobileNav.matches || Boolean(active);
    if (active) {
      copy.hidden = !mobileNav.matches && !copy.childElementCount;
      metaText.textContent = mobileNav.matches ? active.meta || '' : (active.meta || '').replace(/ · /g, '\u00a0·\u00a0');
    }
    updateTransitionView();
    updateGeometry();
    positionDetailContent();
    updateNavRelease();
    if ((state === "opening" || state === "closing") && active) prepareBuffers(active).then(() => drawMotion());
    else drawMotion();
  }
  window.addEventListener('resize', reflow);
  mobileNav.addEventListener('change', reflow);
  window.addEventListener("scroll", queueNavRelease, { passive: true });
  document.addEventListener("visibilitychange", updateRunState);
  window.addEventListener("pagehide", () => {
    pageActive = false;
    saveReadingPosition();
    history.scrollRestoration = originalScrollRestoration;
    updateRunState();
  });
  window.addEventListener("pageshow", () => {
    pageActive = true;
    history.scrollRestoration = state === "overview" ? originalScrollRestoration : "manual";
    updateRunState();
  });
  window.siteMotion.subscribe(() => {
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
    setPortraitOverview(false);
    renderCopy(initialProject);
    experience.classList.add("is-detail");
    showTarget(initialProject);
    settleDetail(false);
    window.scrollTo(0, history.state?.readingY || 0);
  } else {
    settleOverview();
  }
  document.documentElement.classList.remove("projects-initial-detail");
  updateRunState();
})();

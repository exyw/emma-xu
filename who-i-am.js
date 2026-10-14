(() => {
  const illustration = { width: 276, height: 900, pageX: 627, pageY: 51 };
  const motion = {
    swayCycle: 6, desktopAmplitude: 12, compactAmplitude: 8,
    nearDelay: 0.65, farDelay: 1.15, nearOpacity: 0.43, farOpacity: 0.34,
    burstInterval: 5.8, burstStart: 4.35, burstDuration: 0.7,
    burstAttackFraction: 0.2, desktopSplit: 24, compactSplit: 12,
    nearSplitFraction: 0.6, initialTime: 3.1,
    charcoal: [36, 34, 31], grey: [83, 77, 70],
    amber: [188, 121, 40], coral: [186, 77, 62],
  };

  // Source bounds come from the 1512 × 982 Figma frame. The portrait,
  // keepsakes, and echo cutouts all use this coordinate system.
  const keepsakes = [
    { id: "radiohead", label: "Radiohead", ascii: "RadioHead.svg", original: null, x: 729, y: 111, width: 60, height: 60 },
    { id: "beli", label: "Beli", ascii: "Beli.svg", original: null, x: 716, y: 232, width: 67, height: 57 },
    { id: "drawing-closer", label: "Drawing Closer", ascii: "DrawingCloser.svg", original: "DrawingCloser.jpeg", x: 650, y: 315, width: 98, height: 121 },
    { id: "wit", label: "WIT", ascii: "WIT.svg", original: null, x: 759, y: 301, width: 108, height: 63 },
    { id: "malcolm-todd", label: "Malcolm Todd", ascii: "MalcolmTodd.svg", original: "MalcolmTodd.png", x: 771, y: 413, width: 72, height: 60 },
    { id: "dominic-fike", label: "Dominic Fike", ascii: "DominicFike.svg", original: "DominicFike.png", x: 639, y: 507, width: 61, height: 60 },
    { id: "18x2", label: "18×2", ascii: "18x2.svg", original: null, x: 714, y: 497, width: 91, height: 145 },
    { id: "bon-iver", label: "Bon Iver", ascii: "BonIver.svg", original: null, x: 818, y: 508, width: 61, height: 60 },
    { id: "baby-me", label: "Baby me", ascii: "BabyMe.svg", original: "BabyMe.jpg", x: 692, y: 689, width: 53, height: 81 },
    { id: "dear-you", label: "Dear You", ascii: "DearYou.svg", original: "DearYou.jpg", x: 771, y: 714, width: 61, height: 90 },
    { id: "grandma", label: "How to Make Millions Before Grandma Dies", ascii: "HowToMakeMillionsBeforeGrandmaDies.svg", original: null, x: 686, y: 819, width: 61, height: 87 },
  ];

  const svgNamespace = "http://www.w3.org/2000/svg";
  const svgElement = (name, attributes = {}) => {
    const element = document.createElementNS(svgNamespace, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  };
  const positiveModulo = (value, divisor) => ((value % divisor) + divisor) % divisor;
  const mix = (from, to, amount) => from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
  const rgb = (channels) => `rgb(${channels.join(" ")})`;

  function makeArtwork(uniqueId) {
    const svg = svgElement("svg", {
      class: "who-figure__art", viewBox: "-86 0 448 900",
      "aria-hidden": "true", focusable: "false",
    });
    const silhouetteId = `who-silhouette-${uniqueId}`;
    const cutoutId = `who-cutouts-${uniqueId}`;
    const colourId = `who-colour-${uniqueId}`;
    const defs = svgElement("defs");

    // Alpha masking keeps the SVG's black glyphs and leaves its empty space clear.
    const silhouetteMask = svgElement("mask", {
      id: silhouetteId, x: -86, y: 0, width: 448, height: 900,
      maskUnits: "userSpaceOnUse", maskContentUnits: "userSpaceOnUse",
      style: "mask-type: alpha",
    });
    silhouetteMask.append(svgElement("image", {
      href: "assets/contact/ascii/silhouette.svg", x: 0, y: 0,
      width: illustration.width, height: illustration.height,
      preserveAspectRatio: "none",
    }));

    // This mask is stationary relative to the main figure as the echoes move.
    const cutoutMask = svgElement("mask", {
      id: cutoutId, x: -86, y: 0, width: 448, height: 900,
      maskUnits: "userSpaceOnUse", maskContentUnits: "userSpaceOnUse",
      style: "mask-type: luminance",
    });
    cutoutMask.append(svgElement("rect", { x: -86, y: 0, width: 448, height: 900, fill: "white" }));
    keepsakes.forEach((item) => cutoutMask.append(svgElement("rect", {
      x: item.x - illustration.pageX - 1, y: item.y - illustration.pageY - 1,
      width: item.width + 2, height: item.height + 2, fill: "black",
    })));

    // Repeating soft bands give neighbouring glyphs shared warm patches.
    const colour = svgElement("linearGradient", {
      id: colourId, x1: 0, y1: 0, x2: 125, y2: 180,
      gradientUnits: "userSpaceOnUse", spreadMethod: "repeat",
    });
    [
      ["0%", "#BC7928", "0.08"], ["16%", "#BC7928", "0.95"],
      ["38%", "#BA4D3E", "0.85"], ["55%", "#BA4D3E", "0.05"],
      ["76%", "#BC7928", "0.85"], ["100%", "#BC7928", "0.08"],
    ].forEach(([offset, colourValue, opacity]) => {
      colour.append(svgElement("stop", { offset, "stop-color": colourValue, "stop-opacity": opacity }));
    });
    defs.append(silhouetteMask, cutoutMask, colour);
    svg.append(defs);

    const echoCutouts = svgElement("g", { mask: `url(#${cutoutId})` });
    const far = svgElement("g", { mask: `url(#${silhouetteId})`, opacity: motion.farOpacity });
    const farFill = svgElement("rect", { x: 0, y: 0, width: 276, height: 900, fill: rgb(motion.grey) });
    far.append(farFill);
    const near = svgElement("g", { mask: `url(#${silhouetteId})`, opacity: motion.nearOpacity });
    const nearFill = svgElement("rect", { x: 0, y: 0, width: 276, height: 900, fill: rgb(motion.grey) });
    near.append(nearFill);
    echoCutouts.append(far, near);

    const main = svgElement("g", { mask: `url(#${silhouetteId})` });
    main.append(svgElement("rect", { x: 0, y: 0, width: 276, height: 900, fill: rgb(motion.charcoal) }));
    const warmFill = svgElement("rect", {
      x: 0, y: 0, width: 276, height: 900,
      fill: `url(#${colourId})`, opacity: 0,
    });
    main.append(warmFill);
    svg.append(echoCutouts, main);
    return { svg, echoCutouts, far, near, farFill, nearFill, warmFill, colour };
  }

  document.querySelectorAll("[data-keepsake-figure]").forEach((figure, index) => {
    if (figure.dataset.motionInitialized) return;
    figure.dataset.motionInitialized = "true";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactMotion = window.matchMedia("(max-width: 640px), (max-height: 740px)");
    const artwork = makeArtwork(index);
    const moving = document.createElement("div");
    moving.className = "who-figure__motion";
    moving.append(artwork.svg);
    figure.append(moving);

    const buttons = new Map();
    let hoveredId = null;
    let focusedId = null;
    let selectedId = null;
    let pointerType = null;

    function renderActive() {
      const activeId = focusedId || hoveredId || selectedId;
      buttons.forEach((button, id) => {
        button.classList.toggle("is-active", id === activeId);
        button.setAttribute("aria-pressed", String(id === selectedId));
      });
    }

    keepsakes.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "who-keepsake";
      button.dataset.keepsake = item.id;
      button.setAttribute("aria-label", `${item.label} keepsake${item.original ? "" : ", original image pending"}`);
      button.setAttribute("aria-pressed", "false");
      button.style.left = `${((item.x - illustration.pageX) / illustration.width) * 100}%`;
      button.style.top = `${((item.y - illustration.pageY) / illustration.height) * 100}%`;
      button.style.width = `${(item.width / illustration.width) * 100}%`;
      button.style.height = `${(item.height / illustration.height) * 100}%`;

      if (item.original) {
        const original = document.createElement("img");
        original.className = "who-keepsake__original";
        original.src = `assets/contact/images/${item.original}`;
        original.alt = "";
        original.setAttribute("aria-hidden", "true");
        original.draggable = false;
        button.append(original);
      }
      const ascii = document.createElement("img");
      ascii.className = "who-keepsake__ascii";
      ascii.src = `assets/contact/ascii/${item.ascii}`;
      ascii.alt = "";
      ascii.setAttribute("aria-hidden", "true");
      ascii.draggable = false;
      button.append(ascii);

      button.addEventListener("pointerdown", (event) => {
        pointerType = event.pointerType;
        focusedId = null;
        if (event.pointerType === "mouse") hoveredId = item.id;
        renderActive();
      });
      button.addEventListener("focus", () => {
        focusedId = button.matches(":focus-visible") ? item.id : null;
        renderActive();
      });
      button.addEventListener("blur", () => {
        if (focusedId === item.id) focusedId = null;
        renderActive();
      });
      button.addEventListener("click", (event) => {
        if (event.detail === 0 || pointerType === "touch" || pointerType === "pen") {
          selectedId = selectedId === item.id ? null : item.id;
          renderActive();
        }
        pointerType = null;
      });
      buttons.set(item.id, button);
      moving.append(button);
    });

    // Pointer movement changes the hovered item. Motion alone cannot trigger an exit.
    document.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const region = figure.getBoundingClientRect();
      const insideRegion = event.clientX >= region.left - 80 && event.clientX <= region.right + 80 &&
        event.clientY >= region.top - 20 && event.clientY <= region.bottom + 20;
      let nextId = null;
      if (insideRegion) {
        for (const [id, button] of buttons) {
          const bounds = button.getBoundingClientRect();
          if (event.clientX >= bounds.left && event.clientX <= bounds.right &&
              event.clientY >= bounds.top && event.clientY <= bounds.bottom) nextId = id;
        }
      }
      if (nextId === hoveredId) return;
      hoveredId = nextId;
      renderActive();
    });
    document.addEventListener("pointerdown", (event) => {
      if (figure.contains(event.target)) return;
      selectedId = null;
      focusedId = null;
      renderActive();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      selectedId = null;
      renderActive();
    });

    let time = motion.initialTime;
    let lastTimestamp = null;
    let frameId = null;
    let isIntersecting = false;
    let pageActive = true;

    function drawStatic() {
      moving.style.transform = "none";
      artwork.echoCutouts.style.display = "none";
      artwork.warmFill.setAttribute("opacity", 0);
    }

    function drawMotion() {
      const amplitude = compactMotion.matches ? motion.compactAmplitude : motion.desktopAmplitude;
      const split = compactMotion.matches ? motion.compactSplit : motion.desktopSplit;
      const angle = (2 * Math.PI) / motion.swayCycle;
      const sway = (at) => amplitude * Math.sin(angle * at);
      const mainX = sway(time);
      const burstCycle = positiveModulo(time, motion.burstInterval);
      const u = (burstCycle - motion.burstStart) / motion.burstDuration;
      let intensity = 0;
      if (u >= 0 && u <= 1) {
        intensity = u < motion.burstAttackFraction
          ? u / motion.burstAttackFraction
          : Math.pow((1 - u) / (1 - motion.burstAttackFraction), 2);
      }
      const direction = Math.cos(angle * time) >= 0 ? 1 : -1;
      const nearX = sway(time - motion.nearDelay) - direction * motion.nearSplitFraction * split * intensity;
      const farX = sway(time - motion.farDelay) - direction * split * intensity;
      const sourceUnitsPerPixel = illustration.width / figure.clientWidth;

      moving.style.transform = `translate3d(${mainX.toFixed(3)}px, 0, 0)`;
      artwork.echoCutouts.style.display = "";
      artwork.near.setAttribute("transform", `translate(${((nearX - mainX) * sourceUnitsPerPixel).toFixed(3)} 0)`);
      artwork.far.setAttribute("transform", `translate(${((farX - mainX) * sourceUnitsPerPixel).toFixed(3)} 0)`);
      artwork.nearFill.setAttribute("fill", rgb(mix(motion.grey, motion.amber, intensity)));
      artwork.farFill.setAttribute("fill", rgb(mix(motion.grey, motion.coral, intensity)));
      artwork.warmFill.setAttribute("opacity", (intensity * 0.78).toFixed(3));
      artwork.colour.setAttribute("gradientTransform", `translate(${(time * 31).toFixed(2)} ${(time * -64).toFixed(2)})`);
    }

    function tick(timestamp) {
      frameId = null;
      if (lastTimestamp !== null) time += Math.max(0, timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;
      drawMotion();
      frameId = window.requestAnimationFrame(tick);
    }

    function updateRunState() {
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

    drawMotion();
    const observer = new IntersectionObserver((entries) => {
      isIntersecting = entries[0].isIntersecting;
      updateRunState();
    }, { threshold: 0.01 });
    observer.observe(figure);
    document.addEventListener("visibilitychange", updateRunState);
    window.addEventListener("pagehide", () => { pageActive = false; updateRunState(); });
    window.addEventListener("pageshow", () => { pageActive = true; updateRunState(); });
    reducedMotion.addEventListener("change", updateRunState);
    compactMotion.addEventListener("change", () => { if (frameId === null && !reducedMotion.matches) drawMotion(); });
    updateRunState();
  });
})();

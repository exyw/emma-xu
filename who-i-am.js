(() => {
  const illustration = { width: 276, height: 900, pageX: 627, pageY: 51 };

  // Source bounds come from the 1512 × 982 Figma frame. Keep placement here so
  // the portrait and all of its cutouts scale from one coordinate system.
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

  document.querySelectorAll("[data-keepsake-figure]").forEach((figure) => {
    const silhouette = document.createElement("img");
    silhouette.className = "who-figure__silhouette";
    silhouette.src = "assets/ascii/silhouette.svg";
    silhouette.alt = "";
    silhouette.setAttribute("aria-hidden", "true");
    silhouette.draggable = false;
    figure.append(silhouette);

    const glitch = silhouette.cloneNode();
    glitch.className = "who-figure__glitch";
    glitch.hidden = true;
    figure.append(glitch);

    const buttons = new Map();
    let hoveredId = null;
    let focusedId = null;
    let selectedId = null;
    let pointerType = null;

    function renderActive() {
      const activeId = hoveredId || focusedId || selectedId;
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
        original.src = `assets/images/${item.original}`;
        original.alt = "";
        original.setAttribute("aria-hidden", "true");
        original.draggable = false;
        button.append(original);
      }

      const ascii = document.createElement("img");
      ascii.className = "who-keepsake__ascii";
      ascii.src = `assets/ascii/${item.ascii}`;
      ascii.alt = "";
      ascii.setAttribute("aria-hidden", "true");
      ascii.draggable = false;
      button.append(ascii);

      button.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "mouse") return;
        hoveredId = item.id;
        renderActive();
      });
      button.addEventListener("pointerleave", () => {
        if (hoveredId === item.id) hoveredId = null;
        renderActive();
      });
      button.addEventListener("pointerdown", (event) => {
        pointerType = event.pointerType;
        focusedId = null;
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
      figure.append(button);
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
  });
})();

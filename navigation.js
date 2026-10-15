(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Each link gets its own typing state and timers.
  function attachTypewriter(link, { retryWidthOnResize = false } = {}) {
    const label = link.textContent.trim();
    const text = document.createElement("span");
    let widthLocked = false;
    let typingTimer;
    let cursorTimer;
    let isHovered = false;
    let previousDelays = [];
    const minimumTypingDelay = 40;
    const maximumTypingDelay = 300;
    const minimumLoopDelay = 250;
    const maximumLoopDelay = 900;

    // Keep the link from changing width while its text is being typed.
    // The homepage menu is hidden on mobile, so measure it after a resize if needed.
    function lockWidth() {
      if (widthLocked) return;
      const linkWidth = link.getBoundingClientRect().width;
      if (linkWidth > 0) {
        link.style.width = `${linkWidth}px`;
        widthLocked = true;
      }
    }

    lockWidth();
    if (retryWidthOnResize) window.addEventListener("resize", lockWidth);
    if (!link.hasAttribute("aria-label")) link.setAttribute("aria-label", label);
    link.textContent = "";
    link.classList.add("typewriter-link");
    text.className = "typewriter-link__text";
    text.setAttribute("aria-hidden", "true");
    text.textContent = label;
    link.append(text);

    function typeLabel() {
      if (reducedMotion.matches) return;

      window.clearTimeout(typingTimer);
      window.clearTimeout(cursorTimer);
      link.classList.add("is-typing");
      text.textContent = "";
      let characterIndex = 0;

      const currentDelays = [];

      function typeNextCharacter() {
        text.textContent = label.slice(0, characterIndex + 1);
        characterIndex += 1;

        if (characterIndex === label.length) {
          previousDelays = currentDelays;
          if (isHovered) {
            const loopDelay = minimumLoopDelay + Math.random() * (maximumLoopDelay - minimumLoopDelay);
            cursorTimer = window.setTimeout(typeLabel, loopDelay);
          }
          return;
        }

        const delayIndex = characterIndex - 1;
        let typingDelay;

        do {
          typingDelay =
            minimumTypingDelay +
            Math.random() * (maximumTypingDelay - minimumTypingDelay);
        } while (
          previousDelays[delayIndex] !== undefined &&
          Math.abs(typingDelay - previousDelays[delayIndex]) < 90
        );

        currentDelays[delayIndex] = typingDelay;
        typingTimer = window.setTimeout(typeNextCharacter, typingDelay);
      }

      typeNextCharacter();
    }

    link.addEventListener("mouseenter", () => {
      isHovered = true;
      typeLabel();
    });
    function resetLabel() {
      isHovered = false;
      window.clearTimeout(typingTimer);
      window.clearTimeout(cursorTimer);
      link.classList.remove("is-typing");
      text.textContent = label;
    }

    link.addEventListener("mouseleave", resetLabel);
    link.addEventListener("focus", typeLabel);
    link.addEventListener("blur", resetLabel);
  }

  window.attachTypewriter = attachTypewriter;
  document.querySelectorAll(".site-nav a").forEach((link) => {
    attachTypewriter(link, { retryWidthOnResize: true });
  });
})();

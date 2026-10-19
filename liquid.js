(() => {
  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform vec2 u_pointer;
    uniform float u_time;
    uniform float u_strength;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
    }

    float flow(vec2 p) {
      return noise(p) * 0.58 + noise(p * 2.13 + 7.4) * 0.29
           + noise(p * 4.37 - 3.8) * 0.13;
    }

    float smoothMax(float a, float b, float k) {
      float h = max(k - abs(a - b), 0.0) / k;
      return max(a, b) + h * h * k * 0.25;
    }

    void main() {
      // Work in page coordinates: x increases right, y increases down.
      vec2 p = vec2(v_uv.x, 1.0 - v_uv.y);
      float aspect = u_resolution.x / u_resolution.y;
      vec2 delta = vec2((p.x - u_pointer.x) * aspect, p.y - u_pointer.y);
      float distanceFromPointer = length(delta);
      float falloff = exp(-pow(distanceFromPointer / 0.30, 2.0));
      // Stir rotates a local area of the field around the cursor.
      float angle = 1.65 * u_strength * falloff;
      float c = cos(angle);
      float s = sin(angle);
      vec2 rotated = vec2(c * delta.x - s * delta.y,
                          s * delta.x + c * delta.y);
      vec2 q = u_pointer + vec2(rotated.x / aspect, rotated.y);

      // Move the entire colour mass, then let its edge flow locally. Keeping
      // these separate avoids a fixed silhouette that merely ripples in place.
      vec2 travel = vec2(
        0.12 * sin(u_time * 0.37) + 0.025 * (sin(u_time * 0.17 + 1.2) - sin(1.2)),
        0.085 * (sin(u_time * 0.31 + 0.6) - sin(0.6))
          + 0.020 * (cos(u_time * 0.43) - 1.0)
      );
      q -= travel;
      float t = u_time * 0.22;
      vec2 drift = vec2(flow(q * 2.5 + vec2(t, -t * 0.47)),
                        flow(q * 2.5 + vec2(12.3 - t * 0.38, t * 0.71)));
      q += (drift - 0.5) * 0.10;
      q += vec2(0.016 * sin(u_time * 0.30 + q.y * 7.0),
                0.013 * cos(u_time * 0.25 + q.x * 6.0));

      // Two connected reaches of one sheet of colour: a winding left edge
      // and a shallow top edge. Neither is drawn as a separate radial glow.
      float leftReach = 0.14
        + 0.37 * exp(-pow((q.y - 0.67) / 0.20, 2.0))
        + 0.24 * exp(-pow((q.y - 0.10) / 0.20, 2.0))
        - 0.13 * exp(-pow((q.y - 0.37) / 0.12, 2.0))
        + 0.023 * sin(u_time * 0.34 + q.y * 8.0);
      float topDepth = 0.015
        + 0.19 * exp(-pow((q.x - 0.64) / 0.19, 2.0))
        + 0.13 * exp(-pow((q.x - 0.13) / 0.27, 2.0))
        + 0.016 * cos(u_time * 0.27 + q.x * 6.0);
      // Narrow each reach to roughly 80% of its previous coverage.
      float field = smoothMax((leftReach * 0.80 - q.x) * 1.55,
                              (topDepth * 0.80 - q.y) * 1.65, 0.16);

      // Mid-scale variation changes the boundary and the colour together.
      float broad = flow(q * 5.0 + vec2(t * 0.44, -t * 0.26));
      float detail = flow(q * 24.0 + drift * 1.8);
      field += (broad - 0.5) * 0.15 + (detail - 0.5) * 0.026;
      float warmth = smoothstep(-0.27, 0.19, field);
      float core = smoothstep(-0.06, 0.32, field);

      vec3 dark = vec3(0.055, 0.039, 0.030);
      vec3 brown = vec3(0.34, 0.115, 0.042);
      vec3 orange = vec3(0.62, 0.245, 0.073);
      vec3 colour = mix(dark, brown, warmth * 0.84);
      colour = mix(colour, orange, core * (0.34 + broad * 0.25));

      // Fine grain stays in screen space while its visibility follows the
      // colour. The liquid can flow without stretching the grain pattern.
      float grain = noise(p * u_resolution / 3.8) - 0.5;
      colour *= 1.0 + grain * (0.055 + warmth * 0.16);
      gl_FragColor = vec4(colour, 1.0);
    }
  `;

  function shader(gl, type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      console.warn("Liquid background shader:", gl.getShaderInfoLog(result));
      gl.deleteShader(result);
      return null;
    }
    return result;
  }

  document.querySelectorAll("[data-liquid-root]").forEach((root) => {
    const canvas = root.querySelector("canvas[data-liquid-surface]");
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) return;
    const vertex = shader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Liquid background program:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);
    const vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      pointer: gl.getUniformLocation(program, "u_pointer"),
      time: gl.getUniformLocation(program, "u_time"),
      strength: gl.getUniformLocation(program, "u_strength"),
    };

    const pointer = { x: 0.5, y: 0.5, target: 0, strength: 0 };
    let inView = false;
    let pageActive = true;
    let frame;
    let previousTime = 0;
    let elapsed = 0;

    function movePointer(event) {
      if (window.siteMotion.stopped || (event.pointerType === "touch" && event.buttons === 0)) return;
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      pointer.x = x;
      pointer.y = y;
      pointer.target = 1;
    }
    function releasePointer() {
      pointer.target = 0;
    }
    root.addEventListener("pointermove", movePointer);
    root.addEventListener("pointerdown", movePointer);
    root.addEventListener("pointerleave", releasePointer);
    root.addEventListener("pointerup", (event) => {
      if (event.pointerType === "touch") releasePointer();
    });
    root.addEventListener("pointercancel", releasePointer);
    window.addEventListener("blur", releasePointer);

    function resize() {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return false;
      const scale = Math.min(window.devicePixelRatio || 1, 1.25);
      const pixelWidth = Math.round(width * scale);
      const pixelHeight = Math.round(height * scale);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        gl.viewport(0, 0, pixelWidth, pixelHeight);
      }
      return true;
    }

    function draw() {
      if (!resize()) return;
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
      gl.uniform1f(uniforms.time, elapsed);
      gl.uniform1f(uniforms.strength, pointer.strength);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function animate(now) {
      frame = window.requestAnimationFrame(animate);
      if (now - previousTime < 1000 / 30) return;
      const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.25) : 1 / 30;
      previousTime = now;
      elapsed += delta;
      pointer.strength += (pointer.target - pointer.strength) * (1 - Math.exp(-7 * delta));
      draw();
    }

    function stop() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = undefined;
      previousTime = 0;
    }
    function start() {
      if (!inView || document.hidden || !pageActive) return;
      if (window.siteMotion.stopped) {
        pointer.strength = 0;
        elapsed = 0;
        draw();
      } else if (!frame) {
        frame = window.requestAnimationFrame(animate);
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
      else stop();
    }, { rootMargin: "200px" });
    observer.observe(canvas);
    window.addEventListener('pagehide', () => { pageActive = false; stop(); });
    window.addEventListener('pageshow', () => { pageActive = true; start(); });
    window.addEventListener("resize", () => {
      if (inView) draw();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });
    window.siteMotion.subscribe(() => {
      stop();
      releasePointer();
      start();
    });
  });
})();

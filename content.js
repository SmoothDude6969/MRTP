(function () {
  // Add pixel font
  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);

  // Load html2canvas for capturing the overlay
  const html2canvasScript = document.createElement('script');
  html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  html2canvasScript.onload = () => console.log("html2canvas loaded");
  html2canvasScript.onerror = () => console.error("html2canvas failed to load");
  document.head.appendChild(html2canvasScript);

  // Create container for the sphere and text
  const container = document.createElement('div');
  container.id = 'rainbow-sphere-container';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.zIndex = '1000000';
  container.style.pointerEvents = 'none';

  // Add HTML for background, title, credits, and canvases
  container.innerHTML = `
    <div id="full-background" style="
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: black;
      z-index: 999999;
    "></div>
    <div id="rainbow-title" style="
      position: absolute;
      top: 20%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: black;
      font-family: 'Press Start 2P', cursive;
      font-size: 1.5em;
      text-align: center;
      z-index: 1000002;
      text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
      cursor: pointer;
      animation: wobble 2s ease-in-out infinite;
      transition: transform 0.3s ease;
      pointer-events: auto;
    ">Rainbow Client</div>
    <div id="rainbow-credits" style="
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: black;
      font-family: 'Press Start 2P', cursive;
      font-size: 0.9em;
      text-align: center;
      z-index: 1000002;
      text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
      pointer-events: none;
    ">Made by SmoothDude, Mystic, Jouda</div>
    <div id="sphere-background" style="
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 300px;
      height: 300px;
      background: black;
      border-radius: 50%;
      z-index: 1000000;
    "></div>
    <canvas id="rainbow-canvas" style="
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1000001;
    "></canvas>
    <canvas id="transition-canvas" style="
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1000003;
      display: none;
      image-rendering: pixelated;
    "></canvas>
  `;

  // Add CSS for wobble and hover effects
  const style = document.createElement('style');
  style.textContent = `
    @keyframes wobble {
      0% { transform: translate(-50%, -50%) rotate(0deg); }
      25% { transform: translate(-50%, -50%) rotate(2deg); }
      75% { transform: translate(-50%, -50%) rotate(-2deg); }
      100% { transform: translate(-50%, -50%) rotate(0deg); }
    }
    #rainbow-title:hover {
      transform: translate(-50%, -50%) scale(1.2);
    }
    .hidden {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(container);

  // WebGL setup for sphere
  const canvas = document.getElementById('rainbow-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const gl = canvas.getContext('webgl');

  if (!gl) {
    console.error("WebGL is not supported or failed to initialize.");
    container.innerHTML += '<p style="color: white; text-align: center; z-index: 1000002;">WebGL is not supported in your browser.</p>';
    return;
  }

  // Sphere geometry (oblate, 64 segments)
  const vertices = [];
  const normals = [];
  const indices = [];
  const segments = 64;
  const yScale = 0.8;
  for (let i = 0; i <= segments; i++) {
    const theta = (i * Math.PI) / segments;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    for (let j = 0; j <= segments; j++) {
      const phi = (j * 2 * Math.PI) / segments;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const x = cosPhi * sinTheta;
      const y = cosTheta * yScale;
      const z = sinPhi * sinTheta;
      vertices.push(x, y, z);
      normals.push(x, y / yScale, z);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const first = i * (segments + 1) + j;
      const second = first + segments + 1;
      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  // Vertex shader for sphere
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vNormal = aNormal;
      vPosition = (uModelViewMatrix * vec4(aPosition, 1.0)).xyz;
      gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
    }
  `;

  // Fragment shader for realistic rainbow glow
  const fragmentShaderSource = `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float uTime;
    uniform float uGlowIntensity;
    uniform vec3 uLightDirection;
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 lightDir = normalize(uLightDirection);
      float diffuse = max(dot(normal, lightDir), 0.0);
      vec3 baseColor = vec3(
        sin(vPosition.x + uTime) * 0.4 + 0.4,
        sin(vPosition.y + uTime + 2.0) * 0.4 + 0.4,
        sin(vPosition.z + uTime + 4.0) * 0.4 + 0.4
      );
      vec3 color = baseColor * (0.5 + 0.5 * diffuse);
      float intensity = pow(0.6 - dot(normal, normalize(-vPosition)), 2.0) * uGlowIntensity;
      gl_FragColor = vec4(color * intensity, 1.0);
    }
  `;

  // Fragment shader for bloom
  const bloomFragmentShaderSource = `
    precision mediump float;
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform float uBloomRadius;
    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;
      vec4 sum = vec4(0.0);
      float scale = uBloomRadius / uResolution.x;
      for (int x = -4; x <= 4; x++) {
        for (int y = -4; y <= 4; y++) {
          vec2 offset = vec2(float(x), float(y)) * scale;
          sum += texture2D(uTexture, uv + offset) * 0.05;
        }
      }
      gl_FragColor = sum;
    }
  `;

  // Compile shaders
  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const bloomFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, bloomFragmentShaderSource);
  if (!vertexShader || !fragmentShader || !bloomFragmentShader) return;

  // Create main program
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return;
  }

  // Create bloom program
  const bloomProgram = gl.createProgram();
  gl.attachShader(bloomProgram, vertexShader);
  gl.attachShader(bloomProgram, bloomFragmentShader);
  gl.linkProgram(bloomProgram);
  if (!gl.getProgramParameter(bloomProgram, gl.LINK_STATUS)) {
    console.error('Bloom program link error:', gl.getProgramInfoLog(bloomProgram));
    return;
  }

  // Buffers for sphere
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  // Framebuffer for bloom
  const renderTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, renderTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, renderTexture, 0);

  // Quad for bloom
  const quadVertices = new Float32Array([
    -1, -1,  0, 0,
     1, -1,  1, 0,
     1,  1,  1, 1,
    -1,  1,  0, 1
  ]);
  const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
  const quadIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW);

  // Attributes and uniforms for sphere
  const aPosition = gl.getAttribLocation(program, 'aPosition');
  const aNormal = gl.getAttribLocation(program, 'aNormal');
  const uModelViewMatrix = gl.getUniformLocation(program, 'uModelViewMatrix');
  const uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uGlowIntensity = gl.getUniformLocation(program, 'uGlowIntensity');
  const uLightDirection = gl.getUniformLocation(program, 'uLightDirection');

  const aPositionBloom = gl.getAttribLocation(bloomProgram, 'aPosition');
  const uTexture = gl.getUniformLocation(bloomProgram, 'uTexture');
  const uResolution = gl.getUniformLocation(bloomProgram, 'uResolution');
  const uBloomRadius = gl.getUniformLocation(bloomProgram, 'uBloomRadius');

  // Matrices
  function createMatrix() {
    const matrix = new Float32Array(16);
    matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;
    return matrix;
  }

  function perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
  }

  function translate(out, x, y, z) {
    out[12] = x;
    out[13] = y;
    out[14] = z;
    return out;
  }

  function rotateY(out, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    out[0] = c;
    out[2] = -s;
    out[8] = s;
    out[10] = c;
    return out;
  }

  const projectionMatrix = perspective(createMatrix(), 75 * Math.PI / 180, window.innerWidth / window.innerHeight, 0.1, 1000);
  const modelViewMatrix = translate(createMatrix(), 0, 0, -3);

  // Animation loop for sphere
  let time = 0;
  function animateSphere() {
    if (container.classList.contains('hidden')) return;
    requestAnimationFrame(animateSphere);
    time += 0.01;

    // Render sphere to framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.uniformMatrix4fv(uModelViewMatrix, false, rotateY(createMatrix(), time * 0.01));
    gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);
    gl.uniform1f(uTime, time);
    gl.uniform1f(uGlowIntensity, 1.5);
    gl.uniform3f(uLightDirection, 1.0, 1.0, 1.0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    // Render bloom pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(bloomProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(aPositionBloom);
    gl.vertexAttribPointer(aPositionBloom, 2, gl.FLOAT, false, 16, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIndexBuffer);
    gl.uniform1i(uTexture, 0);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uBloomRadius, 2.0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, renderTexture);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    // Render sphere again for crisp edges
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.uniformMatrix4fv(uModelViewMatrix, false, rotateY(createMatrix(), time * 0.01));
    gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);
    gl.uniform1f(uTime, time);
    gl.uniform1f(uGlowIntensity, 1.5);
    gl.uniform3f(uLightDirection, 1.0, 1.0, 1.0);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }
  animateSphere();

  // Transition animation using CSS
  function startTransition() {
    const transitionCanvas = document.getElementById('transition-canvas');
    transitionCanvas.style.display = 'block';
    if (typeof html2canvas === 'undefined') {
      console.error("html2canvas not loaded, falling back to fade-out.");
      container.style.transition = 'opacity 1s';
      container.style.opacity = '0';
      setTimeout(() => {
        container.classList.add('hidden');
        container.style.opacity = '1';
      }, 1000);
      return;
    }

    console.log("Starting pixelation transition");
    html2canvas(container, { backgroundColor: null, scale: 1 }).then(canvasSnapshot => {
      const ctx = transitionCanvas.getContext('2d');
      transitionCanvas.width = window.innerWidth;
      transitionCanvas.height = window.innerHeight;
      ctx.imageSmoothingEnabled = false;
      let progress = 0;
      const duration = 1000;

      function animateTransition() {
        progress += 16 / duration;
        if (progress >= 1) {
          transitionCanvas.style.display = 'none';
          container.classList.add('hidden');
          container.style.opacity = '1';
          console.log("Transition completed");
          return;
        }

        const scale = 1 - progress * 0.9;
        const opacity = 1 - progress;
        transitionCanvas.style.opacity = opacity;
        ctx.clearRect(0, 0, transitionCanvas.width, transitionCanvas.height);
        ctx.save();
        ctx.scale(scale, scale);
        ctx.drawImage(canvasSnapshot, 0, 0, transitionCanvas.width / scale, transitionCanvas.height / scale);
        ctx.restore();
        requestAnimationFrame(animateTransition);
      }

      // Keep container visible during transition
      animateTransition();
    }).catch(err => {
      console.error("html2canvas error:", err);
      container.style.transition = 'opacity 1s';
      container.style.opacity = '0';
      setTimeout(() => {
        container.classList.add('hidden');
        container.style.opacity = '1';
      }, 1000);
    });
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    perspective(projectionMatrix, 75 * Math.PI / 180, window.innerWidth / window.innerHeight, 0.1, 1000);
    gl.bindTexture(gl.TEXTURE_2D, renderTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  });

  // Click event to start transition
  const title = document.getElementById('rainbow-title');
  title.addEventListener('click', startTransition);

  // Log to confirm loading
  console.log("Extension loaded");
})();

/* ============================================================
   Hero particle orb — interactive Three.js visual.
   Lazy-loaded, reduced-motion aware, pauses off-screen / when hidden.
   ============================================================ */
(() => {
  "use strict";
  const canvas = document.getElementById("hero-orb");
  if (!canvas) return;

  // Keep it calm + light for reduced-motion users (don't even load three.js).
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    canvas.style.display = "none";
    return;
  }

  let booted = false;
  const boot = () => {
    if (booted) return;
    booted = true;
    init().catch((e) => console.warn("[orb] init failed:", e));
  };

  // Defer until the canvas is near the viewport.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            boot();
            io.disconnect();
          }
        }),
      { rootMargin: "300px" }
    );
    io.observe(canvas);
  } else {
    boot();
  }

  async function init() {
    let THREE;
    try {
      THREE = await import("three");
    } catch (e) {
      console.warn("[orb] three.js failed to load:", e);
      canvas.style.display = "none";
      return;
    }

    const isMobile = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const sizeOf = () => {
      const w = canvas.clientWidth || 400;
      const h = canvas.clientHeight || w;
      return { w, h };
    };
    let { w, h } = sizeOf();
    renderer.setSize(w, h, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.z = 3.4;

    // Even point distribution on a sphere (Fibonacci).
    const COUNT = isMobile ? 3500 : 8500;
    const positions = new Float32Array(COUNT * 3);
    const randoms = new Float32Array(COUNT);
    const golden = Math.PI * (1 + Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
      const t = i / (COUNT - 1);
      const inc = Math.acos(1 - 2 * t);
      const az = golden * i;
      positions[i * 3] = Math.sin(inc) * Math.cos(az);
      positions[i * 3 + 1] = Math.sin(inc) * Math.sin(az);
      positions[i * 3 + 2] = Math.cos(inc);
      randoms[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: isMobile ? 24 : 30 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uAmp: { value: 0.34 },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uCamZ: { value: camera.position.z },
        uColorA: { value: new THREE.Color("#6ea8fe") },
        uColorB: { value: new THREE.Color("#cfe6ff") },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uSize;
        uniform float uPixelRatio;
        uniform float uAmp;
        uniform vec2 uPointer;
        uniform float uCamZ;
        attribute float aRandom;
        varying float vDisp;

        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
        float snoise(vec3 v){
          const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
          vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
          vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
          vec3 x1=x0-i1+1.0*C.xxx;vec3 x2=x0-i2+2.0*C.xxx;vec3 x3=x0-1.0+3.0*C.xxx;
          i=mod(i,289.0);
          vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
          float n_=1.0/7.0;vec3 ns=n_*D.wyz-D.xzx;
          vec4 j=p-49.0*floor(p*ns.z*ns.z);
          vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
          vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
          vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
          vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
          vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
          vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
          vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
          p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
          vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
          return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
        }

        void main(){
          vec3 p = position;
          float n1 = snoise(p * 1.6 + vec3(0.0, 0.0, uTime * 0.22));
          float n2 = snoise(p * 3.2 - vec3(uTime * 0.16));
          float disp = uAmp * (0.65 * n1 + 0.35 * n2);
          vec3 displaced = p * (1.0 + disp);
          vec4 mv = modelViewMatrix * vec4(displaced, 1.0);

          // Cursor interaction: points near the pointer bulge toward the camera.
          vec3 centerV = vec3(0.0, 0.0, -uCamZ);
          vec3 pointerV = vec3(uPointer.x, uPointer.y, -(uCamZ - 1.0));
          float infl = smoothstep(1.1, 0.0, distance(mv.xyz, pointerV));
          mv.xyz += normalize(mv.xyz - centerV) * infl * 0.5;

          vDisp = disp + infl * 0.6;
          gl_Position = projectionMatrix * mv;
          float size = uSize * (0.55 + 0.9 * aRandom) * (1.0 + infl * 0.8);
          gl_PointSize = size * uPixelRatio * (1.0 / -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vDisp;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d);
          vec3 col = mix(uColorA, uColorB, smoothstep(-0.25, 0.4, vDisp));
          gl_FragColor = vec4(col, alpha * 0.9);
        }
      `,
    });

    const orb = new THREE.Points(geometry, material);
    scene.add(orb);

    // --- Pointer: window-relative tilt + canvas-relative bulge ---
    const tilt = { x: 0, y: 0 };
    const pointerTarget = new THREE.Vector2(0, 0);
    const onPointer = (clientX, clientY) => {
      tilt.x = (clientX / window.innerWidth) * 2 - 1;
      tilt.y = (clientY / window.innerHeight) * 2 - 1;
      const r = canvas.getBoundingClientRect();
      const ndcX = ((clientX - r.left) / r.width) * 2 - 1;
      const ndcY = ((clientY - r.top) / r.height) * 2 - 1;
      const planeZ = camera.position.z - 1.0;
      const hh = Math.tan(((camera.fov * Math.PI) / 180) / 2) * planeZ;
      pointerTarget.x = ndcX * hh * camera.aspect;
      pointerTarget.y = -ndcY * hh;
    };
    window.addEventListener("pointermove", (e) => onPointer(e.clientX, e.clientY), {
      passive: true,
    });

    // --- Resize ---
    const ro = new ResizeObserver(() => {
      const s = sizeOf();
      w = s.w;
      h = s.h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    });
    ro.observe(canvas);

    // --- Pause when off-screen or tab hidden ---
    const clock = new THREE.Clock();
    let onScreen = true;
    let active = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (entries) => entries.forEach((e) => (onScreen = e.isIntersecting)),
        { threshold: 0 }
      ).observe(canvas);
    }
    document.addEventListener("visibilitychange", () => {
      active = !document.hidden;
      if (active) clock.start();
    });

    function frame() {
      requestAnimationFrame(frame);
      if (!onScreen || !active) return;
      material.uniforms.uTime.value = clock.getElapsedTime();
      const up = material.uniforms.uPointer.value;
      up.x += (pointerTarget.x - up.x) * 0.1;
      up.y += (pointerTarget.y - up.y) * 0.1;
      orb.rotation.y += 0.0016;
      orb.rotation.x += (tilt.y * 0.3 - orb.rotation.x) * 0.04;
      orb.rotation.z += (tilt.x * 0.18 - orb.rotation.z) * 0.04;
      renderer.render(scene, camera);
    }
    frame();
  }
})();

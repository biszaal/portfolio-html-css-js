// curl-flow.js — drop-in animated background (2D canvas, zero deps)
// =================================================================
// Curl-of-fbm-noise particle flow with trail fade + additive blend,
// plus cursor interaction (a swirling vortex that follows the pointer).
//
//   const flow = new CurlFlow(canvas, { inkA:'#6ea8fe', ... });
//   flow.stop() / flow.start() / flow.update({ speed: 3 }) / flow.destroy()
//
(function (root) {
  "use strict";

  function CurlFlow(canvas, opts) {
    if (!(this instanceof CurlFlow)) return new CurlFlow(canvas, opts);
    if (!canvas || canvas.tagName !== "CANVAS") {
      throw new Error("CurlFlow: first arg must be a <canvas> element");
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = Object.assign(
      {
        bg: "#0a0b0d",
        inkA: "#6ea8fe",
        inkB: "#cfe6ff",
        inkC: "#8be0c0",
        particles: 1800,
        speed: 1.8,
        noiseScale: 0.0035,
        timeScale: 0.06,
        fadeAlpha: 0.12,
        blend: "lighter", // "lighter" glows on dark; "source-over" reads on light
        // cursor interaction
        pointer: true,
        pointerRadius: 240,
        pointerStrength: 4.2,
        pointerSwirl: 0.28,
      },
      opts || {}
    );

    this._t = 0;
    this._ps = [];
    this._raf = null;
    this._running = false;
    this._mx = -9999;
    this._my = -9999;
    this._mActive = false;

    this._onResize = this._onResize.bind(this);
    this._tick = this._tick.bind(this);
    this._onPointer = this._onPointer.bind(this);
    this._onLeave = this._onLeave.bind(this);

    this._setupCanvas();
    this._seedParticles();
    if (this.opts.pointer) {
      window.addEventListener("pointermove", this._onPointer, { passive: true });
      document.addEventListener("pointerleave", this._onLeave);
    }
    this.start();
  }

  CurlFlow.prototype._setupCanvas = function () {
    this._DPR = Math.min(window.devicePixelRatio || 1, 2);
    this._onResize();
    this._ro = new ResizeObserver(this._onResize);
    this._ro.observe(this.canvas);
  };

  CurlFlow.prototype._onResize = function () {
    var rect = this.canvas.getBoundingClientRect();
    this._rect = rect;
    this._W = rect.width;
    this._H = rect.height;
    this.canvas.width = this._W * this._DPR;
    this.canvas.height = this._H * this._DPR;
    this.ctx.setTransform(this._DPR, 0, 0, this._DPR, 0, 0);
    this.ctx.fillStyle = this.opts.bg;
    this.ctx.fillRect(0, 0, this._W, this._H);
  };

  CurlFlow.prototype._onPointer = function (e) {
    var rect = this.canvas.getBoundingClientRect();
    this._mx = e.clientX - rect.left;
    this._my = e.clientY - rect.top;
    this._mActive =
      this._mx >= -60 && this._mx <= this._W + 60 && this._my >= -60 && this._my <= this._H + 60;
  };

  CurlFlow.prototype._onLeave = function () {
    this._mActive = false;
  };

  CurlFlow.prototype._seedParticles = function () {
    var ps = (this._ps = []);
    for (var i = 0; i < this.opts.particles; i++) {
      var p = {};
      this._reseed(p);
      p.life = Math.random() * p.maxLife;
      ps.push(p);
    }
  };

  CurlFlow.prototype._reseed = function (p) {
    var inks = [this.opts.inkA, this.opts.inkB, this.opts.inkC];
    p.x = Math.random() * this._W;
    p.y = Math.random() * this._H;
    p.life = 0;
    p.maxLife = 80 + Math.random() * 200;
    p.size = Math.random() < 0.85 ? 0.7 : 1.4;
    // ~82% primary ink + chromatic sparkle — premium, not rainbow-noisy.
    p.ink = Math.random() < 0.82 ? inks[0] : inks[1 + (Math.random() < 0.5 ? 0 : 1)];
  };

  // Hash + smooth 2D value noise -> fbm -> curl (divergence-free field)
  function hash(x, y) {
    var h = (x * 374761393 + y * 668265263) ^ 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = (h ^ (h >>> 16)) >>> 0;
    return (h / 4294967295) * 2 - 1;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  function noise2(x, y) {
    var xi = Math.floor(x),
      yi = Math.floor(y);
    var xf = x - xi,
      yf = y - yi;
    var u = smooth(xf),
      v = smooth(yf);
    var a = hash(xi, yi),
      b = hash(xi + 1, yi);
    var c = hash(xi, yi + 1),
      d = hash(xi + 1, yi + 1);
    var ab = a + (b - a) * u;
    var cd = c + (d - c) * u;
    return ab + (cd - ab) * v;
  }
  function fbm(x, y) {
    var v = 0,
      a = 1,
      f = 1,
      n = 0;
    for (var i = 0; i < 3; i++) {
      v += a * noise2(x * f, y * f);
      n += a;
      a *= 0.55;
      f *= 2.0;
    }
    return v / n;
  }
  var EPS = 0.01;
  function curl(x, y) {
    var n1 = fbm(x, y + EPS),
      n2 = fbm(x, y - EPS);
    var n3 = fbm(x + EPS, y),
      n4 = fbm(x - EPS, y);
    return [(n1 - n2) / (2 * EPS), -(n3 - n4) / (2 * EPS)];
  }

  CurlFlow.prototype._tick = function () {
    if (!this._running) return;
    var ctx = this.ctx,
      W = this._W,
      H = this._H,
      o = this.opts;

    ctx.globalAlpha = o.fadeAlpha;
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = o.blend;

    this._t += 1;
    var tz = this._t * o.timeScale * o.noiseScale * 8;
    var pr2 = o.pointerRadius * o.pointerRadius;

    var ps = this._ps;
    for (var i = 0, n = ps.length; i < n; i++) {
      var p = ps[i];
      var v = curl(p.x * o.noiseScale + tz, p.y * o.noiseScale - tz * 0.6);
      p.x += v[0] * o.speed;
      p.y += v[1] * o.speed;

      // Cursor vortex: swirl tangentially + a slight outward push near the pointer.
      if (o.pointer && this._mActive) {
        var dx = p.x - this._mx,
          dy = p.y - this._my;
        var d2 = dx * dx + dy * dy;
        if (d2 < pr2) {
          var dist = Math.sqrt(d2) + 0.0001;
          var fall = 1 - dist / o.pointerRadius;
          var nx = dx / dist,
            ny = dy / dist;
          // push particles AWAY from the cursor (repel) + a touch of swirl.
          // fall^2 makes the push ramp up sharply close to the pointer.
          var push = fall * fall * o.pointerStrength;
          p.x += nx * push + -ny * fall * o.pointerSwirl * o.pointerStrength;
          p.y += ny * push + nx * fall * o.pointerSwirl * o.pointerStrength;
        }
      }

      p.life++;
      if (p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10 || p.life > p.maxLife) {
        this._reseed(p);
        continue;
      }
      var fade = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.ink;
      ctx.globalAlpha = Math.min(1, fade * 1.4) * 0.85;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    this._raf = requestAnimationFrame(this._tick);
  };

  CurlFlow.prototype.start = function () {
    if (this._running) return;
    this._running = true;
    this._raf = requestAnimationFrame(this._tick);
  };
  CurlFlow.prototype.stop = function () {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  };
  CurlFlow.prototype.update = function (opts) {
    Object.assign(this.opts, opts || {});
    if (opts && opts.particles != null && opts.particles !== this._ps.length) {
      this._seedParticles();
    }
  };
  CurlFlow.prototype.destroy = function () {
    this.stop();
    if (this._ro) this._ro.disconnect();
    window.removeEventListener("pointermove", this._onPointer);
    document.removeEventListener("pointerleave", this._onLeave);
    this.ctx.clearRect(0, 0, this._W, this._H);
  };

  root.CurlFlow = CurlFlow;
})(typeof window !== "undefined" ? window : this);

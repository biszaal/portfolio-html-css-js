/* ============================================================
   Motion layer — smooth scroll (Lenis), scroll choreography (GSAP),
   custom cursor + magnetic hover.
   Lazy-loads libs only for motion-capable sessions. Degrades to the
   plain (already-working) site if disabled or if a CDN fails.
   ============================================================ */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return; // native scroll, no cursor — content is visible (no .anim)

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("failed to load " + src));
      document.head.appendChild(s);
    });

  const revealFallback = () => {
    // If motion can't run, make sure nothing stays hidden.
    document.documentElement.classList.remove("anim");
    document
      .querySelectorAll(".hero__title .line > span")
      .forEach((s) => (s.style.transform = "none"));
  };

  // Custom cursor + magnetic hover — true mouse devices only (never touch).
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) initCursor();

  bootScroll();

  /* ---------------- Custom cursor + magnetic ---------------- */
  function initCursor() {
    const cursor = document.querySelector(".cursor");
    if (!cursor) return;
    document.body.classList.add("has-cursor");

    let mx = innerWidth / 2,
      my = innerHeight / 2,
      cx = mx,
      cy = my;

    window.addEventListener(
      "pointermove",
      (e) => {
        mx = e.clientX;
        my = e.clientY;
      },
      { passive: true }
    );

    const tick = () => {
      cx += (mx - cx) * 0.38;
      cy += (my - cy) * 0.38;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const hoverSel =
      "a, button, .btn, .cap, .project, .cert, .chip, .contact__item, [data-cursor]";
    document.querySelectorAll(hoverSel).forEach((el) => {
      el.addEventListener("pointerenter", () => cursor.classList.add("is-hover"));
      el.addEventListener("pointerleave", () => cursor.classList.remove("is-hover"));
    });

    // Fade out when the pointer leaves the window.
    document.addEventListener("pointerleave", () => {
      cursor.style.opacity = "0";
    });
    document.addEventListener("pointerenter", () => {
      cursor.style.opacity = "";
    });

    // Magnetic pull on buttons.
    document.querySelectorAll(".btn").forEach((btn) => {
      const strength = 0.3;
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * strength;
        const y = (e.clientY - r.top - r.height / 2) * strength;
        btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.transform = "";
      });
    });
  }

  /* ---------------- Smooth scroll + scroll choreography ---------------- */
  async function bootScroll() {
    let started = false;
    // Safety: if libs are slow/blocked, reveal the hero anyway.
    const failsafe = setTimeout(() => {
      if (!started) revealFallback();
    }, 2500);

    try {
      await loadScript("https://unpkg.com/lenis/dist/lenis.min.js");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js");
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"
      );
    } catch (e) {
      clearTimeout(failsafe);
      console.warn("[motion] scroll libs failed; using plain scroll.", e);
      revealFallback();
      return;
    }

    started = true;
    clearTimeout(failsafe);

    const { gsap, ScrollTrigger, Lenis } = window;
    gsap.registerPlugin(ScrollTrigger);

    // Lenis smooth scroll, driven by the GSAP ticker.
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);

    // Route in-page anchors through Lenis.
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id.length <= 1) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -80 });
      });
    });

    // Hero headline: line-by-line clip reveal on load.
    // (y:0 explicitly clears the px value GSAP parses from the CSS translateY(115%).)
    gsap.fromTo(
      ".hero__title .line > span",
      { yPercent: 115, y: 0 },
      { yPercent: 0, y: 0, duration: 1.05, ease: "expo.out", stagger: 0.12, delay: 0.15 }
    );

    // Subtle parallax on project media.
    gsap.utils.toArray(".project__media").forEach((media) => {
      gsap.fromTo(
        media,
        { yPercent: -6 },
        {
          yPercent: 6,
          ease: "none",
          scrollTrigger: { trigger: media, start: "top bottom", end: "bottom top", scrub: true },
        }
      );
    });

    window.addEventListener("load", () => ScrollTrigger.refresh());
  }
})();

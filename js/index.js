/* ============================================================
   Bishnu Aryal — Portfolio interactions
   Vanilla JS. transform/opacity only. Respects reduced-motion.
   ============================================================ */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const body = document.body;

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Mobile menu (morphing hamburger + overlay) ---------- */
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.getElementById("mobileMenu");

  const setMenu = (open) => {
    body.classList.toggle("menu-open", open);
    body.style.overflow = open ? "hidden" : "";
    if (toggle) toggle.setAttribute("aria-expanded", String(open));
  };

  if (toggle) toggle.addEventListener("click", () => setMenu(!body.classList.contains("menu-open")));
  if (menu) {
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("menu-open")) setMenu(false);
  });

  /* ---------- Scroll reveals ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  }

  /* ---------- Active nav link on scroll ---------- */
  const sections = document.querySelectorAll("main section[id]");
  const linkFor = (id) => document.querySelector('.nav__link[href="#' + id + '"]');
  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            document.querySelectorAll(".nav__link.is-active").forEach((l) => l.classList.remove("is-active"));
            const link = linkFor(entry.target.id);
            if (link) link.classList.add("is-active");
          }
        });
      },
      { threshold: 0.5, rootMargin: "-20% 0px -55% 0px" }
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* Magnetic buttons + custom cursor live in motion.js (motion-on sessions). */
})();

// Xellence AI — site scripts

// ---- Light / dark theme ----
// Follows the system setting until the visitor picks the other mode; that choice is remembered.
// Switching back to the mode the system already uses clears it, so the page follows the system again.
(function themeSwitch() {
  const KEY = 'xl-theme';
  const html = document.documentElement;
  const btn = document.querySelector('.theme-toggle');
  const meta = document.querySelector('meta[name="theme-color"]');
  const systemLight = window.matchMedia('(prefers-color-scheme: light)');
  const system = () => (systemLight.matches ? 'light' : 'dark');
  const saved = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };

  function apply(theme, animate) {
    if (animate) {
      html.classList.add('theme-switching');
      setTimeout(() => html.classList.remove('theme-switching'), 400);
    }
    html.setAttribute('data-theme', theme);
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f8fc' : '#070a16');
    if (btn) {
      const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
      btn.setAttribute('aria-label', label);
      btn.title = label;
    }
  }

  apply(html.getAttribute('data-theme') || saved() || system(), false);

  if (btn) {
    btn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      apply(next, true);
      try {
        if (next === system()) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, next);
      } catch (e) { /* storage blocked: the choice lasts for this page view */ }
    });
  }
  const onSystem = () => { const s = saved(); if (s !== 'light' && s !== 'dark') apply(system(), true); };
  if (systemLight.addEventListener) systemLight.addEventListener('change', onSystem);
})();

// ---- Mobile nav ----
const navToggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    })
  );
}

// ---- Rolling cards ('Sound familiar?', 'What we deliver'): one step every data-dwell seconds ----
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const ICONS = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>',
  pause:
    '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12" /></svg>' +
    '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5l10 6.5-10 6.5z" /></svg>',
};

function initCarousel(root) {
  const track = root.querySelector('.carousel-track');
  const cards = Array.from(track.children);
  const n = cards.length;
  const dwellMs = (parseFloat(root.dataset.dwell) || 6) * 1000;
  if (n < 2) return;

  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'carousel');
  root.style.setProperty('--dwell', `${dwellMs / 1000}s`);
  root.classList.add('is-ready');

  // Copies after the originals make the loop seamless; hidden from screen readers and keyboard focus.
  cards.forEach((c, i) => {
    c.setAttribute('role', 'group');
    c.setAttribute('aria-roledescription', 'slide');
    c.setAttribute('aria-label', `${i + 1} of ${n}`);
  });
  cards.forEach((c) => {
    const k = c.cloneNode(true);
    k.setAttribute('aria-hidden', 'true');
    k.inert = true;
    track.appendChild(k);
  });

  // Controls
  const controls = document.createElement('div');
  controls.className = 'carousel-controls';
  const dotsBox = document.createElement('div');
  dotsBox.className = 'carousel-dots';
  dotsBox.setAttribute('role', 'group');
  dotsBox.setAttribute('aria-label', 'Choose a card');
  const buttons = document.createElement('div');
  buttons.className = 'carousel-buttons';
  const mkBtn = (act, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'carousel-btn';
    b.setAttribute('aria-label', label);
    b.innerHTML = ICONS[act];
    buttons.appendChild(b);
    return b;
  };
  const prevBtn = mkBtn('prev', 'Previous card');
  const pauseBtn = mkBtn('pause', 'Pause rotation');
  const nextBtn = mkBtn('next', 'Next card');
  controls.append(dotsBox, buttons);
  root.appendChild(controls);
  const dots = cards.map((_, i) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'carousel-dot';
    d.setAttribute('aria-label', `Show card ${i + 1}`);
    d.addEventListener('click', () => go(i));
    dotsBox.appendChild(d);
    return d;
  });

  let index = 0;
  let stopped = reduceMotion.matches; // pause button, or reduced-motion settings
  const holds = new Set(); // temporary pauses: mouse over, keyboard focus, off screen, hidden tab

  function place(animate) {
    track.classList.toggle('no-anim', !animate);
    const x = track.children[index].offsetLeft - track.children[0].offsetLeft; // relative to the first card
    track.style.transform = `translateX(${-x}px)`;
    if (!animate) void track.offsetWidth; // apply now so the next move animates
  }

  // Countdown runs in JS (reliable); the dot's progress fill is a CSS animation paused in step with it.
  let remaining = dwellMs;
  let startedAt = 0;
  let timer = null;
  const running = () => !stopped && holds.size === 0;
  function startTimer() {
    clearTimeout(timer);
    timer = null;
    if (!running()) return;
    startedAt = performance.now();
    timer = setTimeout(() => { timer = null; go(index + 1); }, remaining);
  }
  function pauseTimer() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    remaining = Math.max(0, remaining - (performance.now() - startedAt));
  }

  function mark() {
    const cur = index % n;
    dots.forEach((d) => d.removeAttribute('aria-current'));
    void dotsBox.offsetWidth; // restart the fill animation from zero
    dots[cur].setAttribute('aria-current', 'true');
  }

  function go(i) {
    if (index >= n) { index -= n; i -= n; place(false); } // a previous move hasn't settled yet
    if (i < 0) { index = n; place(false); i = n - 1; } // step back through the copies
    index = i;
    place(true);
    mark();
    remaining = dwellMs;
    startTimer();
  }
  track.addEventListener('transitionend', (e) => {
    if (e.target === track && index >= n) { index -= n; place(false); }
  });

  function sync() {
    root.classList.toggle('is-auto', !stopped);
    root.classList.toggle('is-stopped', stopped);
    root.classList.toggle('is-paused', holds.size > 0);
    pauseBtn.setAttribute('aria-label', stopped ? 'Play rotation' : 'Pause rotation');
    track.setAttribute('aria-live', stopped ? 'polite' : 'off');
    if (running()) { if (!timer) startTimer(); } else pauseTimer();
  }
  const hold = (key, on) => {
    if (on) holds.add(key); else holds.delete(key);
    sync();
  };

  prevBtn.addEventListener('click', () => go((index % n) - 1));
  nextBtn.addEventListener('click', () => go(index + 1));
  pauseBtn.addEventListener('click', () => {
    stopped = !stopped;
    remaining = dwellMs;
    pauseTimer();
    mark();
    sync();
  });

  // Pause while a real mouse is over the cards. Touch taps also fire mouse events with no matching
  // "leave", which used to freeze the rotation on phones, so only mouse pointers count.
  root.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hold('hover', true); });
  root.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hold('hover', false); });
  // Pause for keyboard focus only. A mouse click leaves focus on the clicked button, which used to
  // stop the rotation until the visitor clicked somewhere else.
  root.addEventListener('focusin', (e) => hold('focus', e.target.matches(':focus-visible')));
  root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) hold('focus', false); });
  document.addEventListener('visibilitychange', () => hold('hidden', document.hidden));
  if ('IntersectionObserver' in window) {
    holds.add('offscreen'); // start counting once the cards are on screen
    new IntersectionObserver(([en]) => hold('offscreen', !en.isIntersecting), { threshold: 0.2 }).observe(root);
  }

  // Swipe on touch screens
  let x0 = null;
  track.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? index + 1 : (index % n) - 1);
  });

  window.addEventListener('resize', () => place(false));
  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener('change', (e) => { stopped = e.matches; remaining = dwellMs; mark(); sync(); });
  }
  place(false);
  mark();
  sync();
}
document.querySelectorAll('.carousel').forEach(initCarousel);

// ---- Reveal on scroll ----
const revealTargets = document.querySelectorAll(
  '.section-head, .carousel, .mult, .promise, .compare-card, .step, .faq, .meet-card, .pf-card'
);
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );
  revealTargets.forEach((el) => {
    el.classList.add('reveal');
    io.observe(el);
  });
}

// ---- Active nav link ----
const navLinks = Array.from(document.querySelectorAll('.site-nav a[href^="#"]:not(.nav-cta)'));
const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window && sections.length) {
  const navIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`));
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  sections.forEach((s) => navIo.observe(s));
}

// ---- Footer year ----
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// header: hairline once scrolled
const header = document.querySelector('header');
const onScroll = () => header?.classList.toggle('stuck', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// mobile menu
const menuBtn = document.querySelector('.menu-btn'), menu = document.getElementById('menu');
if (menuBtn && menu) {
  menuBtn.addEventListener('click', () => menuBtn.setAttribute('aria-expanded', menu.classList.toggle('open')));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
}

// reveal on scroll (short stagger inside a row of siblings)
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => {
  const sibs = [...(el.parentElement?.children ?? [])].filter(c => c.classList.contains('reveal'));
  el.style.setProperty('--d', Math.min(sibs.indexOf(el), 4) * 0.06 + 's');
  io.observe(el);
});

// count-up numbers when visible
const fmt = (n, el) => (el.dataset.prefix || '') + Math.round(n).toLocaleString('en-US') + (el.dataset.suffix || '');
const cio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  cio.unobserve(e.target);
  const el = e.target, end = +el.dataset.count;
  if (reduce) { el.textContent = fmt(end, el); return; }
  const t0 = performance.now();
  (function step(t) {
    const k = Math.min(1, (t - t0) / 1600);
    el.textContent = fmt(end * (1 - Math.pow(1 - k, 4)), el);
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}), { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

// pinned flow story: the step nearest the middle of the viewport lights up its part of the diagram
const story = document.querySelector('.story');
if (story) {
  const steps = [...story.querySelectorAll('.flow-steps > div')];
  steps[0]?.classList.add('on');
  const sio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const i = steps.indexOf(e.target);
    story.dataset.step = String(i + 1);
    steps.forEach((s, k) => s.classList.toggle('on', k <= i));
  }), { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(s => sio.observe(s));
}

// scroll progress bar
const bar = document.querySelector('.progress');
if (bar && !reduce) {
  let tick = false;
  const upd = () => { const h = document.documentElement; bar.style.transform = `scaleX(${h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)})`; tick = false; };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
  upd();
}

// SMIL packets: stop for reduced motion
if (reduce) document.querySelectorAll('svg').forEach(s => s.pauseAnimations?.());

/* Custom cursor: a small dot tracking the pointer + a smoothed trailing ring.
   Disabled on touch / coarse-pointer devices via CSS. */

(function () {
  const dot  = document.getElementById('cdot');
  const ring = document.getElementById('cring');
  if (!dot || !ring) return;

  let mx = 0, my = 0, rx = 0, ry = 0;

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
  });

  function raf() {
    rx += (mx - rx) * 0.1;
    ry += (my - ry) * 0.1;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    requestAnimationFrame(raf);
  }
  raf();

  // Bigger ring when hovering interactive things.
  const HOVER_SELECTOR = 'a, button, .work-card, .ai-card, .prompt-chip, input, [data-cursor="hover"]';
  document.querySelectorAll(HOVER_SELECTOR).forEach((el) => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
  });
})();

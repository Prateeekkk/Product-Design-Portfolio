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

  /* ---------- Dark-context cursor (footer) ----------
     The site footer is dark; the default black cursor disappears on it.
     We use elementFromPoint() — which respects the z-stacking order — so
     the cursor only goes white when the topmost element under the pointer
     is actually the footer. The previous bounding-box approach gave false
     positives because .site-footer is position:fixed at the viewport
     bottom but covered by .site (z-index: 2) until the user scrolls past
     it. */
  if (document.querySelector('.site-footer, [data-cursor-dark]')) {
    function checkDarkContext(e) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const onDark = !!(target && target.closest('.site-footer, [data-cursor-dark]'));
      if (onDark !== document.body.classList.contains('on-dark')) {
        document.body.classList.toggle('on-dark', onDark);
      }
    }
    document.addEventListener('mousemove', checkDarkContext, { passive: true });
  }
})();

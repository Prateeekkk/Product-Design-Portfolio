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
     We watch the cursor's position and toggle .on-dark on <body> when
     the pointer is inside the visible footer band (or any element flagged
     with [data-cursor-dark]). CSS inverts the dot + ring to white. */
  const darkBands = Array.from(document.querySelectorAll('[data-cursor-dark], .site-footer'));
  if (darkBands.length) {
    function checkDarkContext(e) {
      const x = e.clientX, y = e.clientY;
      let onDark = false;
      for (const band of darkBands) {
        const r = band.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          onDark = true; break;
        }
      }
      if (onDark !== document.body.classList.contains('on-dark')) {
        document.body.classList.toggle('on-dark', onDark);
      }
    }
    document.addEventListener('mousemove', checkDarkContext, { passive: true });
  }
})();

/* Main: shared init.
   - Hero arrow draw-in animation.
   - Reveal-on-scroll for any [.reveal] element. */

(function () {
  /* Arrow draw-in (hero annotations). */
  const arrows = [
    { id: 'ap1', delay: 780  },
    { id: 'ap2', delay: 900  },
    { id: 'ap3', delay: 920  },
    { id: 'ap4', delay: 1040 },
  ];
  arrows.forEach(({ id, delay }) => {
    const p = document.getElementById(id);
    if (!p) return;
    const len = p.getTotalLength();
    p.style.strokeDasharray  = len;
    p.style.strokeDashoffset = len;
    setTimeout(() => {
      p.style.transition = 'stroke-dashoffset .62s cubic-bezier(.4,0,.2,1)';
      p.style.strokeDashoffset = '0';
    }, delay);
  });

  /* Scroll reveal */
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });

  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  /* Smooth-scroll for in-page nav links */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#' || href.length < 2) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /*
    Static-then-animated impact strip.
    The marquee is held still on first paint so the four metrics read as
    a calm, intentional row. The body picks up `.has-scrolled` after the
    user has moved past the hero — at which point CSS turns the marquee
    on (see styles/impact.css).
  */
  const SCROLL_TRIGGER = 80;   // px past the top before the strip animates
  let scrollFlagged = false;
  function flagScroll() {
    if (scrollFlagged) return;
    if (window.scrollY > SCROLL_TRIGGER) {
      document.body.classList.add('has-scrolled');
      scrollFlagged = true;
      window.removeEventListener('scroll', flagScroll);
    }
  }
  window.addEventListener('scroll', flagScroll, { passive: true });
  flagScroll();

  /*
    Workflow cells — viewport-triggered activation.
    Each `.workflow-cell` gets an `.is-active` class the first time it
    crosses ~30% of the viewport. CSS animations are paused by default
    and only run once `.is-active` is set, so each demo plays its
    progressive reveal exactly once when the user actually sees it
    (instead of looping invisibly from page load). One-shot — observer
    detaches after activation.
  */
  if ('IntersectionObserver' in window) {
    const cells = document.querySelectorAll('.workflow-cell');
    if (cells.length) {
      const cellIO = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-active');
            cellIO.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3, rootMargin: '0px 0px -8% 0px' });
      cells.forEach((c) => cellIO.observe(c));
    }
  } else {
    // Fallback: just activate everything immediately if IO is unsupported.
    document.querySelectorAll('.workflow-cell').forEach((c) => c.classList.add('is-active'));
  }
})();

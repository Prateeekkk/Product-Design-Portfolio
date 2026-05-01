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
})();

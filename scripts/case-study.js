/* Case study scroll-spy — highlights the side-nav link whose target
   section is currently in the upper portion of the viewport.
   Uses IntersectionObserver against a band near the top of the screen,
   so the active link reflects what the reader is actually on. */

(function () {
  const navLinks = Array.from(document.querySelectorAll('.cs-sidenav-list a[href^="#"]'));
  if (!navLinks.length) return;

  const map = new Map();   // section element → corresponding nav link
  navLinks.forEach((link) => {
    const id = link.getAttribute('href').slice(1);
    const section = document.getElementById(id);
    if (section) map.set(section, link);
  });

  function setActive(link) {
    navLinks.forEach((l) => l.classList.toggle('is-active', l === link));
  }

  if (typeof IntersectionObserver === 'undefined') {
    // Fallback: scroll position based check.
    function fallback() {
      const y = window.scrollY + window.innerHeight * 0.3;
      let current = null;
      map.forEach((link, sec) => {
        if (sec.offsetTop <= y) current = link;
      });
      if (current) setActive(current);
    }
    window.addEventListener('scroll', fallback, { passive: true });
    fallback();
    return;
  }

  /* Active band: top 15% → 55% of viewport. The first section that is
     inside this band wins. If multiple intersect we pick the one whose
     boundingClientRect.top is the largest negative (i.e. closest to the
     top edge from above). */
  const io = new IntersectionObserver((entries) => {
    // Update intersection state on each section
    entries.forEach((entry) => {
      entry.target.dataset.csInView = entry.isIntersecting ? 'true' : 'false';
    });

    // Pick the topmost in-view section
    let best = null;
    let bestTop = -Infinity;
    map.forEach((link, sec) => {
      if (sec.dataset.csInView !== 'true') return;
      const t = sec.getBoundingClientRect().top;
      if (t <= window.innerHeight * 0.55 && t > bestTop) {
        bestTop = t;
        best = link;
      }
    });
    if (best) setActive(best);
  }, {
    rootMargin: '-15% 0px -45% 0px',
    threshold: 0,
  });

  map.forEach((_, sec) => io.observe(sec));

  // Smooth scroll on click + immediately mark active
  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.scrollY -
                (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
      window.scrollTo({ top: y, behavior: 'smooth' });
      history.replaceState(null, '', '#' + id);
      setActive(link);
    });
  });
})();

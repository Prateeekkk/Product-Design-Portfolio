/* Nav behaviours:
   - Mobile hamburger menu toggle.
   - Active link tracking based on which section is in view. */

(function () {
  // Mobile menu toggle
  const toggle = document.getElementById('navToggle');
  const menu   = document.getElementById('navMenu');
  if (toggle && menu) {
    const setOpen = (open) => {
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    // Close after picking a destination.
    menu.querySelectorAll('[data-nav-mobile-link]').forEach((a) => {
      a.addEventListener('click', () => setOpen(false));
    });
    // Esc closes the menu.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  // Active-section observer
  const links = document.querySelectorAll('.nav-links a[data-section]');
  const sections = document.querySelectorAll('section[id]');
  if (!('IntersectionObserver' in window) || !links.length || !sections.length) return;

  const linkBySection = {};
  links.forEach((a) => {
    linkBySection[a.dataset.section] = a;
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        links.forEach((a) => a.classList.remove('active'));
        const target = linkBySection[entry.target.id];
        if (target) target.classList.add('active');
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

  sections.forEach((s) => io.observe(s));
})();

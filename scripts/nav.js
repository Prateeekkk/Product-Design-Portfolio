/* Nav behaviours:
   - Hover label-swap on the "Talk to my AI" CTA.
   - Active link tracking based on which section is in view. */

(function () {
  const cta   = document.getElementById('navCta');
  const label = cta ? cta.querySelector('.nav-cta-label') : null;

  if (cta && label) {
    function swap(text) {
      label.style.opacity = '0';
      setTimeout(() => {
        label.textContent = text;
        label.style.opacity = '1';
      }, 140);
    }
    cta.addEventListener('mouseenter', () => swap('ask me anything ↗'));
    cta.addEventListener('mouseleave', () => swap('Talk to my AI'));
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

/*
  Scroll-linked scene controller + drag interactions.

  Engines:
  - registerScenes:   pinned scroll story (Work) — drives --intro on first
                      case + --reveal on every case via clip-path slider.
  - registerAssembly: scattered cards that fall in as you scroll (AI).
  - dragCards:        pointer drag on AI cards.
  - initExpStack:     click-nav + auto-preview on Experience stack.
  - parallaxPortrait: subtle scroll-driven tilt for the about portrait.
*/

(function () {
  const sceneRoots    = [];
  const assemblyRoots = [];

  /* ---------- Scenes (Work) — intro + clip-path reveal ---------- */
  function registerScenes(rootEl, sceneSelector) {
    if (!rootEl) return;
    const items = Array.from(rootEl.querySelectorAll(sceneSelector));
    if (!items.length) return;

    const hasIntro = rootEl.dataset.intro === 'true';

    Array.from(rootEl.querySelectorAll('[data-counter-total]')).forEach((el) => {
      el.textContent = String(items.length).padStart(2, '0');
    });

    Array.from(rootEl.querySelectorAll('[data-jump]')).forEach((btn, i) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const wrapHeight = rootEl.offsetHeight - window.innerHeight;
        const segments = items.length + (hasIntro ? 1 : 0);
        // With intro: case 0 fully arrives at seg=1, case i fully arrives at seg=i+1.
        // Land slightly past that boundary (1.05) for visual stability.
        // Without intro: land at midpoint of each case's segment.
        const target = hasIntro
          ? (i + 1.05) / segments
          : (i + 0.5) / segments;
        const y = rootEl.offsetTop + wrapHeight * target;
        window.scrollTo({ top: y, behavior: 'smooth' });
      });
    });

    sceneRoots.push({
      root: rootEl,
      items,
      hasIntro,
      progressBar:    rootEl.querySelector('[data-progress-bar]'),
      footBar:        rootEl.querySelector('[data-foot-bar]'),
      counterCurrent: Array.from(rootEl.querySelectorAll('[data-counter-current]')),
      jumpers:        Array.from(rootEl.querySelectorAll('[data-jump]')),
      lastIndex: -1,
    });
  }

  /* ---------- Assembly (AI Playground) ---------- */
  function registerAssembly(rootEl, cardSelector, opts) {
    if (!rootEl) return;
    const cards = Array.from(rootEl.querySelectorAll(cardSelector));
    if (!cards.length) return;

    assemblyRoots.push({
      root: rootEl,
      cards,
      stagger:  (opts && typeof opts.stagger === 'number') ? opts.stagger : 0.55,
      from: (opts && typeof opts.from === 'number') ? opts.from : 0.0,
      to:   (opts && typeof opts.to   === 'number') ? opts.to   : 0.85,
      progressBar: rootEl.querySelector('[data-progress-bar]'),
      footBar:     rootEl.querySelector('[data-foot-bar]'),
      counterCurrent: Array.from(rootEl.querySelectorAll('[data-counter-current]')),
      lastSettled: -1,
    });

    Array.from(rootEl.querySelectorAll('[data-counter-total]')).forEach((el) => {
      el.textContent = String(cards.length).padStart(2, '0');
    });
  }

  /* ---------- Drag for AI cards ----------
     Uses document-level pointermove/up during drag so the card follows the
     cursor even when it leaves the visible card bounds (e.g. clipped
     image areas, fast drag motions, overlapping cards). */
  function dragCards(cardSelector) {
    const cards = Array.from(document.querySelectorAll(cardSelector));
    cards.forEach((card) => {
      let dragging = false;
      let startX = 0, startY = 0;
      let baseDx = 0, baseDy = 0;
      let activePointerId = null;

      function onPointerMove(e) {
        if (!dragging || e.pointerId !== activePointerId) return;
        const dx = (e.clientX - startX) + baseDx;
        const dy = (e.clientY - startY) + baseDy;
        card.style.setProperty('--dx', dx + 'px');
        card.style.setProperty('--dy', dy + 'px');
      }
      function onPointerUp(e) {
        if (!dragging) return;
        if (e && e.pointerId !== undefined && e.pointerId !== activePointerId) return;
        dragging = false;
        activePointerId = null;
        card.classList.remove('is-dragging');
        card.style.setProperty('--lift', '0');
        document.removeEventListener('pointermove',   onPointerMove);
        document.removeEventListener('pointerup',     onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
      }
      function onPointerDown(e) {
        if (card.dataset.settled !== 'true') return;
        dragging = true;
        activePointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        baseDx = parseFloat(getComputedStyle(card).getPropertyValue('--dx')) || 0;
        baseDy = parseFloat(getComputedStyle(card).getPropertyValue('--dy')) || 0;
        card.classList.add('is-dragging');
        card.style.setProperty('--lift', '1');
        try { card.setPointerCapture(e.pointerId); } catch (_) {}
        // Track at document level so drag survives leaving card bounds.
        document.addEventListener('pointermove',   onPointerMove);
        document.addEventListener('pointerup',     onPointerUp);
        document.addEventListener('pointercancel', onPointerUp);
        e.preventDefault();
      }
      card.addEventListener('pointerdown', onPointerDown);
    });
  }

  /* ---------- Experience stack — click-nav + auto-preview ----------
     Linear (non-looping) navigation. `currentIdx` runs 0 → N-1 over the
     three cards in their natural order (Eximpe, Pazy, Mongoosh). Prev/next
     advance by ±1, clamped at the boundaries — and the prev button is
     disabled at the first card, next at the last. This makes the deck
     read as a finite carousel instead of an infinite cycle.

     Internally we still rebuild `order` so the front card is `currentIdx`
     and the rest sit behind it in stable left-to-right sequence — that
     way the deck-stacked desktop view continues to fan out correctly.
  */
  function initExpStack(stackSelector) {
    const stack = document.querySelector(stackSelector);
    if (!stack) return;
    const cards = Array.from(stack.querySelectorAll('.exp-card'));
    if (!cards.length) return;

    let order = cards.map((c, i) => i);   // [front, ...behind]
    let currentIdx = 0;                   // 0..N-1 (linear position)

    function applyOrder() {
      order.forEach((cardIndex, position) => {
        cards[cardIndex].style.setProperty('--i', String(position));
      });
      syncNav();
    }

    /* Place the active card at the front, others behind in original order. */
    function rebuildOrder() {
      order = [currentIdx];
      for (let i = 0; i < cards.length; i++) {
        if (i !== currentIdx) order.push(i);
      }
      applyOrder();
    }

    /* ── Visible nav: arrows + named dots ──
       The dots use original card indices (Eximpe=0, Pazy=1, Mongoosh=2)
       so jumping is direct and unambiguous. */
    const prevBtn = document.querySelector('[data-exp-prev]');
    const nextBtn = document.querySelector('[data-exp-next]');
    const dots    = Array.from(document.querySelectorAll('[data-exp-jump]'));

    function syncNav() {
      dots.forEach((dot) => {
        const target = parseInt(dot.dataset.expJump, 10);
        dot.classList.toggle('is-active', target === currentIdx);
      });
      if (prevBtn) {
        prevBtn.classList.toggle('is-disabled', currentIdx === 0);
        prevBtn.toggleAttribute('disabled', currentIdx === 0);
      }
      if (nextBtn) {
        nextBtn.classList.toggle('is-disabled', currentIdx === cards.length - 1);
        nextBtn.toggleAttribute('disabled', currentIdx === cards.length - 1);
      }
    }

    function setIdx(newIdx) {
      const clamped = Math.max(0, Math.min(cards.length - 1, newIdx));
      if (clamped === currentIdx) return;
      currentIdx = clamped;
      rebuildOrder();
    }

    if (prevBtn) prevBtn.addEventListener('click', () => setIdx(currentIdx - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => setIdx(currentIdx + 1));
    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const target = parseInt(dot.dataset.expJump, 10);
        if (!isNaN(target)) setIdx(target);
      });
    });

    /* ── Auto-preview on viewport entry ──
       The first time the stack scrolls into view, briefly add
       `.is-previewing` so all three cards fan open — then collapse back
       to the deck. Recruiters scanning fast see all three companies at a
       glance without needing to click through the deck nav. */
    if ('IntersectionObserver' in window) {
      let previewed = false;
      const PREVIEW_HOLD = 1300;   // ms cards stay spread
      const PREVIEW_DELAY = 320;   // ms after entry before opening
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !previewed) {
            previewed = true;
            setTimeout(() => {
              stack.classList.add('is-previewing');
              setTimeout(() => stack.classList.remove('is-previewing'), PREVIEW_HOLD);
            }, PREVIEW_DELAY);
            io.unobserve(stack);
          }
        });
      }, { threshold: 0.35 });
      io.observe(stack);
    }

    applyOrder();
  }

  /* ---------- Shine activation — start CSS loop on viewport entry ---------- */
  function activateShineOnEnter() {
    const portrait = document.querySelector('.about-portrait');
    if (!portrait) return;
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: just turn it on immediately.
      portrait.classList.add('is-shine-active');
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        portrait.classList.toggle('is-shine-active', entry.isIntersecting);
      });
    }, { threshold: 0.15 });   /* fire as soon as ~15% of the portrait is visible */
    io.observe(portrait);
  }

  /* ---------- Parallax portrait ---------- */
  function parallaxPortrait() {
    const target = document.querySelector('[data-parallax-tilt]');
    if (!target) return;
    function update() {
      const rect = target.getBoundingClientRect();
      const vh = window.innerHeight;
      const center = (rect.top + rect.height / 2 - vh / 2) / (vh / 2);
      const clamp = Math.max(-1, Math.min(1, center));
      target.style.setProperty('--tilt-x', (clamp * -7) + 'deg');
      target.style.setProperty('--tilt-y', (clamp * 5) + 'deg');
      target.style.setProperty('--tilt-z', (-Math.abs(clamp) * 14) + 'px');
      target.style.setProperty('--shine-y', (50 - clamp * 30) + '%');
      // Note: --shine-progress is no longer driven by scroll. The diagonal
      // specular sweep is now a CSS-only loop (see about.css). Scroll only
      // controls tilt + halo position.
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* ---------- Update loop ---------- */
  function clamp01(n) { return n < 0 ? 0 : (n > 1 ? 1 : n); }
  function ease(n) { return 1 - Math.pow(1 - n, 3); }

  function update() {
    const vh = window.innerHeight;

    /* Work scenes — intro + clip-path reveal */
    for (const sc of sceneRoots) {
      const rect = sc.root.getBoundingClientRect();
      const range = sc.root.offsetHeight - vh;
      if (range <= 0) continue;
      const scrolled = -rect.top;
      const progress = clamp01(scrolled / range);

      if (sc.progressBar) sc.progressBar.style.transform = `scaleX(${progress})`;
      if (sc.footBar)     sc.footBar.style.transform     = `scaleX(${progress})`;

      const total = sc.items.length;
      const segments = total + (sc.hasIntro ? 1 : 0);
      const seg = progress * segments;

      let active = 0;
      let introP = 1;
      let caseSub = 0;     // 0 → 1 within the active case's segment

      if (sc.hasIntro) {
        if (seg < 1) {
          // INTRO PHASE — case 0 is fully visible (reveal=1) and animates
          // from centered to grid layout via --intro (0 → 1).
          //
          // Sequence inside this segment:
          //   - 0    → DEAD : hold centered state (lets user see what's there)
          //   - DEAD → 1    : progressive shift from center to left grid slot
          //                   (right-side title/body/CTA fade in via --intro too)
          //
          // Reveal stays at 1 throughout — case 0's image is already shown.
          active = 0;
          const DEAD = 0.25;
          const adjusted = clamp01((seg - DEAD) / (1 - DEAD));
          introP = ease(adjusted);
          caseSub = 1;
        } else {
          // CASE TRANSITIONS — each post-intro segment wipe-reveals the NEXT
          // case (case 1 in seg 1→2, case 2 in seg 2→3, …).
          //
          // Case 0 stays revealed (loop logic: i < active → reveal = 1), so
          // it is NOT re-wiped after intro. This eliminates the prior glitch
          // where case 0 first slid left, then re-played its wipe animation.
          //
          // Clear separation enforced:
          //   - layout shift (intro) is fully done by seg = 1
          //   - image wipe transitions only START at seg = 1
          introP = 1;
          const caseSeg = seg - 1;
          active = Math.min(total - 1, Math.floor(caseSeg) + 1);
          caseSub = ease(clamp01(caseSeg - (active - 1)));
        }
      } else {
        active = Math.min(total - 1, Math.floor(seg));
        caseSub = ease(clamp01(seg - active));
      }

      // Apply --intro on the wrap + info of first case (and reset others to 1)
      sc.items.forEach((caseEl, i) => {
        const wrap = caseEl.querySelector('.work-visual-wrap');
        const info = caseEl.querySelector('.work-info');
        const introVal = (i === 0) ? introP : 1;
        if (wrap) wrap.style.setProperty('--intro', String(introVal));
        if (info) info.style.setProperty('--intro', String(introVal));

        // --reveal: 1 if past case (already revealed), caseSub if active, 0 if future
        const visual = caseEl.querySelector('.work-visual');
        if (visual) {
          let reveal;
          if (i < active)        reveal = 1;
          else if (i === active) reveal = caseSub;
          else                   reveal = 0;
          visual.style.setProperty('--reveal', reveal.toFixed(4));
        }
      });

      if (active !== sc.lastIndex) {
        sc.items.forEach((el, i) => {
          if (i < active)         el.dataset.state = 'past';
          else if (i === active)  el.dataset.state = 'current';
          else                    el.dataset.state = 'future';
        });
        sc.jumpers.forEach((btn, i) => btn.classList.toggle('is-active', i === active));
        const label = String(active + 1).padStart(2, '0');
        sc.counterCurrent.forEach((el) => { el.textContent = label; });
        sc.lastIndex = active;
      }
    }

    /* AI Playground assembly */
    for (const ar of assemblyRoots) {
      const rect = ar.root.getBoundingClientRect();
      const range = ar.root.offsetHeight - vh;
      if (range <= 0) continue;
      const scrolled = -rect.top;
      const progress = clamp01(scrolled / range);

      const span = Math.max(0.001, ar.to - ar.from);
      const local = clamp01((progress - ar.from) / span);

      if (ar.progressBar) ar.progressBar.style.transform = `scaleX(${local})`;
      if (ar.footBar)     ar.footBar.style.transform     = `scaleX(${local})`;

      const N = ar.cards.length;
      const overlap = ar.stagger;
      // slot = (1 - overlap) / N ensures the LAST card's end == 1.0 so it
      // actually reaches p=1 and gets data-settled="true" (required for drag).
      // Earlier (N-1) divisor left the last card permanently at p<1 → undraggable.
      const slot = (1 - overlap) / Math.max(1, N);
      const span_each = slot + overlap;

      let settled = 0;
      ar.cards.forEach((card, i) => {
        const start = i * slot;
        const end   = start + span_each;
        let p;
        if (local <= start)      p = 0;
        else if (local >= end)   p = 1;
        else                     p = ease((local - start) / (end - start));
        card.style.setProperty('--p', String(p));
        if (p >= 1) {
          settled += 1;
          if (card.dataset.settled !== 'true') card.dataset.settled = 'true';
        } else {
          if (card.dataset.settled === 'true') card.dataset.settled = 'false';
        }
      });

      if (settled !== ar.lastSettled) {
        const label = String(Math.min(N, settled)).padStart(2, '0');
        ar.counterCurrent.forEach((el) => { el.textContent = label; });
        ar.lastSettled = settled;
      }
    }
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  }

  registerScenes(document.querySelector('.work-pinned'), '.work-case');
  registerAssembly(document.querySelector('.ai-pinned'), '.ai-card', {
    stagger: 0.55,
    /* Tightened scroll mapping for direct-feeling responsiveness:
       - from = 0    : no entry delay; first card starts assembling immediately
       - to   = 0.92 : minimal exit dead zone; near-full section used by anim
       Combined with reduced section height (320vh) this removes the prior
       large dead-scroll zones at start and end. */
    from: 0,
    to:   0.92,
  });
  dragCards('.ai-card');
  initExpStack('.exp-stack');
  parallaxPortrait();
  activateShineOnEnter();

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
})();

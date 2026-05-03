/*
  Scroll-linked scene controller + drag interactions.

  Engines:
  - registerScenes:   pinned scroll story (Work) — drives --intro on first
                      case + --reveal on every case via clip-path slider.
  - registerAssembly: scattered cards that fall in as you scroll (AI).
  - dragCards:        pointer drag on AI cards.
  - dragExpStack:     drag-to-reorder on Experience stack.
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

  /* ---------- Drag for Experience stack — drag front card to reorder ---------- */
  function dragExpStack(stackSelector) {
    const stack = document.querySelector(stackSelector);
    if (!stack) return;
    const cards = Array.from(stack.querySelectorAll('.exp-card'));
    if (!cards.length) return;

    // Order array — current ordering of cards (front=0 → back=N-1)
    let order = cards.map((c, i) => i);
    function applyOrder() {
      order.forEach((cardIndex, position) => {
        cards[cardIndex].style.setProperty('--i', String(position));
      });
    }
    applyOrder();

    cards.forEach((card, cardIndex) => {
      let dragging = false;
      let sx = 0, sy = 0;
      let dx = 0, dy = 0;

      function down(e) {
        // Only the front card (position 0 in order) drags-to-reorder.
        const position = order.indexOf(cardIndex);
        if (position !== 0) return;
        dragging = true;
        sx = e.clientX; sy = e.clientY;
        card.classList.add('is-grabbing');
        card.style.setProperty('--drag-x', '0px');
        card.style.setProperty('--drag-y', '0px');
        card.style.setProperty('--grab-scale', '1.025');
        try { card.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
      }
      function move(e) {
        if (!dragging) return;
        // Prevent text selection / scroll while dragging in any direction
        e.preventDefault();
        dx = e.clientX - sx;
        dy = e.clientY - sy;
        card.style.setProperty('--drag-x', dx + 'px');
        card.style.setProperty('--drag-y', dy + 'px');
        // small rotational drift tied to horizontal motion for tactile feel
        const tilt = Math.max(-8, Math.min(8, dx * 0.04));
        card.style.setProperty('--drag-rot', tilt + 'deg');
      }
      function up() {
        if (!dragging) return;
        dragging = false;
        card.classList.remove('is-grabbing');
        card.style.setProperty('--grab-scale', '1');

        // Cycle to back if the card was dragged in ANY direction past the
        // threshold (left, right, or down). Small drags snap back.
        const THRESHOLD = 80;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));

        if (dist > THRESHOLD) {
          // Animated cycle — card flies further in the direction of drag,
          // tilts, then swaps to the back of the stack.
          card.classList.add('is-cycling');

          let exitX, exitY, exitRot;
          if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal-dominant drag → exit horizontally
            exitX = dx > 0
              ? Math.max(520, dx + 240)
              : Math.min(-520, dx - 240);
            exitY = dy * 0.4;
            exitRot = dx > 0 ? 14 : -14;
          } else {
            // Vertical-dominant drag → exit vertically
            exitY = dy > 0
              ? Math.max(360, dy + 200)
              : Math.min(-360, dy - 200);
            exitX = dx * 0.4;
            exitRot = dx > 0 ? 8 : -8;
          }

          card.style.setProperty('--drag-x',   exitX   + 'px');
          card.style.setProperty('--drag-y',   exitY   + 'px');
          card.style.setProperty('--drag-rot', exitRot + 'deg');

          setTimeout(() => {
            // Reset drag offsets BEFORE reordering so the back card lands
            // directly in its slot without a visual snap.
            card.style.setProperty('--drag-x', '0px');
            card.style.setProperty('--drag-y', '0px');
            card.style.setProperty('--drag-rot', '0deg');
            const front = order.shift();
            order.push(front);
            applyOrder();
            setTimeout(() => card.classList.remove('is-cycling'), 50);
          }, 320);
        } else {
          // Snap-back — smooth return to original position.
          card.style.setProperty('--drag-x', '0px');
          card.style.setProperty('--drag-y', '0px');
          card.style.setProperty('--drag-rot', '0deg');
        }
        dx = 0; dy = 0;
      }
      card.addEventListener('pointerdown',   down);
      card.addEventListener('pointermove',   move);
      card.addEventListener('pointerup',     up);
      card.addEventListener('pointercancel', up);
    });
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
  dragExpStack('.exp-stack');
  parallaxPortrait();
  activateShineOnEnter();

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
})();

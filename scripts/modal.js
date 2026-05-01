/* Talk-to-my-AI modal.
   - Opens from any [data-modal-open] trigger.
   - Closes on backdrop click, X button, Esc, or [data-modal-close].
   - "/" anywhere on the page focuses the input.
   - Demo responses keyed off prompt content (no real network calls). */

(function () {
  const modal    = document.getElementById('aiModal');
  const backdrop = document.getElementById('aiBackdrop');
  if (!modal || !backdrop) return;

  const body     = modal.querySelector('.modal-body');
  const input    = modal.querySelector('.composer input');
  const sendBtn  = modal.querySelector('.composer-btn.is-send');
  const micBtn   = modal.querySelector('.composer-btn.is-mic');
  const chips    = modal.querySelectorAll('.prompt-chip');

  function open() {
    modal.classList.add('is-open');
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input && input.focus(), 240);
  }

  function close() {
    modal.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // Triggers
  document.querySelectorAll('[data-modal-open="ai"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    });
  });

  // Closers
  backdrop.addEventListener('click', close);
  modal.querySelectorAll('[data-modal-close]').forEach((el) => {
    el.addEventListener('click', close);
  });

  document.addEventListener('keydown', (e) => {
    const isOpen = modal.classList.contains('is-open');
    if (e.key === 'Escape' && isOpen) close();
    // "/" focuses the input from anywhere, unless typing in another input
    if (e.key === '/' && !isOpen) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        open();
      }
    }
  });

  /* --- Demo response engine --- */

  const FALLBACK = [
    "Solid question. The honest answer: depends on the constraints, and I'd rather not pretend otherwise. Try a more specific prompt and I'll do better.",
    "I'm a static demo, but the real Prateek would say: less features, sharper hierarchy, and stop calling everything a 'platform'.",
    "Good one. In a real conversation we'd probably end up sketching this on a napkin. For now: ask me about his work, philosophy, or why he keeps redoing his portfolio."
  ];

  // Keyword-triggered canned answers. Order matters — first match wins.
  const RESPONSES = [
    {
      match: /work|projects?|case|portfolio/i,
      text: "Most recent: a trade-finance platform (Eximpe) where the deliverable was a dashboard people actually opened. Before that — a calorie tracker that doesn't shame you, a TMS for a logistics startup that had a literal whiteboard for an interface, and a few smaller experiments. Pick one and I'll tell you what shipped and what I'd redo."
    },
    {
      match: /hire|why.*you|recruit|good fit|join/i,
      text: "Three reasons, not exhaustive: I think in flows before frames, I write the copy I'm designing for, and I treat engineering as a teammate rather than a downstream. Pair that with three years of asking 'but why?' before opening Figma and you get someone who ships things people don't quietly hate."
    },
    {
      match: /philosoph|principle|approach|how.*design|believe/i,
      text: "Boring version: clarity over cleverness, hierarchy over decoration, copy is design. Honest version: most of the work is removing things, naming things, and arguing nicely. The rest is just showing up consistently."
    },
    {
      match: /eximpe/i,
      text: "Eximpe is a trade-finance product for cross-border SMEs. I led design on the dashboard and onboarding — turning a 14-step bureaucratic flow into something a founder can finish before their coffee gets cold. Detailed case study in /Work."
    },
    {
      match: /junior|senior|level|years?|experience/i,
      text: "Three years professional, six years of caring about this stuff. Comfortable owning end-to-end product surfaces, less comfortable being called either label. Mid-level if you need a box."
    },
    {
      match: /ai|gpt|llm|model/i,
      text: "I treat AI like a junior collaborator with no ego — fast, occasionally wrong, useful when scoped. The Playground has a few experiments. None of them are 'AI features bolted onto a product' — that trick stops working sometime in 2024."
    },
    {
      match: /tool|figma|stack/i,
      text: "Figma, FigJam, Linear, Notion, a healthy amount of pen and paper, and increasingly: Cursor / Claude for prototyping in code instead of frames. Stack matters less than the question you're answering with it."
    },
    {
      match: /location|where|based|india|remote/i,
      text: "Based in India. Open to remote, hybrid, or the right onsite. Timezone-flexible — I've worked across IST, GMT, and PST overlap windows."
    },
    {
      match: /contact|email|reach/i,
      text: "Easiest: the 'Talk to my AI' modal you're already in. Real channels are in the footer of the site. He reads everything; he replies to most of it."
    }
  ];

  function findResponse(text) {
    for (const r of RESPONSES) {
      if (r.match.test(text)) return r.text;
    }
    return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
  }

  function appendBubble(text, who) {
    const b = document.createElement('div');
    b.className = 'bubble is-' + who;
    b.textContent = text;
    body.appendChild(b);
    body.scrollTop = body.scrollHeight;
    return b;
  }

  function appendThinking() {
    const t = document.createElement('div');
    t.className = 'bubble is-thinking';
    t.textContent = 'thinking';
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;
    return t;
  }

  function send(rawText) {
    const text = (rawText || '').trim();
    if (!text) return;
    appendBubble(text, 'user');
    input.value = '';

    const t = appendThinking();
    setTimeout(() => {
      t.remove();
      appendBubble(findResponse(text), 'ai');
    }, 700 + Math.random() * 600);
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => send(input.value));
  }
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        send(input.value);
      }
    });
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      send(chip.textContent.trim());
    });
  });

  // Mic button — UI-only toggle. Tries Web Speech API if available.
  if (micBtn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognizer = null;
    let recording = false;

    micBtn.addEventListener('click', () => {
      if (!SR) {
        // Graceful fallback: just visual toggle.
        micBtn.classList.toggle('is-recording');
        if (micBtn.classList.contains('is-recording')) {
          input.placeholder = 'Listening… (demo)';
          setTimeout(() => {
            micBtn.classList.remove('is-recording');
            input.placeholder = 'Ask anything…';
            input.value = "Tell me about your work";
            input.focus();
          }, 1600);
        }
        return;
      }

      if (!recognizer) {
        recognizer = new SR();
        recognizer.continuous = false;
        recognizer.interimResults = true;
        recognizer.lang = 'en-US';
        recognizer.onresult = (ev) => {
          const t = Array.from(ev.results).map((r) => r[0].transcript).join('');
          input.value = t;
        };
        recognizer.onend = () => {
          recording = false;
          micBtn.classList.remove('is-recording');
          input.placeholder = 'Ask anything…';
        };
      }

      if (recording) {
        recognizer.stop();
      } else {
        recording = true;
        micBtn.classList.add('is-recording');
        input.placeholder = 'Listening…';
        try { recognizer.start(); } catch (_) { /* already started */ }
      }
    });
  }
})();

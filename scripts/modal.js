/* Talk-to-my-AI modal.
   - Opens from any [data-modal-open] trigger.
   - Closes on backdrop click, X button, Esc, or [data-modal-close].
   - "/" anywhere on the page focuses the input.
   - Talks to /api/chat (Vercel serverless function → Groq). */

(function () {
  const modal    = document.getElementById('aiModal');
  const backdrop = document.getElementById('aiBackdrop');
  if (!modal || !backdrop) return;

  const body     = modal.querySelector('.modal-body');
  const input    = modal.querySelector('.composer input');
  const sendBtn  = modal.querySelector('.composer-btn.is-send');
  const micBtn   = modal.querySelector('.composer-btn.is-mic');
  const promptsEl = modal.querySelector('[data-modal-prompts]')
                 || modal.querySelector('.modal-prompts');

  // Grounding context. On case-study pages an element marked [data-ai-source]
  // holds the article; we pass its readable text to the API so the AI answers
  // strictly from this case study (no made-up answers). Empty on the homepage,
  // where the AI runs in general-portfolio mode.
  const sourceEl = document.querySelector('[data-ai-source]');
  const pageContext = sourceEl
    ? (sourceEl.innerText || sourceEl.textContent || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 24000)
    : '';

  // Conversation memory for the current session. Resets when the page reloads.
  const conversation = [];
  let pending = false;

  function open() {
    modal.classList.add('is-open');
    backdrop.classList.add('is-open');
    document.body.classList.add('is-ai-open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input && input.focus(), 240);
  }

  function close() {
    modal.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.classList.remove('is-ai-open');
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
    if (e.key === '/' && !isOpen) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        open();
      }
    }
  });

  /* --- Bubbles --- */

  // Escape any HTML in raw text so we can safely inject our own markup.
  function escapeHTML(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Tiny, safe markdown renderer for AI replies.
  // Supports: "- " / "* " bullets, **bold**. Everything else stays as text.
  function renderLightMarkdown(raw) {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let inList = false;
    let paraBuf = [];

    function flushPara() {
      if (paraBuf.length) {
        html += '<p>' + paraBuf.join('<br>') + '</p>';
        paraBuf = [];
      }
    }
    function closeList() {
      if (inList) { html += '</ul>'; inList = false; }
    }

    function inline(text) {
      // Escape first, then promote **bold** spans.
      return escapeHTML(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    }

    for (const line of lines) {
      const bullet = line.match(/^\s*[-*]\s+(.*)$/);
      if (bullet) {
        flushPara();
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + inline(bullet[1]) + '</li>';
      } else if (line.trim() === '') {
        flushPara();
        closeList();
      } else {
        closeList();
        paraBuf.push(inline(line));
      }
    }
    flushPara();
    closeList();
    return html;
  }

  function appendBubble(text, who) {
    const b = document.createElement('div');
    b.className = 'bubble is-' + who;
    if (who === 'ai') {
      b.innerHTML = renderLightMarkdown(text);
    } else {
      b.textContent = text;
    }
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

  /* --- API call --- */

  async function callAPI(userMessage) {
    conversation.push({ role: 'user', content: userMessage });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation, context: pageContext })
      });

      if (!res.ok) {
        // 404 typically means we're running locally without Vercel functions.
        if (res.status === 404) {
          throw new Error('local');
        }
        throw new Error('upstream');
      }

      const data = await res.json();
      const reply = (data && data.reply) || '';
      if (!reply) throw new Error('empty');

      conversation.push({ role: 'assistant', content: reply });
      return reply;
    } catch (err) {
      // Roll back the user turn so a retry with the same input works.
      conversation.pop();
      throw err;
    }
  }

  /* --- Send --- */

  function setPending(on) {
    pending = on;
    if (input) input.disabled = on;
    if (sendBtn) sendBtn.disabled = on;
  }

  function send(rawText) {
    if (pending) return;
    const text = (rawText || '').trim();
    if (!text) return;

    appendBubble(text, 'user');
    if (input) input.value = '';
    setPending(true);

    const t = appendThinking();
    callAPI(text)
      .then((reply) => {
        t.remove();
        appendBubble(reply, 'ai');
      })
      .catch((err) => {
        t.remove();
        if (err && err.message === 'local') {
          appendBubble("AI is only live on the deployed site. Try this on the Vercel URL.", 'ai');
        } else {
          appendBubble("Network hiccup — give that another shot.", 'ai');
        }
      })
      .finally(() => {
        setPending(false);
        if (input) input.focus();
      });
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

  /* --- Prompt chips (limited + self-rotating) ---
     Show only MAX_VISIBLE chips at once so the modal never gets buried on
     mobile. When a chip is clicked we send it, drop it, and pull in a fresh
     suggestion — preferring a follow-up tied to what was just asked, then
     falling back to any unused base prompt. */

  const MAX_VISIBLE = 3;

  // Homepage (general mode) uses this curated pool with follow-ups. Case-study
  // pages instead keep their own page-specific chips authored in the HTML — we
  // detect that below and rotate those rather than overwriting them.
  const homePromptPool = [
    { q: 'Walk me through his strongest project',
      next: ['What was the impact of that work?', 'What was the hardest tradeoff there?'] },
    { q: 'How does AI fit into his workflow?',
      next: ['Show me a concrete example', 'Where does he still do the thinking?'] },
    { q: "What's his design philosophy?",
      next: ['How does that show up in his work?', 'What detail does he obsess over?'] },
    { q: 'Why should we hire him?',
      next: ["What's his biggest strength?", 'What kind of team fits him best?'] },
    { q: 'Explain Eximpe in 3 lines',
      next: ['What did he actually design there?', 'What was the hardest part of Eximpe?'] }
  ];

  // [data-modal-prompts] is the opt-in homepage container that JS owns fully.
  // Anything else (e.g. case-study pages) keeps its static chips: we read their
  // text as a plain pool with no follow-ups, so grounded pages stay on-topic.
  const isManaged = promptsEl && promptsEl.hasAttribute('data-modal-prompts');
  const promptPool = isManaged
    ? homePromptPool
    : (promptsEl
        ? Array.from(promptsEl.querySelectorAll('.prompt-chip'))
            .map((c) => ({ q: c.textContent.trim(), next: [] }))
        : []);

  // Flat queue of suggestions still waiting to be shown. Follow-ups get
  // spliced in ahead of the remaining base prompts when their parent is used.
  const used = new Set();
  const queue = promptPool.map((p) => p.q);
  const followupsFor = {};
  promptPool.forEach((p) => { followupsFor[p.q] = p.next.slice(); });

  function makeChip(text) {
    const chip = document.createElement('button');
    chip.className = 'prompt-chip';
    chip.type = 'button';
    chip.textContent = text;
    chip.addEventListener('click', () => onChipClick(chip, text));
    return chip;
  }

  // Pull the next unused suggestion from the queue.
  function nextSuggestion() {
    while (queue.length) {
      const candidate = queue.shift();
      if (!used.has(candidate)) return candidate;
    }
    return null;
  }

  function addChipIfRoom() {
    if (!promptsEl) return;
    if (promptsEl.children.length >= MAX_VISIBLE) return;
    const next = nextSuggestion();
    if (next) {
      used.add(next);
      promptsEl.appendChild(makeChip(next));
    }
  }

  function onChipClick(chip, text) {
    // Queue this prompt's follow-ups ahead of remaining base prompts.
    const follows = followupsFor[text];
    if (follows && follows.length) {
      queue.unshift(...follows.filter((f) => !used.has(f)));
    }
    chip.remove();
    send(text);
    // Backfill so we keep up to MAX_VISIBLE chips while the pool lasts.
    addChipIfRoom();
  }

  if (promptsEl && promptPool.length) {
    promptsEl.innerHTML = '';
    for (let i = 0; i < MAX_VISIBLE; i++) addChipIfRoom();
  }

  // Mic button — real voice input via the Web Speech API.
  // Hidden entirely on browsers that don't support it (no fake demo).
  if (micBtn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognizer = null;
    let recording = false;

    if (!SR) {
      micBtn.style.display = 'none';
      return;
    }

    micBtn.addEventListener('click', () => {
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

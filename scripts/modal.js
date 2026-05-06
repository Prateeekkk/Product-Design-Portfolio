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
  const chips    = modal.querySelectorAll('.prompt-chip');

  // Conversation memory for the current session. Resets when the page reloads.
  const conversation = [];
  let pending = false;

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
        body: JSON.stringify({ messages: conversation })
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

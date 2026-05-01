/*
  Loader — rotates through "Hello" greetings, then dissolves into the site
  with a smooth fade-out. No split panels, no abrupt cuts.
*/

(function () {
  const HELLOS = [
    { word: 'Hello',     lang: 'EN' },
    { word: 'Namaste',   lang: 'HI' },
    { word: 'Hola',      lang: 'ES' },
    { word: 'Bonjour',   lang: 'FR' },
    { word: 'Ciao',      lang: 'IT' },
    { word: 'こんにちは', lang: 'JP' },
    { word: '안녕',       lang: 'KR' },
    { word: 'Olá',       lang: 'PT' }
  ];

  const WORD_DURATION  = 320;     // visible time per greeting
  const FADE_DELAY     = 320;     // pause before fade starts
  const FADE_DURATION  = 900;     // matches CSS transition

  const loader = document.getElementById('loader');
  const wordEl = document.getElementById('loaderWord');
  const langEl = document.getElementById('loaderLang');
  const barEl  = document.querySelector('.loader-bar > span');
  if (!loader || !wordEl) return;

  document.body.classList.add('loader-active');

  if (barEl) {
    requestAnimationFrame(() => { barEl.style.transform = 'scaleX(1)'; });
  }

  let i = 0;
  function showWord(idx) {
    const { word, lang } = HELLOS[idx];
    wordEl.classList.remove('is-active', 'is-leaving');
    void wordEl.offsetWidth;
    wordEl.firstChild.nodeValue = word;
    if (langEl) langEl.textContent = lang;
    wordEl.classList.add('is-active');
  }
  function leaveWord() {
    wordEl.classList.remove('is-active');
    wordEl.classList.add('is-leaving');
  }

  function tick() {
    if (i >= HELLOS.length) { finish(); return; }
    showWord(i);
    setTimeout(() => {
      leaveWord();
      i += 1;
      setTimeout(tick, 120);
    }, WORD_DURATION);
  }

  function finish() {
    setTimeout(() => {
      loader.classList.add('is-fading');
      setTimeout(() => {
        loader.classList.add('is-done');
        document.body.classList.remove('loader-active');
      }, FADE_DURATION + 50);
    }, FADE_DELAY);
  }

  tick();
})();

/* Neeraj Rajiv Shivam: portfolio UI (vanilla JS). The world itself lives in world.js. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var World = window.World || { jump: function () {}, say: function () {}, setNight: function () {}, setMarkers: function () {}, markDone: function () {} };

  /* ---------- pixel icons (pixelarticons, MIT) ---------- */
  var ICON_BASE = 'https://cdn.jsdelivr.net/npm/pixelarticons@1.8.1/svg/';
  function iconify(scope) {
    $$('[data-pi]', scope).forEach(function (el) {
      el.style.setProperty('--pi', 'url("' + ICON_BASE + el.getAttribute('data-pi') + '.svg")');
    });
  }
  iconify(document);

  /* ---------- storage (may be blocked) ---------- */
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- 8-bit sound (off by default) ---------- */
  var soundOn = load('world-sound') === 'on';
  var actx = null;
  function beep(freqs, dur, type, vol) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var now = actx.currentTime;
      freqs.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(f, now + i * dur);
        g.gain.setValueAtTime(vol || 0.05, now + i * dur);
        g.gain.exponentialRampToValueAtTime(0.0001, now + (i + 1) * dur);
        o.connect(g); g.connect(actx.destination);
        o.start(now + i * dur); o.stop(now + (i + 1) * dur);
      });
    } catch (e) {}
  }
  var sfx = {
    jump: function () { beep([330, 494], 0.06); },
    coin: function () { beep([988, 1319], 0.08); },
    click: function () { beep([660], 0.04, 'square', 0.03); },
    fanfare: function () { beep([523, 659, 784, 1047, 784, 1047], 0.1, 'square', 0.045); }
  };
  World.onJump = sfx.jump;

  var soundBtn = $('#sound-toggle');
  function renderSound() {
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
    var i = $('.pi', soundBtn);
    i.setAttribute('data-pi', soundOn ? 'volume-3' : 'volume-x');
    iconify(soundBtn);
  }
  function toggleSound() {
    soundOn = !soundOn;
    save('world-sound', soundOn ? 'on' : 'off');
    renderSound();
    toast(soundOn ? '♪ Sound on' : 'Sound off');
    if (soundOn) face('happy', 1200);
    sfx.coin();
  }
  soundBtn.addEventListener('click', toggleSound);
  renderSound();

  /* ---------- toast ---------- */
  var toastEl = $('#toast'), toastTimer;
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, ms || 2200);
  }
  // the pixel portrait in the top bar and on the player card (avatar.js) pulls a face
  function face(name, ms) { if (window.Avatar) Avatar.show(name, ms); }

  /* ---------- clipboard ---------- */
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
  function copy(text, label) {
    var done = function () { toast((label || 'Copied') + ' ✓'); face('winking', 1400); sfx.coin(); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () { copy(b.getAttribute('data-copy'), 'Email copied'); });
  });

  /* ---------- day / night ---------- */
  function setTheme(t, announce) {
    root.setAttribute('data-theme', t);
    save('world-theme', t);
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'night' ? '#0b0719' : '#170f33');
    World.setNight(t === 'night');
    if (announce) {
      toast(t === 'night' ? '☾ Night shift' : '✦ Dusk');
      face('happy', 1600);
      World.say(t === 'night' ? 'The city never sleeps!' : 'Ooh, pretty sky!', 2200, 'gaze');
    }
  }
  function toggleTheme() { sfx.click(); setTheme(root.getAttribute('data-theme') === 'night' ? 'day' : 'night', true); }
  $('#theme-toggle').addEventListener('click', toggleTheme);
  World.setNight(root.getAttribute('data-theme') === 'night');

  /* ---------- mobile menu ---------- */
  var nav = $('#nav'), menuBtn = $('#menu-toggle');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    var i = $('.pi', menuBtn);
    i.setAttribute('data-pi', open ? 'close' : 'menu');
    iconify(menuBtn);
  }
  menuBtn.addEventListener('click', function () { sfx.click(); setMenu(!nav.classList.contains('is-open')); });
  $$('.nav__link').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });

  /* ---------- scroll: to-top + active nav ---------- */
  var toTop = $('#to-top');
  var navSections = $$('.nav__link').map(function (a) { return $(a.getAttribute('href')); });
  var links = $$('.nav__link');
  var ticking = false;
  function onScroll() {
    var y = window.scrollY;
    toTop.classList.toggle('is-visible', y > 900);
    var probe = y + window.innerHeight * 0.4, current = -1;
    navSections.forEach(function (s, i) { if (s && s.offsetTop <= probe) current = i; });
    links.forEach(function (l, i) { l.classList.toggle('is-active', i === current); });
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();
  toTop.addEventListener('click', function () {
    sfx.jump();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---------- reveal + counters ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
    if (reduceMotion) { el.textContent = target.toFixed(dec); return; }
    var start = performance.now(), dur = 1400;
    (function step(now) {
      var p = Math.min((now - start) / dur, 1);
      el.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }
  var revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-visible');
        $$('[data-count]', e.target).forEach(animateCount);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    $$('[data-count]').forEach(animateCount);
  }

  /* ---------- XP: discover each area of the map ---------- */
  var areas = [
    { id: 'about', name: 'About me', say: 'That\'s me!', mood: 'wave' },
    { id: 'experience', name: 'Experience', say: 'My internship!', mood: 'notice' },
    { id: 'projects', name: 'Projects', say: 'Check these out!', mood: 'notice' },
    { id: 'publication', name: 'Publication', say: 'Published!', mood: 'smile', face: 'grinning' },
    { id: 'skills', name: 'Skills', say: 'My toolkit!', mood: 'notice' },
    { id: 'education', name: 'Education', say: 'Class of 2027!', mood: 'smile' },
    { id: 'contact', name: 'Contact', say: 'Say hello!', mood: 'wave' }
  ];
  var found = 0;
  var xpFill = $('#xp-fill'), xpCount = $('#xp-count');
  function renderXP() {
    xpFill.style.width = 'calc(' + (found / areas.length * 100) + '% - 4px)';
    xpCount.textContent = found + '/' + areas.length;
  }
  renderXP();

  function discover(i) {
    var a = areas[i];
    if (a.found) return;
    a.found = true;
    found++;
    renderXP();
    World.markDone(i);
    World.say(a.say, 2200, a.mood);
    face(a.face || 'happy', 1700);
    sfx.coin();
    if (found === areas.length) {
      setTimeout(function () {
        toast('★ Achievement unlocked: Explorer! You saw every section. Thanks for visiting! ★', 4200);
        World.say('We did it!', 3000, 'wave');
        face('laughing', 2600);
        sfx.fanfare();
      }, 900);
    } else {
      toast('+1 XP · Found: ' + a.name);
    }
  }

  if ('IntersectionObserver' in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = +e.target.getAttribute('data-area');
        discover(i);
        seen.unobserve(e.target);
      });
    }, { rootMargin: '-45% 0px -45% 0px' }); // fires when the section crosses the middle of the screen
    areas.forEach(function (a, i) {
      var el = document.getElementById(a.id);
      if (el) { el.setAttribute('data-area', i); seen.observe(el); }
    });
  }

  // signposts in the world sit where each area gets discovered
  function placeSigns() {
    World.setMarkers(areas.map(function (a) {
      var el = document.getElementById(a.id);
      return el ? Math.max(0, el.offsetTop - window.innerHeight * 0.5) : 0;
    }));
  }
  placeSigns();
  window.addEventListener('load', placeSigns);
  var rs;
  window.addEventListener('resize', function () { clearTimeout(rs); rs = setTimeout(placeSigns, 200); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeSigns);

  // say hello once the world has loaded
  setTimeout(function () { if (window.scrollY < 50) World.say('Hi! Scroll to explore ↓', 3200, 'wave'); }, 900);

  /* ---------- project filters ---------- */
  var tabs = $$('.tab'), cards = $$('.card'), empty = $('#empty-state');
  function applyFilter(f) {
    var shown = 0;
    tabs.forEach(function (b) {
      var on = b.getAttribute('data-filter') === f;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    cards.forEach(function (c) {
      var match = f === 'all' || c.getAttribute('data-tags').split(' ').indexOf(f) !== -1;
      c.classList.toggle('is-hidden', !match);
      if (match) { shown++; c.classList.add('is-visible'); }
    });
    empty.hidden = shown > 0;
  }
  tabs.forEach(function (b) {
    b.addEventListener('click', function () { sfx.click(); applyFilter(b.getAttribute('data-filter')); });
  });
  // links elsewhere on the page that jump to Projects with a filter already applied
  $$('[data-filter-link]').forEach(function (a) {
    a.addEventListener('click', function () { applyFilter(a.getAttribute('data-filter-link')); });
  });

  /* ---------- BibTeX ---------- */
  var bibtex = [
    '@inproceedings{tanmay2026accident,',
    '  title     = {Accident Detection and Emergency Support System for Scooters Based on Edge AI Technology},',
    '  author    = {Tanmay, M. S. and Shivam, Neeraj Rajiv and Shivanna, V. and Sathya, D. and Sankaran, C.},',
    '  booktitle = {ICT for Sustainable Development (ICT4SD 2025)},',
    '  series    = {Lecture Notes in Networks and Systems},',
    '  volume    = {1652},',
    '  publisher = {Springer},',
    '  year      = {2026},',
    '  doi       = {10.1007/978-3-032-06691-6_25}',
    '}'
  ].join('\n');
  $('#copy-bibtex').addEventListener('click', function () { copy(bibtex, 'BibTeX copied'); });

  /* ---------- letter → mailto ---------- */
  $('#contact-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target, ok = true;
    $$('input, textarea', form).forEach(function (f) {
      var bad = !f.value.trim();
      f.classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { toast('Please fill in every field'); World.say('Hmm, something\'s missing', 2200, 'look'); face('nervous', 2200); return; }
    sfx.fanfare();
    World.say('Letter sent! ✉', 2200, 'wave');
    face('grinning', 2000);
    var body = form.message.value.trim() + '\n\n- ' + form.name.value.trim();
    window.location.href = 'mailto:neerajrs1437@gmail.com?subject=' +
      encodeURIComponent(form.subject.value.trim()) + '&body=' + encodeURIComponent(body);
  });

  /* ---------- résumé link: hide if the file is missing ---------- */
  var resumeLinks = $$('[data-resume]');
  if (location.protocol.indexOf('http') === 0) {
    fetch('resume.pdf', { method: 'HEAD' }).then(function (r) {
      if (!r.ok) resumeLinks.forEach(function (a) { a.hidden = true; });
    }).catch(function () {});
  }

  /* ---------- menu (command palette) ---------- */
  var palette = $('#palette'), pInput = $('#palette-input'), pList = $('#palette-list');
  var go = function (id) { return function () { $(id).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); }; };
  var open = function (url) { return function () { window.open(url, '_blank', 'noopener'); }; };
  var filterTo = function (f) { return function () { applyFilter(f); go('#projects')(); }; };
  var commands = [
    { g: 'Go to', icon: 'home', label: 'Top', run: go('#home') },
    { g: 'Go to', icon: 'user', label: 'About me', run: go('#about') },
    { g: 'Go to', icon: 'briefcase', label: 'Experience', run: go('#experience') },
    { g: 'Go to', icon: 'gamepad', label: 'Projects', run: go('#projects') },
    { g: 'Go to', icon: 'script-text', label: 'Publication', run: go('#publication') },
    { g: 'Go to', icon: 'archive', label: 'Skills', run: go('#skills') },
    { g: 'Go to', icon: 'map', label: 'Education & achievements', run: go('#education') },
    { g: 'Go to', icon: 'mail', label: 'Contact', run: go('#contact') },
    { g: 'Filter projects', icon: 'message-text', label: 'LLM & agent projects', run: filterTo('llm') },
    { g: 'Filter projects', icon: 'eye', label: 'Computer vision projects', run: filterTo('vision') },
    { g: 'Filter projects', icon: 'git-branch', label: 'Research projects', run: filterTo('research') },
    { g: 'Actions', icon: 'file-alt', label: 'Plain version', run: function () { location.href = 'index.html'; } },
    { g: 'Actions', icon: 'moon', label: 'Switch dusk / night', hint: 'T', run: toggleTheme },
    { g: 'Actions', icon: 'volume-3', label: 'Toggle sound', run: toggleSound },
    { g: 'Actions', icon: 'arrow-up', label: 'Jump!', hint: 'W', run: function () { World.jump(); } },
    { g: 'Actions', icon: 'copy', label: 'Copy email address', run: function () { copy('neerajrs1437@gmail.com', 'Email copied'); } },
    { g: 'Actions', icon: 'script', label: 'Copy BibTeX citation', run: function () { copy(bibtex, 'BibTeX copied'); } },
    { g: 'Actions', icon: 'download', label: 'Download résumé (PDF)', run: function () { var a = $('[data-resume]'); if (a && !a.hidden) a.click(); else toast('Résumé not found'); } },
    { g: 'Links', icon: 'github', label: 'GitHub', hint: 'github.com', run: open('https://github.com/Neeraj1437') },
    { g: 'Links', icon: 'user', label: 'LinkedIn', hint: 'linkedin.com', run: open('https://www.linkedin.com/in/neeraj-rajiv-shivam-71282a27a/') },
    { g: 'Links', icon: 'external-link', label: 'Springer paper', hint: 'doi.org', run: open('https://doi.org/10.1007/978-3-032-06691-6_25') }
  ];
  var visible = [], sel = 0, lastFocus = null;

  function render() {
    var q = pInput.value.trim().toLowerCase();
    visible = commands.filter(function (c) { return !q || (c.label + ' ' + c.g).toLowerCase().indexOf(q) !== -1; });
    sel = Math.min(sel, Math.max(visible.length - 1, 0));
    if (!palette.hidden) face(visible.length ? 'thinking' : 'confused', 600000);   // he thinks while the menu is open
    if (!visible.length) { pList.innerHTML = '<li class="palette__empty">Nothing here…</li>'; return; }
    var html = '', group = '';
    visible.forEach(function (c, i) {
      if (c.g !== group) { group = c.g; html += '<li class="palette__group" role="presentation">' + group + '</li>'; }
      html += '<li class="palette__item' + (i === sel ? ' is-selected' : '') + '" role="option" data-i="' + i + '" aria-selected="' + (i === sel) + '">' +
        '<i class="pi" data-pi="' + c.icon + '"></i><span>' + c.label + '</span>' + (c.hint ? '<span class="hint">' + c.hint + '</span>' : '') + '</li>';
    });
    pList.innerHTML = html;
    iconify(pList);
    var cur = $('.is-selected', pList);
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    lastFocus = document.activeElement;
    palette.hidden = false; pInput.value = ''; sel = 0; render();
    sfx.click();
    setTimeout(function () { pInput.focus(); }, 10);
  }
  function closePalette() {
    palette.hidden = true;
    if (window.Avatar) Avatar.clear();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function runSelected() {
    var c = visible[sel];
    if (!c) return;
    closePalette();
    c.run();
  }
  $('#palette-open').addEventListener('click', openPalette);
  palette.addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-close')) closePalette();
    var item = e.target.closest('.palette__item');
    if (item) { sel = +item.getAttribute('data-i'); runSelected(); }
  });
  pList.addEventListener('mousemove', function (e) {
    var item = e.target.closest('.palette__item');
    if (item && +item.getAttribute('data-i') !== sel) { sel = +item.getAttribute('data-i'); render(); }
  });
  pInput.addEventListener('input', function () { sel = 0; render(); });
  pInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(visible.length, 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + visible.length) % Math.max(visible.length, 1); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); runSelected(); }
  });

  document.addEventListener('keydown', function (e) {
    var a = document.activeElement;
    var typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette.hidden ? openPalette() : closePalette();
    } else if (e.key === 'Escape') {
      if (!palette.hidden) closePalette(); else setMenu(false);
    } else if (!typing && palette.hidden && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === '/') { e.preventDefault(); openPalette(); }
      else if (e.key.toLowerCase() === 't') toggleTheme();
    }
  });

  /* ---------- footer year ---------- */
  $('#year').textContent = new Date().getFullYear();

  /* ---------- text fades out just above the rooftop ----------
     The rooftop strip (the girl, kiosks, cats) is drawn over the page, so the page's text fades out before it gets
     there. --fade-at is where the fade ends, measured from the top of each element (style.css applies the mask). */
  var faded = [].slice.call(document.querySelectorAll('main, .footer')), fadeQueued = false;
  function setFade() {
    fadeQueued = false;
    var end = innerHeight - 80;
    faded.forEach(function (el) { el.style.setProperty('--fade-at', Math.round(end - el.getBoundingClientRect().top) + 'px'); });
  }
  function queueFade() { if (!fadeQueued) { fadeQueued = true; requestAnimationFrame(setFade); } }
  addEventListener('scroll', queueFade, { passive: true });
  addEventListener('resize', queueFade);
  setFade();
})();

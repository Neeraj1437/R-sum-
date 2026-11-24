/* =========================================================
   The player portrait: a pixel avatar of Neeraj in the top bar and on the About player card.
   Frames live in images/avatar.png (traced from a portrait sheet: 39 x 43 px each, 7 to a row). Both
   portraits ([data-avatar]) always show the same frame.
   He looks towards the pointer (twelve head directions), blinks, says the hero line when the page opens,
   looks bored if left alone, looks away while the tab is hidden, and pulls faces when things happen on
   the page (script.js calls Avatar.show).
   Exposes window.Avatar = { show(name, ms), talk(ms), clear() }.
   ========================================================= */
(function () {
  'use strict';

  var ORDER = ['farLeft', 'left', 'slightLeft', 'front', 'slightRight', 'right', 'up', 'down', 'upLeft', 'upRight',
    'downLeft', 'downRight', 'farLeftBlink', 'leftBlink', 'slightLeftBlink', 'frontBlink', 'slightRightBlink',
    'rightBlink', 'upBlink', 'downBlink', 'upLeftBlink', 'upRightBlink', 'downLeftBlink', 'downRightBlink',
    'talkA', 'talkB', 'laughing', 'happy', 'bored', 'thinking', 'annoyed', 'sad', 'confused', 'nervous',
    'winking', 'grinning', 'lookBack'];
  var COLS = 7, CW = 39, CH = 43;

  var els = [].slice.call(document.querySelectorAll('[data-avatar]'));
  if (!els.length) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var now = function () { return performance.now(); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };

  var shown = '';
  function draw(name) {
    if (name === shown) return;
    var i = ORDER.indexOf(name);
    if (i < 0) return;
    shown = name;
    els.forEach(function (el) {
      el.style.setProperty('--ax', -(i % COLS) * CW);
      el.style.setProperty('--ay', -Math.floor(i / COLS) * CH);
    });
  }

  /* ---------- state ---------- */
  var dir = 'front', want = 'front', wantSince = 0, dirSince = 0;   // where he looks (with a little hysteresis)
  var mouseAt = -1e9;                                              // last time a real mouse moved
  var nextWander = 0;
  var blinkUntil = 0, nextBlink = now() + rand(1500, 4000);
  var expr = null;                                                 // { name, until }: a face that overrides the rest
  var talkUntil = 0, mouthAt = 0, mouth = 'front';
  var active = now(), bored = false;
  var away = false;

  function show(name, ms) {
    if (ORDER.indexOf(name) < 0) return;
    expr = { name: name, until: now() + (ms || 1400) };
  }
  function clear() { expr = null; }
  function talk(ms) { talkUntil = now() + (ms || 1500); expr = null; }

  /* ---------- looking at the pointer ---------- */
  function ref() { // the portrait to look from: the player card's when it is on screen, else the top bar's
    for (var i = els.length - 1; i >= 0; i--) {
      var r = els[i].getBoundingClientRect();
      if (r.width && r.bottom > 0 && r.top < innerHeight) return r;
    }
    return els[0].getBoundingClientRect();
  }
  function aim(dx, dy, cx) {
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.hypot(dx, dy) < 40) return 'front';                 // the pointer is on his face
    if (ay > 60 && ay > ax * 1.6) return dy < 0 ? 'up' : 'down';
    if (ay > 60 && ay > ax * 0.45) return (dy < 0 ? 'up' : 'down') + (dx < 0 ? 'Left' : 'Right');
    var nx = dx / Math.max(160, dx < 0 ? cx : innerWidth - cx);  // 1 = the edge of the screen on that side
    if (nx < -0.6) return 'farLeft';
    if (nx < -0.25) return 'left';
    if (nx < -0.05) return 'slightLeft';
    if (nx <= 0.05) return 'front';
    if (nx <= 0.3) return 'slightRight';
    return 'right';                                              // the sheet has no far-right view
  }
  document.addEventListener('pointermove', function (e) {
    wake();
    if (e.pointerType !== 'mouse' || reduce) return;
    mouseAt = now();
    var r = ref();
    var cx = r.left + r.width / 2;
    var a = aim(e.clientX - cx, e.clientY - (r.top + r.height * 0.45), cx);
    if (a !== want) { want = a; wantSince = now(); }
  }, { passive: true });

  // no mouse (touch, or it has been still a while): he glances about on his own, mostly at you
  var GLANCES = ['front', 'front', 'front', 'slightLeft', 'slightRight', 'slightLeft', 'slightRight', 'left', 'right', 'up', 'down', 'upLeft', 'upRight'];
  function wander(t) {
    if (t < nextWander) return;
    want = GLANCES[Math.floor(Math.random() * GLANCES.length)]; wantSince = t - 1000;
    nextWander = t + (want === 'front' ? rand(2500, 5000) : rand(900, 2000));
  }

  /* ---------- idle and away ---------- */
  function wake() { active = now(); bored = false; }
  ['scroll', 'keydown', 'pointerdown', 'touchstart'].forEach(function (ev) { addEventListener(ev, wake, { passive: true }); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { away = true; draw('lookBack'); }
    else if (away) { away = false; active = now(); show('happy', 1400); }   // glad you're back
  });
  document.addEventListener('mouseout', function (e) { // the pointer leaves the window: a sad little face until it's back
    if (!e.relatedTarget && !reduce) expr = { name: 'sad', until: now() + 8000, out: true };
  });
  document.addEventListener('mouseover', function () {
    if (expr && expr.out) expr = { name: 'happy', until: now() + 900 };
  });

  /* ---------- poking the portrait ---------- */
  var pokes = 0, lastPoke = 0;
  var POKED = ['happy', 'winking', 'laughing', 'grinning'];
  els.forEach(function (el) {
    var box = el.parentNode;
    box.addEventListener('click', function () {
      var t = now();
      pokes = t - lastPoke < 1500 ? pokes + 1 : 0; lastPoke = t;
      show(pokes >= 5 ? 'annoyed' : POKED[pokes % POKED.length], pokes >= 5 ? 2200 : 1300);
    });
    var hoverT;
    box.addEventListener('mouseenter', function () { hoverT = setTimeout(function () { if (!expr) show('happy', 1600); }, 250); });
    box.addEventListener('mouseleave', function () { clearTimeout(hoverT); });
  });

  // writing a letter: he thinks along while you type
  var msg = document.querySelector('#contact-form textarea');
  if (msg) msg.addEventListener('input', function () { show('thinking', 1500); });

  /* ---------- the loop ---------- */
  function frame(t) {
    if (away) return 'lookBack';
    if (expr && t < expr.until) return expr.name;
    expr = null;
    if (t < talkUntil) {                                     // the mouth flaps: shut, a little open, open
      if (t > mouthAt) { mouth = mouth === 'front' ? (Math.random() < 0.5 ? 'talkA' : 'talkB') : (Math.random() < 0.4 ? 'front' : mouth === 'talkA' ? 'talkB' : 'talkA'); mouthAt = t + rand(80, 150); }
      return mouth;
    }
    if (!reduce && t - active > 22000 && !bored) { bored = true; return (expr = { name: 'bored', until: t + 3500 }).name; }
    if (t - mouseAt > 6000 && !reduce) wander(t);
    if (want !== dir && t - wantSince > 90 && t - dirSince > 140) { dir = want; dirSince = t; }
    if (!reduce && t > nextBlink) { blinkUntil = t + 130; nextBlink = t + (Math.random() < 0.2 ? 260 : rand(2200, 5500)); }
    return t < blinkUntil ? dir + 'Blink' : dir;
  }
  function tick() {
    if (!document.hidden) draw(frame(now()));
    setTimeout(tick, 50);
  }
  draw('front');
  tick();

  // the hero dialog is him talking: say the opening line when the page opens at the top
  if (!reduce) setTimeout(function () { if (window.scrollY < 50) talk(1800); }, 500);

  window.Avatar = { show: show, talk: talk, clear: clear };
})();

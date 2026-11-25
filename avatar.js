/* =========================================================
   The player portrait: a pixel avatar of Neeraj in the top bar and on the About player card.
   Frames live in images/avatar.png (41 x 44 px each, 7 to a row): 21 head angles traced from a look-around
   sheet (seven turns from far left to far right, each looking up, level and down) with a blink for each,
   two talking mouths, and ten expression faces from a matching expressions sheet. Both portraits ([data-avatar]) always show the same frame.
   He looks towards the pointer (the nearest of the 21 angles), blinks, says the hero line when the page opens,
   looks bored if left alone, looks away while the tab is hidden, and pulls faces when things happen on
   the page (script.js calls Avatar.show).
   Exposes window.Avatar = { show(name, ms), talk(ms), clear() }.
   ========================================================= */
(function () {
  'use strict';

  var YAW = ['farLeft', 'left', 'slightLeft', 'front', 'slightRight', 'right', 'farRight'];   // viewer's left to right
  function look(pitch, yaw) { // 'up' / '' / 'down' + a turn -> frame name: 'upFarLeft', 'left', 'down', ...
    if (!pitch) return yaw;
    return yaw === 'front' ? pitch : pitch + yaw.charAt(0).toUpperCase() + yaw.slice(1);
  }
  var LOOKS = [];
  ['up', '', 'down'].forEach(function (p) { YAW.forEach(function (y) { LOOKS.push(look(p, y)); }); });
  var ORDER = LOOKS.concat(LOOKS.map(function (n) { return n + 'Blink'; }), ['talkA', 'talkB', 'happy', 'laughing', 'winking',
    'grinning', 'thinking', 'bored', 'annoyed', 'sad', 'confused', 'nervous']);
  var COLS = 7, CW = 41, CH = 44;

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
  // dx, dy: the pointer from his eyes; cx, cy: his eyes on screen. Each axis is measured against the room on that
  // side of him (1 = the edge of the screen), so he can look all the way round from either portrait.
  function aim(dx, dy, cx, cy) {
    if (Math.hypot(dx, dy) < 30) return 'front';                // the pointer is on his face
    var nx = dx / Math.max(160, dx < 0 ? cx : innerWidth - cx);
    var ny = dy / Math.max(120, dy < 0 ? cy : innerHeight - cy);
    var yaw = nx < -0.62 ? 'farLeft' : nx < -0.3 ? 'left' : nx < -0.08 ? 'slightLeft' : nx <= 0.08 ? 'front'
      : nx <= 0.3 ? 'slightRight' : nx <= 0.62 ? 'right' : 'farRight';
    var pitch = ny < -0.2 ? 'up' : ny > 0.2 ? 'down' : '';
    return look(pitch, yaw);
  }
  document.addEventListener('pointermove', function (e) {
    wake();
    if (e.pointerType !== 'mouse' || reduce) return;
    mouseAt = now();
    var r = ref();
    var cx = r.left + r.width / 2, cy = r.top + r.height * 0.45;
    var a = aim(e.clientX - cx, e.clientY - cy, cx, cy);
    if (a !== want) { want = a; wantSince = now(); }
  }, { passive: true });

  // no mouse (touch, or it has been still a while): he glances about on his own, mostly at you
  var GLANCES = ['front', 'front', 'front', 'slightLeft', 'slightRight', 'slightLeft', 'slightRight', 'left', 'right', 'up', 'down',
    'upSlightLeft', 'upSlightRight', 'downSlightLeft', 'downSlightRight', 'farLeft', 'farRight'];
  function wander(t) {
    if (t < nextWander) return;
    want = GLANCES[Math.floor(Math.random() * GLANCES.length)]; wantSince = t - 1000;
    nextWander = t + (want === 'front' ? rand(2500, 5000) : rand(900, 2000));
  }

  /* ---------- idle and away ---------- */
  function wake() { active = now(); bored = false; }
  ['scroll', 'keydown', 'pointerdown', 'touchstart'].forEach(function (ev) { addEventListener(ev, wake, { passive: true }); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { away = true; draw('farLeft'); }
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
    if (away) return 'farLeft';                            // looking away while you're on another tab
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

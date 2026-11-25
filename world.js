/* =========================================================
   world.js: the neon city around the page.
   Two low-resolution canvases, scaled up by CSS with crisp pixels (S screen px per pixel):
     #world-back  : a violet sky with cloud bands and shooting stars; a far skyline with a domed tower; a dense
                    mid-city of lit windows, water towers, fire escapes and pink neon word signs, with a passing
                    train; tall buildings close by (BAR, INN, BANK, a turning fan); the rooftop wall with AC units,
                    CRT stacks and vending machines, and the cosy desk where the walk starts
     #world-front : the rooftop, cones, crates and cables, terminal kiosks (one per section), cats, little robots,
                    holo-butterflies and the girl (girl.js)
   Scrolling moves the camera, so she runs right (scroll down) or left (scroll up). Left alone she roams:
   strolls about, sometimes breaks into a sprint, looks around, turns to watch the sky, waves, stands easy,
   smiles to herself, stretches and yawns, turns round to look at you, walks over to a bench to sit for a
   while, and sits down on the floor to nod off. She only jumps when asked (W, or World.jump()). The page can
   ask for a reaction as she speaks (World.say(text, ms, 'wave' | 'notice' | 'smile' | 'gaze' | 'look')).
   Scenery is pre-rendered into seamless tiles (once per theme), then scrolled with parallax.
   Exposes window.World = { jump, say, setNight, setMarkers, markDone, onJump }.
   ========================================================= */
(function () {
  'use strict';

  var back = document.getElementById('world-back');
  var front = document.getElementById('world-front');
  if (!back || !front || !back.getContext) return;
  var bx = back.getContext('2d');
  var fx = front.getContext('2d');
  var G = window.GIRL || null;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var S = 2;            // screen px per world pixel (3 on very wide screens)
  var GROUND = 20;      // rooftop strip height (CSS --ground = GROUND * S)
  var FRONT_H = 120;    // front canvas height
  var WALK = 0.9;       // screen px walked per px scrolled
  var TILE = 960;       // width of the pre-rendered backdrop tiles
  var TILE_F = 480;     // width of the pre-rendered rooftop tile
  var WF = 0, WB = 0, HB = 0;
  var OUTLINE = '#160f24';
  var NEON = ['#ff6fb5', '#5ee6ff', '#ffbf4d', '#7cf0a8', '#b48cff'];

  /* ---------- helpers ---------- */
  function hash(n) {
    var h = (Math.imul(n | 0, 374761393) + 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) { // seeded, so the city is the same on every visit
    var s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  function rect(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
  function dot(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
  function disc(ctx, cx, cy, r, c) {
    ctx.fillStyle = c;
    for (var dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
      var w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.3);
      ctx.fillRect(Math.round(cx) - w, Math.round(cy) + dy, w * 2 + 1, 1);
    }
  }
  function sag(ctx, x0, y0, x1, y1, drop, c) { // a hanging cable
    var n = Math.max(2, Math.ceil(Math.abs(x1 - x0) * 1.5));
    for (var i = 0; i <= n; i++) { var k = i / n; dot(ctx, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + drop * 4 * k * (1 - k), c); }
  }
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function rgba(h, a) { var c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(a, b, k) { a = hexRgb(a); b = hexRgb(b); return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * k); }).join(',') + ')'; }

  // rows of characters -> canvas, one pixel per character; outline: colour of an automatic 1px outline, or null
  function sprite(rows, pal, outline) {
    var h = rows.length, w = rows[0].length, o = outline ? 1 : 0, W2 = w + 2 * o, H2 = h + 2 * o;
    for (var i = 0; i < h; i++) if (rows[i].length !== w) throw new Error('sprite row ' + i + ' is ' + rows[i].length + ' wide, expected ' + w);
    var c = canvas(W2, H2), x = c.getContext('2d'), img = x.createImageData(W2, H2), d = img.data, rgb = {}, k;
    for (k in pal) rgb[k] = hexRgb(pal[k]);
    var ol = o ? hexRgb(outline) : null;
    function solid(r, q) { return r >= 0 && r < h && q >= 0 && q < w && rows[r][q] !== '.'; }
    for (var r = -o; r < h + o; r++) {
      for (var q = -o; q < w + o; q++) {
        var col = null;
        if (solid(r, q)) { col = rgb[rows[r][q]]; if (!col) throw new Error('no colour for "' + rows[r][q] + '"'); }
        else if (o && (solid(r - 1, q) || solid(r + 1, q) || solid(r, q - 1) || solid(r, q + 1))) col = ol;
        if (!col) continue;
        var p = ((r + o) * W2 + q + o) * 4;
        d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  function flip(c) {
    var f = canvas(c.width, c.height), x = f.getContext('2d');
    x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
    return f;
  }
  function pair(rows, pal, outline) { var s = sprite(rows, pal, outline); return [s, flip(s)]; }

  // tiny 3x5 pixel font for numbers and short labels
  var FONT = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
    'S': '111100111001111', 'T': '111010010010010', 'A': '010101111101101', 'X': '101101010101101', 'P': '111101111100100',
    '.': '000000000000010', '/': '001001010100100', ' ': '000000000000000'
  };
  function text3(ctx, str, x, y, c, k) {
    k = k || 1;
    for (var i = 0; i < str.length; i++) {
      var g = FONT[str[i]] || FONT[' '];
      for (var j = 0; j < 15; j++) if (g[j] === '1') rect(ctx, x + i * 4 * k + (j % 3) * k, y + Math.floor(j / 3) * k, k, k, c);
    }
  }
  // 5 x 7 capitals for the neon signs (only the letters the signs use)
  var FONT5 = {
    A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
    E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000', H: '10001100011000111111100011000110001',
    I: '01110001000010000100001000010001110', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
    M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110',
    P: '11110100011000111110100001000010000', R: '11110100011000111110101001001010001', T: '11111001000010000100001000010000100',
    X: '10001100010101000100010101000110001', '2': '01110100010000100010001000100011111', '4': '00010001100101010010111110001000010'
  };
  function text5(ctx, str, x, y, c) {
    ctx.fillStyle = c;
    for (var i = 0; i < str.length; i++) {
      var g = FONT5[str[i]];
      if (g) for (var j = 0; j < 35; j++) if (g[j] === '1') ctx.fillRect(x + i * 6 + (j % 5), y + Math.floor(j / 5), 1, 1);
    }
  }

  /* ---------- the girl (girl.js) ---------- */
  var GIRL = null;                                    // pose name -> [facing right, facing left]
  var girlTop = 54;                                   // height of her standing pose, for the speech bubble
  function cell(p) { // a cropped pose -> full W x H rows, head centre on column AX, feet on the bottom row
    var blank = new Array(G.W + 1).join('.'), left = G.AX - p.ax, out = [];
    for (var i = p.rows.length; i < G.H; i++) out.push(blank);
    p.rows.forEach(function (r) { out.push(blank.slice(0, left) + r + blank.slice(0, G.W - left - r.length)); });
    return out;
  }
  var GIRL_EDGE = '#5b3d82';   // her outline: a dim violet rim, so the black jacket still reads against the night
  function buildGirl() {
    if (!G || GIRL) return;
    GIRL = {};
    Object.keys(G.poses).forEach(function (n) {
      var s = sprite(cell(G.poses[n]), G.PAL, GIRL_EDGE);
      GIRL[n] = G.noFlip.indexOf(n) >= 0 ? [s, s] : [s, flip(s)];   // facing you: never mirrored
    });
    girlTop = G.poses.front.rows.length + 2;
  }

  /* Cats sitting around the rooftop (facing you, blinking), black or orange. The dark outline is part of the art. */
  var BLACK_CAT = { k: '#0c0a14', y: '#2b283f', Y: '#1f1c30', c: '#3b3758', e: '#9dff8a', n: '#ff8fb5', p: '#3b3758' };
  var ORANGE_CAT = { k: '#2a140e', y: '#f08a35', Y: '#c25e1c', c: '#ffe0b8', e: '#5ee6ff', n: '#ff7fa8', p: '#ffe0b8' };
  var CAT_FRONT = [
    '.k.......k.....',
    'kyk.....kyk....',
    'kyyk...kyyk....',
    'kyykkkkkyyk....',
    'kyyYyYyYyyk....',
    'kyyyyyyyyyk....',
    'kyeyyyyyeyk....',
    'kyeycccyeyk....',
    'kyyccnccyyk....',
    '.kyyyyyyyk.....',
    '..kkyyykk....k.',
    '.kyycccyyk..kyk',
    'kyYycccyYyk.kYk',
    'kyyycccyyyk.kyk',
    'kYyycccyyYk.kyk',
    'kyyykckcyyykkyk',
    'kyyykckcyyyyyk.',
    'kycckckckccyyk.',
    'kkkkkkkkkkkkkk.'
  ];
  var CAT_BLINK = CAT_FRONT.slice();
  CAT_BLINK[6] = 'kyyyyyyyyyk....';
  CAT_BLINK[7] = 'kykycccykyk....';
  function catSet(pal) { return { front: pair(CAT_FRONT, pal, null), blink: pair(CAT_BLINK, pal, null) }; }
  var CATS = [catSet(BLACK_CAT), catSet(ORANGE_CAT)];

  // a little patrol robot and a hovering drone
  var BOT_PAL = { k: '#16112e', w: '#c4b8e8', g: '#7a6cb0', v: '#2e2266', a: '#ff5a6a', O: '#2f2652' };
  var BOT = pair([
    '.....a.....',
    '.....k.....',
    '...kkkkk...',
    '..kwwwwwk..',
    '.kwvvvvvwk.',
    'kwwwwwwwwwk',
    'kgggggggggk',
    'kwwwwwwwwwk',
    '.kOOk.kOOk.'
  ], BOT_PAL, null);
  var DRONE_PAL = { k: '#16112e', w: '#a596d0', g: '#6b5ea8', r: '#d6ccf2', a: '#7cf0a8' };
  var DRONE = [0, 1].map(function (f) {
    return sprite([
      f ? 'rrr.....rrr' : '.r.......r.',
      '..k.....k..',
      '..kkkkkkk..',
      '.kwwwgwwwk.',
      '..kgggggk..',
      '....kak....'
    ], DRONE_PAL, null);
  });

  /* ---------- palettes ---------- */
  var THEMES = {
    day: { // dusk: a violet city with lavender windows and pink neon
      sky: ['#3b2d93', '#4839a8', '#5343b5', '#7150bd'], stars: 0.45, moon: ['#f7f0ff', '#d6c8f2'],
      cloud: '#c4b0ff', cloudA: 0.17,
      far: '#453392', farHi: '#54409f', farWin: ['#6d54bd', '#7b5dc6', '#6249b2'], farWinP: 0.22, haze: '#8f5ccc', tower: '#4d3a9e',
      mid: '#3a2572', midHi: '#4b3389', midDark: '#2b1a58', midOff: '#311f63', midWin: ['#9d60d4', '#b67ce2', '#8b56c9'], midWinP: 0.26,
      near: '#27164b', nearHi: '#3a2468', nearDark: '#1b0f36', edge: '#4f358c', nearOff: '#21133f', nearWin: ['#b571e3', '#cf92f2', '#a064d8'], nearWinP: 0.3,
      crt: '#9484c6', screen: '#6a4fd8', screenHi: '#a68cf6', streak: '#ffb0e8', glow: 0.16,
      box: '#4a3a7e', boxHi: '#5f4d96', plant: ['#2f7a62', '#4fa982', '#7fd1a6'], water: '#7d8cf0', waterHi: '#b4c0ff', train: '#3b2775', trainHi: '#5b42a0',
      floor: '#45387e', floorHi: '#5d4e9a', floorDark: '#322865', face: '#22174a', faceDark: '#170f33', mote: '#ffffff'
    },
    night: {
      sky: ['#0b0824', '#150f3a', '#221756', '#38206e'], stars: 1, moon: ['#fff6dc', '#d8cfae'],
      cloud: '#9a7cf0', cloudA: 0.11,
      far: '#211750', farHi: '#2b1f60', farWin: ['#4d3896', '#5b41a6', '#44318c'], farWinP: 0.2, haze: '#5b3596', tower: '#281c5e',
      mid: '#1b1140', midHi: '#281a56', midDark: '#120a2e', midOff: '#170e37', midWin: ['#a868e6', '#c98af2', '#9056d6'], midWinP: 0.24,
      near: '#120a29', nearHi: '#1f1440', nearDark: '#0a0519', edge: '#34226a', nearOff: '#0f0823', nearWin: ['#cf86f4', '#e8a6f9', '#b06cea'], nearWinP: 0.28,
      crt: '#55497e', screen: '#5038c4', screenHi: '#7e66ea', streak: '#ff9ccc', glow: 0.24,
      box: '#2b2150', boxHi: '#3a2d66', plant: ['#174a3c', '#287058', '#3f9876'], water: '#4f5fd0', waterHi: '#8794f2', train: '#22164a', trainHi: '#3a2970',
      floor: '#45387e', floorHi: '#5d4e9a', floorDark: '#322865', face: '#22174a', faceDark: '#170f33', mote: '#ff9ccc'
    }
  };

  /* ---------- state ---------- */
  var night = document.documentElement.getAttribute('data-theme') === 'night';
  var P = night ? THEMES.night : THEMES.day;
  var cam = 0, prevCam = 0, keyOff = 0, cxF = 0, cxB = 0;
  var girl = { x: null, y: 0, vy: 0, facing: 1, dist: 0, mode: 'idle', since: 0, act: null, next: 3, target: 0,
               lastMove: -9, landed: -9, prep: -1, v0: 190, fast: false, after: 0, mood: null, runF: 0 };
  var train = { on: false, x: 0, dir: 1, next: 6 };
  var markers = [], done = {}, found = 0;
  var keys = {};
  var bubble = document.getElementById('bubble');
  var bubbleFrom = -9, bubbleUntil = 0;
  var t = 0, last = 0;
  var sky = null, far = null, mid = null, near = null, groundTile = null;
  var PAR = { far: 0.04, drones: 0.08, mid: 0.12, near: 0.3, motes: 0.45 };

  function home() { return Math.round(WF * (WF < 260 ? 0.42 : 0.24)); }   // where she starts, in front px
  function targetCam() { return window.scrollY * WALK + keyOff; }
  function floorB() { return HB - GROUND; }                                   // where the backdrop meets the rooftop
  function gyF() { return FRONT_H - GROUND; }                                 // top of the rooftop strip
  function FLOOR() { return gyF() + 3; }                                     // where feet stand

  /* ---------- backdrop: pre-rendered tiles ---------- */
  function layer() { var c = canvas(TILE, HB); return { c: c, ctx: c.getContext('2d'), screens: [], leds: [], beacons: [], neons: [], lamps: [], fans: [], vends: [] }; }

  function genSky() {
    var c = canvas(WB, HB), ctx = c.getContext('2d'), n = 26, i, x, cols = [];
    function col(k) {
      if (k < 0.45) return mix(P.sky[0], P.sky[1], k / 0.45);
      if (k < 0.8) return mix(P.sky[1], P.sky[2], (k - 0.45) / 0.35);
      return mix(P.sky[2], P.sky[3], (k - 0.8) / 0.2);
    }
    var bh = HB / n;
    for (i = 0; i < n; i++) { cols.push(col(i / (n - 1))); rect(ctx, 0, Math.floor(i * bh), WB, Math.ceil(bh) + 1, cols[i]); }
    for (i = 1; i < n; i++) { // checker dither between bands
      var y = Math.floor(i * bh);
      ctx.fillStyle = cols[i - 1];
      for (x = 0; x < WB; x += 2) ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = cols[i];
      for (x = 1; x < WB; x += 2) ctx.fillRect(x, y - 1, 1, 1);
    }
    return c;
  }

  // shapes shared by every layer
  function halfDisc(ctx, cx, baseY, r, c) { // a dome sitting on baseY
    for (var dy = 0; dy <= r; dy++) { var w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.3); rect(ctx, cx - w, baseY - 1 - dy, w * 2 + 1, 1, c); }
  }
  function railing(ctx, x, y, w, c) { rect(ctx, x, y, w, 1, c); for (var k = x; k < x + w; k += 3) rect(ctx, k, y, 1, 3, c); }

  // long thin bands of cloud with ragged ends; drawn twice so they wrap round the tile
  function clouds(ctx, r) {
    for (var i = 0; i < 10; i++) {
      var y = Math.round(HB * (0.1 + r() * 0.4)), x = Math.round(r() * TILE), len = 60 + Math.floor(r() * 180), th = 2 + Math.floor(r() * 3);
      for (var k = 0; k < th; k++) {
        var inset = Math.round(Math.abs(k - (th - 1) / 2) * 16 + r() * 10), l = len - inset * 2;
        if (l < 8) continue;
        ctx.fillStyle = rgba(P.cloud, (P.cloudA * (k === 0 ? 1.4 : 1)).toFixed(3));
        for (var w = 0; w < 2; w++) {
          var x0 = x + inset - w * TILE;
          ctx.fillRect(x0, y + k, l, 1);
          for (var e = 2; e < 12; e += 3) { ctx.fillRect(x0 - e, y + k, 1, 1); ctx.fillRect(x0 + l + e - 1, y + k, 1, 1); }
        }
      }
    }
  }

  // neon word signs, in pinks and lilac like the reference
  var SIGN = ['#ff86d8', '#ffaef0', '#e48cff', '#ff9ccc'];
  var BOARD = '#160b2e';
  function signV(L, x, y, word, col, arrow, bracket) { // letters stacked, each lit in its own box; arrow: a bent arrow under them
    var ctx = L.ctx, n = word.length, h = n * 12 - 1 + (arrow ? 10 : 0), i;
    rect(ctx, x - 6, y - 6, 23, h + 12, rgba(col, 0.06));
    rect(ctx, x - 3, y - 3, 17, h + 6, rgba(col, 0.1));
    if (bracket) { var bkx = x + (bracket < 0 ? -3 : 11); rect(ctx, bkx, y + 3, 3, 1, P.midDark); rect(ctx, bkx, y + h - 4, 3, 1, P.midDark); }
    for (i = 0; i < n; i++) {
      var by = y + i * 12;
      rect(ctx, x, by, 11, 11, col);
      rect(ctx, x + 1, by + 1, 9, 9, BOARD);
      text5(ctx, word[i], x + 3, by + 2, col);
    }
    if (arrow) {
      var ay = y + n * 12;
      rect(ctx, x + 3, ay, 1, 6, col); rect(ctx, x + 3, ay + 6, 6, 1, col);
      rect(ctx, x + 7, ay + 4, 1, 5, col); dot(ctx, x + 6, ay + 3, col); dot(ctx, x + 6, ay + 9, col);
    }
    L.neons.push({ x: x, y: y, w: 11, h: h });
  }
  function signH(L, x, y, word, col, legs, legCol) { // a lit board on the roof
    var ctx = L.ctx, w = word.length * 6 + 5, h = 13;
    rect(ctx, x - 6, y - 6, w + 12, h + 12, rgba(col, 0.06));
    rect(ctx, x - 3, y - 3, w + 6, h + 6, rgba(col, 0.1));
    if (legs) { rect(ctx, x + 3, y + h, 1, legs, legCol); rect(ctx, x + w - 4, y + h, 1, legs, legCol); rect(ctx, x + 3, y + h + Math.floor(legs / 2), w - 6, 1, legCol); }
    rect(ctx, x, y, w, h, col);
    rect(ctx, x + 1, y + 1, w - 2, h - 2, BOARD);
    text5(ctx, word, x + 3, y + 3, col);
    L.neons.push({ x: x, y: y, w: w, h: h });
    return w;
  }

  // a grid of windows; lit ones take a colour from wins (some with a blind half down), a few switch on and off later
  function grid(L, x0, y0, x1, y1, ww, wh, sx, sy, p, wins, off, r) {
    var ctx = L.ctx;
    for (var wy = y0; wy + wh <= y1; wy += sy) {
      for (var wx = x0; wx + ww <= x1; wx += sx) {
        if (r() < p) {
          var c = wins[Math.floor(r() * wins.length)], roll = r();
          rect(ctx, wx, wy, ww, wh, c);
          if (wh > 1 && roll < 0.3) rect(ctx, wx, wy, ww, 1, mix(c, off, 0.55));
          else if (roll > 0.9) rect(ctx, wx, wy, ww, wh, mix(c, '#ffffff', 0.3));
          if (r() < 0.04) L.lamps.push({ x: wx, y: wy, w: ww, h: wh, off: off, s: r() });
        } else rect(ctx, wx, wy, ww, wh, off);
      }
    }
  }

  function waterTower(ctx, x, top, T) { // legs, a barrel tank, a pointed cap
    rect(ctx, x + 1, top - 5, 1, 5, T.dark); rect(ctx, x + 8, top - 5, 1, 5, T.dark); rect(ctx, x + 1, top - 3, 8, 1, T.dark);
    rect(ctx, x, top - 13, 10, 8, T.body); rect(ctx, x, top - 13, 1, 8, T.hi); rect(ctx, x + 8, top - 13, 2, 8, T.dark);
    rect(ctx, x, top - 10, 10, 1, T.dark); rect(ctx, x, top - 7, 10, 1, T.dark);
    rect(ctx, x + 1, top - 15, 8, 2, T.hi); rect(ctx, x + 3, top - 17, 4, 2, T.hi); rect(ctx, x + 4, top - 19, 2, 2, T.hi);
  }
  function fireEscape(ctx, x, top, yb, fw, c) { // landings every floor or two, joined by zig-zag stairs
    var step = 12;
    for (var y = top + 12, i = 0; y < yb - 8; y += step, i++) {
      rect(ctx, x, y, fw, 1, c);
      rect(ctx, x, y - 3, fw, 1, c);
      for (var k = x; k < x + fw; k += 3) rect(ctx, k, y - 3, 1, 3, c);
      if (y + step >= yb - 8) break;
      for (var s = 1; s < step; s++) dot(ctx, i % 2 ? x + fw - 2 - Math.round((s - 1) * (fw - 3) / (step - 2)) : x + 1 + Math.round((s - 1) * (fw - 3) / (step - 2)), y + s, c);
    }
  }

  // one building: body, shading, a window grid, things on its roof and walls. T: the colours of its layer
  function block(L, x, top, w, yb, r, T, big) {
    var ctx = L.ctx, k, sizes = big ? [[4, 3, 7, 7], [6, 4, 9, 9], [3, 5, 6, 9], [5, 3, 8, 7]] : [[3, 2, 5, 5], [4, 3, 6, 6], [2, 3, 4, 6], [5, 3, 7, 7]];
    var z = sizes[Math.floor(r() * sizes.length)], ww = z[0], wh = z[1], sx = z[2], sy = z[3];
    rect(ctx, x, top, w, yb - top, T.body);
    rect(ctx, x, top, 1, yb - top, T.hi);
    rect(ctx, x + w - 2, top, 2, yb - top, T.dark);
    rect(ctx, x - 1, top, w + 2, 2, T.hi);
    rect(ctx, x - 1, top + 2, w + 2, 1, T.dark);
    var cols = Math.max(1, Math.floor((w - 6 + (sx - ww)) / sx)), gw = cols * sx - (sx - ww), gx = x + Math.floor((w - gw) / 2);
    grid(L, gx, top + 6, gx + gw, yb - 4, ww, wh, sx, sy, T.p * (0.55 + r() * 0.8), T.wins, T.off, r);
    if (r() < 0.35) for (var fy = top + 6 + wh + 1; fy < yb - 4; fy += sy) rect(ctx, x + 1, fy, w - 3, 1, T.hi);   // floor ledges
    // roof
    var roof = r(), mx;
    if (roof < 0.24 && w > 14) waterTower(ctx, x + 2 + Math.floor(r() * (w - 14)), top, T);
    else if (roof < 0.44) {                                  // antenna with a blinking light
      mx = x + 3 + Math.floor(r() * (w - 6));
      var ah = 9 + Math.floor(r() * 16);
      rect(ctx, mx, top - ah, 1, ah, T.hi);
      for (k = top - ah + 3; k < top - 2; k += 4) rect(ctx, mx - 1, k, 3, 1, T.hi);
      L.beacons.push({ x: mx, y: top - ah - 1, s: r() });
    } else if (roof < 0.58 && w > 22) {                      // a narrower crown with its own windows
      var cw = w - 8 - Math.floor(r() * 8), ch = 8 + Math.floor(r() * 10), cx = x + Math.floor((w - cw) / 2);
      rect(ctx, cx, top - ch, cw, ch, T.body); rect(ctx, cx, top - ch, cw, 1, T.hi); rect(ctx, cx + cw - 2, top - ch, 2, ch, T.dark);
      grid(L, cx + 3, top - ch + 3, cx + cw - 3, top - 1, 2, 2, 4, 4, T.p, T.wins, T.off, r);
    } else if (roof < 0.66 && w > 16) {                      // a dome
      halfDisc(ctx, x + Math.floor(w / 2), top, Math.min(9, Math.floor(w / 2) - 2), T.body);
      halfDisc(ctx, x + Math.floor(w / 2) - 1, top - 1, 2, T.hi);
    }
    if (r() < 0.5) railing(ctx, x - 1, top - 3, w + 2, T.hi);
    for (k = Math.floor(r() * 3); k > 0; k--) { mx = x + 2 + Math.floor(r() * (w - 8)); rect(ctx, mx, top - 3, 5, 3, T.hi); rect(ctx, mx + 1, top - 2, 3, 1, T.dark); }
    // walls: AC units sticking out, sometimes a fire escape
    for (k = 0; k < 3; k++) if (r() < 0.4) { var ay = top + 10 + r() * (yb - top - 24), side = r() < 0.5; rect(ctx, side ? x - 3 : x + w, ay, 3, 3, T.hi); dot(ctx, side ? x - 2 : x + w + 1, ay + 1, T.dark); }
    if (r() < 0.3 && yb - top > 50 && w > 20) fireEscape(ctx, r() < 0.5 ? x + 2 : x + w - 16, top, yb, 13, T.dark);
  }

  // the domed tower far away
  function observatory(L, x, yb, maxH) {
    var ctx = L.ctx, top = Math.round(yb - Math.max(maxH * 1.3, 120)), c = P.tower, hi = P.farHi, k;
    rect(ctx, x - 17, yb - 24, 35, 24, c); rect(ctx, x - 17, yb - 24, 35, 1, hi);
    rect(ctx, x - 11, yb - 36, 23, 12, c); rect(ctx, x - 11, yb - 36, 23, 1, hi);
    for (k = x - 14; k < x + 16; k += 4) rect(ctx, k, yb - 20, 2, 1, P.farWin[1]);
    rect(ctx, x - 4, top + 20, 9, yb - 36 - top - 20, c); rect(ctx, x - 4, top + 20, 1, yb - 36 - top - 20, hi);
    for (k = top + 26; k < yb - 40; k += 4) dot(ctx, x + 1, k, P.farWin[k % 3]);
    for (k = 0; k < 4; k++) {
      var ry = top + 38 + k * 24;
      if (ry > yb - 46) break;
      rect(ctx, x - 8, ry, 17, 3, c); rect(ctx, x - 8, ry, 17, 1, hi);
    }
    rect(ctx, x - 13, top + 12, 27, 8, c); rect(ctx, x - 13, top + 12, 27, 1, hi); rect(ctx, x - 11, top + 20, 23, 2, c);
    for (k = x - 11; k < x + 12; k += 3) rect(ctx, k, top + 15, 2, 2, P.farWin[0]);
    halfDisc(ctx, x, top + 12, 10, c);
    halfDisc(ctx, x - 3, top + 9, 2, hi);
    rect(ctx, x, top - 12, 1, 14, hi); rect(ctx, x - 2, top - 6, 5, 1, hi);
    L.beacons.push({ x: x, y: top - 13, s: 0.3 });
  }

  function genFar() {
    var L = layer(), ctx = L.ctx, r = rng(11), yb = floorB() - 14, x = 0, maxH = Math.max(70, HB * 0.42), i, towerX = 668;
    clouds(ctx, r);
    for (i = 0; i < 60; i++) rect(ctx, 0, yb - 60 + i, TILE, 1, rgba(P.haze, (i / 60 * 0.3).toFixed(3)));   // city glow
    while (x < TILE) {
      var w = Math.min(TILE - x, 12 + Math.floor(r() * 26)), h = Math.floor(30 + Math.pow(r(), 1.4) * maxH), top, rr = rng(100 + x);
      if (x + w > towerX - 20 && x < towerX + 20) h = Math.min(h, Math.floor(maxH * 0.4));   // keep the tower clear
      top = yb - h;
      rect(ctx, x, top, w, yb - top, P.far);
      rect(ctx, x, top, w, 1, P.farHi);
      if (rr() < 0.35 && w > 12) { var sw = w - 6, sh = 4 + Math.floor(rr() * 8); rect(ctx, x + 3, top - sh, sw, sh, P.far); rect(ctx, x + 3, top - sh, sw, 1, P.farHi); }
      var ww = rr() < 0.5 ? 1 : 2, sx = ww + 2, sy = 3 + Math.floor(rr() * 2);
      for (var wy = top + 3; wy < yb - 2; wy += sy) {
        for (var wx = x + 2; wx + ww <= x + w - 2; wx += sx) if (rr() < P.farWinP) rect(ctx, wx, wy, ww, 1, P.farWin[Math.floor(rr() * 3)]);
      }
      if (h > maxH * 0.5 && rr() < 0.6) {
        var ax = x + Math.floor(w / 2), ah = 6 + Math.floor(rr() * 12);
        rect(ctx, ax, top - ah, 1, ah, P.farHi);
        L.beacons.push({ x: ax, y: top - ah - 1, s: rr() });
      }
      x += w + (r() < 0.25 ? 1 + Math.floor(r() * 3) : 0);
    }
    observatory(L, towerX, yb, maxH);
    rect(ctx, 0, yb, TILE, HB - yb, P.far);
    return L;
  }

  function genMid() {
    var L = layer(), ctx = L.ctx, r = rng(23), yb = floorB() - 4, x = 2, maxH = Math.max(90, HB * 0.5), tops = [], signs = [], i;
    var T = { body: P.mid, hi: P.midHi, dark: P.midDark, off: P.midOff, wins: P.midWin, p: P.midWinP };
    var tall = ['HOTEL', 'BAR', 'TAXI', 'KARAOKE', 'ATM'], flat = ['XO', 'CAFE', 'RAMEN', 'OPEN', '24H'], ti = 0, fi = 0;
    L.track = Math.round(floorB() - Math.max(46, HB * 0.2));
    while (x < TILE - 24) {
      var w = Math.min(TILE - 2 - x, 22 + Math.floor(r() * 40)), h = Math.floor(50 + Math.pow(r(), 1.2) * maxH), top = yb - h;
      block(L, x, top, w, yb, rng(500 + x), T, false);
      var sr = r();
      if (sr < 0.07 && w >= 20) signs.push(['h', x, top, w, flat[fi++ % flat.length]]);           // signs kept sparse, so the
      else if (sr < 0.13 && h > 80) signs.push(['v', x, top, w, tall[ti++ % tall.length], r() < 0.4]);   // text stays the focus
      tops.push([x, top, w]);
      x += w + (r() < 0.55 ? 0 : 2 + Math.floor(r() * 8));
    }
    for (i = 0; i < tops.length - 1; i++) {
      if (r() < 0.45) sag(ctx, tops[i][0] + tops[i][2] - 2, tops[i][1] + 4, tops[i + 1][0] + 2, tops[i + 1][1] + 4, 4 + r() * 8, P.midDark);
    }
    var ty = L.track;                                     // elevated track for the train
    rect(ctx, 0, ty, TILE, 4, P.midDark); rect(ctx, 0, ty, TILE, 1, P.midHi);
    for (x = 20; x < TILE; x += 120) { rect(ctx, x, ty + 4, 6, yb - ty, P.midDark); rect(ctx, x, ty + 4, 1, yb - ty, P.midHi); }
    signs.forEach(function (s, k) {
      var col = SIGN[k % SIGN.length];
      if (s[0] === 'h') {
        var sw = s[4].length * 6 + 5;
        signH(L, s[1] + Math.floor((s[3] - sw) / 2), s[2] - 20, s[4], col, 7, P.midDark);
      } else {
        var left = k % 2 === 0;
        signV(L, left ? s[1] - 6 : s[1] + s[3] - 5, s[2] + 10 + Math.floor(r() * 16), s[4], col, s[5], left ? 1 : -1);
      }
    });
    return L;
  }

  function crt(L, x, y, w, h) {
    var ctx = L.ctx;
    rect(ctx, x - 1, y - 1, w + 2, h + 2, OUTLINE);
    rect(ctx, x, y, w, h, P.crt);
    rect(ctx, x, y, w, 1, P.screenHi);
    rect(ctx, x + w - 2, y + 1, 2, h - 1, P.nearHi);
    rect(ctx, x + 2, y + 2, w - 6, h - 5, P.screen);
    rect(ctx, x + w - 3, y + h - 3, 1, 1, '#7cf0a8');
    rect(ctx, x, y, w - 2, h - 1, rgba(P.screenHi, P.glow * 0.6));
    L.screens.push({ x: x + 2, y: y + 2, w: w - 6, h: h - 5, s: hash(x * 3 + y) });
  }

  function fan(L, cx, cy, rr, c, rim) { // a round fan; its blades are drawn each frame, turning
    disc(L.ctx, cx, cy, rr + 1, rim);
    disc(L.ctx, cx, cy, rr, BOARD);
    L.fans.push({ x: cx, y: cy, r: rr, c: c, s: hash(cx * 7 + cy) });
  }

  function genNear() {
    var L = layer(), ctx = L.ctx, r = rng(37), fb = floorB(), x, i;
    var T = { body: P.near, hi: P.nearHi, dark: P.nearDark, off: P.nearOff, wins: P.nearWin, p: P.nearWinP };
    // a few tall buildings close by (one with a BANK board); nothing tall near the start, where the desk is
    var spots = [[296, 64, 'BAR', 1], [520, 80, 'INN', 2], [770, 58, 'ATM', 0]];
    spots.forEach(function (s, k) {
      var bx0 = s[0] + Math.floor(r() * 30), w = s[1] + Math.floor(r() * 14), h = Math.floor(HB * (0.5 + r() * 0.28)), top = fb - h;
      block(L, bx0, top, w, fb, rng(900 + bx0), T, true);
      if (s[3] === 2) {
        signH(L, bx0 + Math.floor((w - 29) / 2), top - 22, 'BANK', SIGN[1], 8, P.nearDark);
        fan(L, bx0 + w - 13, top + Math.floor(h * 0.45), 9, mix(P.edge, '#ffffff', 0.22), P.edge);
      }
    });
    // the back of the rooftop: a low wall with a railing, the city beyond
    var wt = fb - 12;
    rect(ctx, 0, wt - 12, TILE, 1, P.edge); rect(ctx, 0, wt - 11, TILE, 1, P.nearDark); rect(ctx, 0, wt - 6, TILE, 1, P.nearHi);
    for (x = 4; x < TILE; x += 16) rect(ctx, x, wt - 12, 1, 12, P.nearHi);
    rect(ctx, 0, wt, TILE, fb - wt + 4, P.near); rect(ctx, 0, wt, TILE, 1, P.edge);
    for (x = 0; x < TILE; x += 32) rect(ctx, x, wt + 1, 1, fb - wt, P.nearDark);
    // things on the roof (kept low near the start, where the desk is)
    x = 14;
    while (x < TILE - 26) {
      var k = r(), w = 0;
      if (x < 250) k = 0.55 + r() * 0.45;
      if (k < 0.2) w = acUnit(L, x, fb, r);
      else if (k < 0.32) w = crtStack(L, x, fb, r);
      else if (k < 0.42) w = vending(L, x, fb, r);
      else if (k < 0.52) w = vent(L, x, fb, r);
      else if (k < 0.72) w = boxes(L, x, fb, r);
      else if (k < 0.86) w = plant(L, x, fb, r);
      else w = 8;
      x += w + 6 + Math.floor(r() * 20);
    }
    return L;
  }
  function acUnit(L, x, fb, r) { // an air-conditioner with a turning fan
    var ctx = L.ctx, w = 22, h = 15 + Math.floor(r() * 4), y0 = fb - h, k;
    rect(ctx, x - 1, y0 - 1, w + 2, h + 1, OUTLINE);
    rect(ctx, x, y0, w, h, P.boxHi); rect(ctx, x, y0, w, 1, mix(P.boxHi, '#ffffff', 0.2)); rect(ctx, x + w - 2, y0, 2, h, P.box);
    for (k = 0; k < Math.floor((h - 4) / 2); k++) rect(ctx, x + 15, y0 + 3 + k * 2, 4, 1, P.box);
    fan(L, x + 7, y0 + Math.floor(h / 2), 4, P.boxHi, OUTLINE);
    return w;
  }
  function vent(L, x, fb, r) { // a vent pipe with a cap
    var ctx = L.ctx, h = 16 + Math.floor(r() * 12);
    rect(ctx, x + 1, fb - h, 6, h, OUTLINE); rect(ctx, x + 2, fb - h, 4, h, P.boxHi); rect(ctx, x + 2, fb - h, 1, h, mix(P.boxHi, '#ffffff', 0.2));
    rect(ctx, x - 1, fb - h - 3, 10, 4, OUTLINE); rect(ctx, x, fb - h - 2, 8, 2, P.boxHi);
    return 9;
  }
  function crtStack(L, x, fb, r) {
    var n = 1 + Math.floor(r() * 3), y = fb, maxW = 0;
    for (var i = 0; i < n; i++) {
      var w = 18 + Math.floor(r() * 8), h = 14 + Math.floor(r() * 4), ox = Math.floor((r() - 0.5) * 4);
      crt(L, x + ox, y - h, w, h);
      y -= h + 1; maxW = Math.max(maxW, w);
    }
    return maxW;
  }
  function vending(L, x, fb, r) {
    var ctx = L.ctx, w = 24, h = 48, y0 = fb - h, i, j;
    L.vends.push(x);                       // she can walk over for a drink
    rect(ctx, x - 3, y0 - 3, w + 6, h + 3, rgba('#e6d8ff', P.glow));
    rect(ctx, x - 1, y0 - 1, w + 2, h + 1, OUTLINE);
    rect(ctx, x, y0, w, h, '#9b8ad6'); rect(ctx, x + w - 3, y0, 3, h, '#7a68b8');
    rect(ctx, x + 2, y0 + 3, 15, 28, '#efe6ff');
    for (j = 0; j < 4; j++) for (i = 0; i < 4; i++) rect(ctx, x + 3 + i * 4, y0 + 5 + j * 7, 2, 4, NEON[Math.floor(r() * NEON.length)]);
    rect(ctx, x + 18, y0 + 6, 3, 6, '#231a47'); rect(ctx, x + 18, y0 + 14, 3, 2, '#ff6fb5');
    rect(ctx, x + 3, y0 + 36, 14, 6, '#231a47');
    return w;
  }
  function boxes(L, x, fb, r) {
    var ctx = L.ctx, n = 1 + Math.floor(r() * 3), y = fb, mw = 0;
    for (var i = 0; i < n; i++) {
      var w = 12 + Math.floor(r() * 8), h = 9 + Math.floor(r() * 4), ox = Math.floor((r() - 0.5) * 5);
      rect(ctx, x + ox - 1, y - h - 1, w + 2, h + 1, OUTLINE);
      rect(ctx, x + ox, y - h, w, h, P.box); rect(ctx, x + ox, y - h, w, 1, P.boxHi);
      rect(ctx, x + ox + Math.floor(w / 2), y - h, 1, h, P.near);
      y -= h + 1; mw = Math.max(mw, w);
    }
    return mw;
  }
  function plant(L, x, fb, r) {
    var ctx = L.ctx, h = 10 + Math.floor(r() * 14);
    rect(ctx, x + 1, fb - 7, 9, 7, P.nearHi); rect(ctx, x, fb - 8, 11, 2, P.edge);
    for (var i = 0; i < 9; i++) {
      var a = -1.2 + i * 0.3, len = h * (0.5 + r() * 0.5);
      for (var k = 0; k < len; k++) dot(ctx, x + 5 + Math.sin(a) * k * 0.6, fb - 8 - k, P.plant[k > len * 0.6 ? 2 : k > len * 0.3 ? 1 : 0]);
    }
    return 11;
  }

  var EDGE_NEON = '#ff86d8';
  function genGroundTile() { // the rooftop: concrete with puddles, a coping stone, a pink neon strip along the edge
    var c = canvas(TILE_F, FRONT_H), ctx = c.getContext('2d'), r = rng(5), gy = gyF(), i, x;
    rect(ctx, 0, gy, TILE_F, 6, P.floor);
    rect(ctx, 0, gy, TILE_F, 1, P.floorHi);
    for (x = 0; x < TILE_F; x += 24) rect(ctx, x, gy + 1, 1, 5, P.floorDark);
    for (i = 0; i < TILE_F / 3; i++) dot(ctx, r() * TILE_F, gy + 1 + r() * 5, r() < 0.5 ? P.floorDark : P.floorHi);
    for (i = 0; i < 6; i++) { // puddles with neon reflections
      var px0 = r() * (TILE_F - 40), pw = 14 + r() * 26;
      rect(ctx, px0, gy + 3, pw, 2, '#5e4f9e');
      rect(ctx, px0 + 2, gy + 2, pw - 4, 1, '#5e4f9e');
      dot(ctx, px0 + pw * 0.3, gy + 3, '#ff9ccc'); dot(ctx, px0 + pw * 0.6, gy + 4, '#d6b4ff');
    }
    rect(ctx, 0, gy + 6, TILE_F, 2, P.floorHi);                                // coping stones
    for (x = 0; x < TILE_F; x += 12) dot(ctx, x, gy + 7, P.floorDark);
    rect(ctx, 0, gy + 8, TILE_F, 1, '#120a26');
    rect(ctx, 0, gy + 9, TILE_F, 1, EDGE_NEON);                                // neon edge light
    rect(ctx, 0, gy + 10, TILE_F, GROUND - 10, P.face);
    for (x = 0; x < TILE_F; x += 32) { rect(ctx, x, gy + 10, 1, GROUND - 10, P.faceDark); dot(ctx, x + 3, gy + 12, P.floorDark); dot(ctx, x + 28, gy + 12, P.floorDark); }
    for (i = 0; i < 4; i++) { // vents
      var vx = Math.floor(r() * (TILE_F - 20));
      for (var k = 0; k < 4; k++) rect(ctx, vx, gy + 12 + k * 2, 14, 1, P.faceDark);
    }
    rect(ctx, 0, FRONT_H - 2, TILE_F, 2, P.faceDark);
    return c;
  }

  function buildScenery() {
    sky = genSky();
    far = genFar();
    mid = genMid();
    near = genNear();
    groundTile = genGroundTile();
  }

  function resize() {
    var cw = document.documentElement.clientWidth || window.innerWidth;
    S = cw > 2400 ? 3 : 2;
    WB = WF = Math.ceil(cw / S);
    HB = Math.ceil(window.innerHeight / S);
    back.width = WB; back.height = HB;
    back.style.width = (WB * S) + 'px'; back.style.height = (HB * S) + 'px';
    front.width = WF; front.height = FRONT_H;
    front.style.width = (WF * S) + 'px'; front.style.height = (FRONT_H * S) + 'px';
    document.documentElement.style.setProperty('--ground', (GROUND * S) + 'px');
    bx.imageSmoothingEnabled = false; fx.imageSmoothingEnabled = false;
    cam = prevCam = targetCam();
    cxF = cxB = cam / S;
    girl.x = girl.x == null ? home() : clamp(girl.x, 20, WF - 20);
    buildScenery();
  }

  /* ---------- backdrop: per frame ---------- */
  function drawStars() {
    var count = Math.round(WB * HB / 900 * P.stars);
    for (var i = 0; i < count; i++) {
      var x = Math.floor(hash(i * 3 + 1) * WB), y = Math.floor(hash(i * 5 + 2) * HB * 0.6);
      var tw = hash(i * 7 + Math.floor(t * 1.5 + hash(i) * 10));
      if (tw < 0.15) continue;
      dot(bx, x, y, tw > 0.85 ? '#ffffff' : (i % 3 ? '#fff0f8' : '#cdd7ff'));
      if (tw > 0.97) { dot(bx, x - 1, y, 'rgba(255,255,255,.5)'); dot(bx, x + 1, y, 'rgba(255,255,255,.5)'); dot(bx, x, y - 1, 'rgba(255,255,255,.5)'); dot(bx, x, y + 1, 'rgba(255,255,255,.5)'); }
    }
  }
  function drawMoon() {
    var x = Math.round(WB * 0.84), y = Math.round(HB * 0.15) + 20;
    disc(bx, x, y, 17, rgba(P.moon[0], 0.06));
    disc(bx, x, y, 13, rgba(P.moon[0], 0.1));
    disc(bx, x, y, 9, P.moon[0]);
    disc(bx, x + 3, y - 2, 2, P.moon[1]); disc(bx, x - 3, y + 3, 1, P.moon[1]); dot(bx, x - 1, y - 4, P.moon[1]);
  }
  function drawShootingStars() { // a pink streak across the sky every few seconds
    for (var lane = 0; lane < 2; lane++) {
      var per = 3.1 + lane * 1.7, k = Math.floor((t + lane * 1.3) / per), e = t + lane * 1.3 - k * per;
      if (hash(k * 13 + lane) > 0.75 || e > 1) continue;
      var sx = (0.2 + hash(k * 7 + lane) * 0.85) * WB, sy = 8 + hash(k * 5 + lane) * HB * 0.32, len = 16 + hash(k) * 18;
      var hx = sx - e * 150, hy = sy + e * 75, fade = 1 - e;
      for (var i = 0; i < len; i++) dot(bx, hx + i, hy - i * 0.5, rgba(i < 2 ? '#ffffff' : P.streak, ((1 - i / len) * fade).toFixed(2)));
      dot(bx, hx - 1, hy, rgba(P.streak, fade)); dot(bx, hx, hy + 1, rgba(P.streak, fade)); dot(bx, hx, hy - 1, rgba(P.streak, fade));
    }
    var we = t - wishAt;                 // the one she turned round to watch: a long, bright streak right above her
    if (we >= 0 && we < 1.4) {
      var wx = girl.x + 90 - we * 130, wy = 14 + HB * 0.08 + we * 62, wl = 40, wf = Math.min(1, (1.4 - we) * 2);
      for (var j = 0; j < wl; j++) dot(bx, wx + j, wy - j * 0.48, rgba(j < 3 ? '#ffffff' : P.streak, ((1 - j / wl) * wf).toFixed(2)));
      rect(bx, wx - 1, wy - 1, 3, 3, rgba(P.streak, (wf * 0.6).toFixed(2))); dot(bx, wx, wy, '#ffffff');
    }
  }
  function drawScreen(sc, X, Y) { // a shooting star sliding across a monitor, now and then a rolling scanline
    var p = mod(t * (0.45 + sc.s * 0.35) + sc.s * 7, 1.7);
    if (p < 1.25) {
      var hx = X + sc.w - 1 - p * (sc.w + 4), hy = Y - 1 + p * (sc.h + 2);
      for (var k = 0; k < 7; k++) {
        var px0 = Math.round(hx + k), py0 = Math.round(hy - k * 0.55);
        if (px0 >= X && px0 < X + sc.w && py0 >= Y && py0 < Y + sc.h) dot(bx, px0, py0, k < 1 ? '#ffffff' : rgba(P.streak, (1 - k / 7).toFixed(2)));
      }
    }
    var ly = Math.floor(mod(t * 14 + sc.s * 40, sc.h * 4));
    if (ly < sc.h) rect(bx, X, Y + ly, sc.w, 1, 'rgba(255,255,255,.12)');
  }
  function drawLayer(L, par) {
    var off = mod(Math.round(cxB * par), TILE), i;
    for (var x0 = -off; x0 < WB; x0 += TILE) {
      bx.drawImage(L.c, x0, 0);
      for (i = 0; i < L.screens.length; i++) { var sc = L.screens[i]; if (x0 + sc.x + sc.w > 0 && x0 + sc.x < WB) drawScreen(sc, x0 + sc.x, sc.y); }
      for (i = 0; i < L.leds.length; i++) {
        var l = L.leds[i], lx = x0 + l.x;
        if (lx < 0 || lx >= WB) continue;
        dot(bx, lx, l.y, hash(i * 7 + Math.floor(t * (1.5 + l.s * 4))) > 0.3 ? l.c : '#120a26');
      }
      for (i = 0; i < L.beacons.length; i++) {
        var b = L.beacons[i];
        if ((t + b.s * 2) % 1.6 < 0.35) { var bxp = x0 + b.x; rect(bx, bxp - 1, b.y - 1, 3, 3, 'rgba(255,90,106,.3)'); dot(bx, bxp, b.y, '#ff5a6a'); }
      }
      for (i = 0; i < L.neons.length; i++) { // the odd flicker
        var n = L.neons[i];
        if (hash(i * 31 + Math.floor(t * 12)) < 0.02) rect(bx, x0 + n.x, n.y, n.w, n.h, 'rgba(18,8,40,.72)');
      }
      for (i = 0; i < L.lamps.length; i++) { // now and then someone switches a light off, and later on again
        var lp = L.lamps[i], lpx = x0 + lp.x;
        if (lpx + lp.w > 0 && lpx < WB && hash(i * 13 + Math.floor(t * 0.2 + lp.s * 9)) < 0.35) rect(bx, lpx, lp.y, lp.w, lp.h, lp.off);
      }
      for (i = 0; i < L.fans.length; i++) { // turning fan blades
        var f = L.fans[i], fxp = x0 + f.x;
        if (fxp + f.r < 0 || fxp - f.r >= WB) continue;
        for (var bl = 0; bl < 3; bl++) {
          var ang = t * 2.4 + f.s * 6 + bl * 2.094;
          for (var q = 1; q < f.r; q++) {
            dot(bx, fxp + Math.cos(ang) * q, f.y + Math.sin(ang) * q, f.c);
            if (q > f.r / 2) dot(bx, fxp + Math.cos(ang + 0.35) * q, f.y + Math.sin(ang + 0.35) * q, f.c);
          }
        }
        dot(bx, fxp, f.y, f.c);
      }
    }
  }
  function drawDrones() {
    for (var i = 0; i < 3; i++) {
      var dir = i % 2 ? -1 : 1, span = WB + 60, sp = 14 + i * 5;
      var x = dir > 0 ? mod(t * sp + i * 210 - cxB * PAR.drones, span) - 30 : WB + 30 - mod(t * sp + i * 160 + cxB * PAR.drones, span);
      var y = Math.round(HB * (0.22 + i * 0.09) + Math.sin(t * 1.3 + i) * 3);
      var img = DRONE[Math.floor(t * 12 + i) % 2];
      bx.drawImage(img, Math.round(x), y);
      if ((t + i) % 1 < 0.15) dot(bx, Math.round(x) + 5, y + 6, '#ff5a6a');
    }
  }
  function updateTrain(dt) {
    if (!train.on) {
      if (t > train.next && !reduce) { train.on = true; train.dir = hash(Math.floor(t)) < 0.5 ? 1 : -1; train.x = (train.dir > 0 ? -220 : WB + 20) + cxB * PAR.mid; }
      return;
    }
    train.x += train.dir * 95 * dt;
    var sx = train.x - cxB * PAR.mid;
    if ((train.dir > 0 && sx > WB + 30) || (train.dir < 0 && sx < -230)) { train.on = false; train.next = t + 12 + hash(Math.floor(t * 3)) * 14; }
  }
  function drawTrain() {
    if (!train.on) return;
    var sx = Math.round(train.x - cxB * PAR.mid), ty = mid.track - 9;
    for (var c = 0; c < 4; c++) {
      var x = sx + c * 50;
      rect(bx, x, ty, 48, 9, P.train); rect(bx, x, ty, 48, 1, P.trainHi); rect(bx, x, ty + 8, 48, 1, '#120a26');
      for (var w = 3; w < 45; w += 5) rect(bx, x + w, ty + 2, 3, 3, (c * 7 + w) % 3 ? '#ffd9f4' : '#c9b0ff');
      rect(bx, x, ty + 6, 48, 1, '#ff6fb5');
    }
    var nose = train.dir > 0 ? sx + 199 : sx - 2;
    rect(bx, nose, ty + 2, 2, 5, '#fff6d0');
    rect(bx, train.dir > 0 ? nose + 2 : nose - 14, ty + 3, 14, 3, 'rgba(255,246,208,.15)');
  }
  function drawHome() { // the cosy desk where the walk starts: fish tank, terminal, and a counter
    var x = home() - 150 - Math.round(cxB * PAR.near), fb = floorB(), i;
    if (x < -130 || x > WB + 10) return;
    // fish tank on a cabinet
    rect(bx, x - 1, fb - 13, 40, 14, OUTLINE); rect(bx, x, fb - 12, 38, 13, P.nearHi); rect(bx, x, fb - 12, 38, 1, P.edge);
    rect(bx, x + 17, fb - 8, 4, 1, P.edge);
    var tx = x + 1, ty = fb - 36;
    rect(bx, tx - 3, ty - 3, 42, 28, rgba(P.water, 0.12));
    rect(bx, tx - 1, ty - 1, 38, 25, OUTLINE);
    rect(bx, tx, ty, 36, 23, '#160e33');
    rect(bx, tx + 1, ty + 3, 34, 19, P.water); rect(bx, tx + 1, ty + 3, 34, 1, P.waterHi);
    rect(bx, tx + 1, ty + 19, 34, 3, '#c9b58f'); rect(bx, tx + 1, ty + 19, 34, 1, '#e3d3ac');
    for (i = 0; i < 3; i++) for (var k = 0; k < 6 + i * 2; k++) dot(bx, tx + 6 + i * 11 + Math.round(Math.sin(t * 2 + k * 0.6 + i) * 0.8), ty + 18 - k, i === 1 ? '#7fd1a6' : '#4fa982');
    var FISH = ['#ff9ccc', '#ffd27a', '#9fe8ff'];
    for (i = 0; i < 3; i++) {
      var sp = 6 + i * 3, ph = mod(t * sp + i * 17, 56), dir = ph < 28 ? 1 : -1, fxp = tx + 3 + (dir > 0 ? ph : 56 - ph);
      var fyp = ty + 7 + i * 4 + Math.round(Math.sin(t * 1.5 + i * 2) * 1.2);
      rect(bx, fxp, fyp, 3, 2, FISH[i]); dot(bx, fxp - dir, fyp + (Math.floor(t * 6) % 2), FISH[i]);
      dot(bx, dir > 0 ? fxp + 2 : fxp, fyp, '#160e33');
    }
    for (i = 0; i < 4; i++) { var bp = mod(t * 9 + i * 5, 16); dot(bx, tx + 28 + (i % 2), ty + 18 - bp, 'rgba(255,255,255,.7)'); }
    // desk with a terminal, a keyboard, a counter and a tower
    var dx = x + 50, top = fb - 22;
    rect(bx, dx + 40, fb - 20, 11, 20, OUTLINE); rect(bx, dx + 41, fb - 19, 9, 19, P.nearDark);
    for (i = 0; i < 4; i++) dot(bx, dx + 43, fb - 16 + i * 4, hash(i + Math.floor(t * 3)) > 0.4 ? '#7cf0a8' : '#120a26');
    rect(bx, dx, top, 60, 3, P.nearHi); rect(bx, dx, top, 60, 1, P.edge);
    rect(bx, dx + 2, top + 3, 2, 19, P.nearDark); rect(bx, dx + 56, top + 3, 2, 19, P.nearDark);
    var cx0 = dx + 5, cy0 = top - 21;
    rect(bx, cx0 - 3, cy0 - 3, 33, 26, rgba('#7cf0a8', P.glow * 0.5));
    rect(bx, cx0 - 1, cy0 - 1, 29, 22, OUTLINE);
    rect(bx, cx0, cy0, 27, 20, P.crt); rect(bx, cx0, cy0, 27, 1, P.screenHi);
    rect(bx, cx0 + 3, cy0 + 3, 19, 13, '#0b1f1a');
    var scroll = Math.floor(t * 1.4);
    for (i = 0; i < 4; i++) rect(bx, cx0 + 4, cy0 + 4 + i * 3, 3 + Math.floor(hash(i + scroll) * 14), 1, i === 3 && t % 1 < 0.5 ? '#0b1f1a' : '#7cf0a8');
    rect(bx, cx0 + 8, top - 1, 11, 1, P.nearDark);
    rect(bx, dx + 34, top - 2, 16, 2, '#6a5aa0'); rect(bx, dx + 34, top - 2, 16, 1, '#8d7dc4');
    rect(bx, dx + 36, top - 12, 21, 9, OUTLINE); rect(bx, dx + 37, top - 11, 19, 7, '#170c14');
    var n = ('0000' + found).slice(-4);
    text3(bx, n, dx + 38, top - 10, '#ff5a4a');
  }
  function drawMotes() {
    for (var i = 0; i < 16; i++) {
      var x = mod(hash(i * 9) * WB + Math.sin(t * 0.5 + i) * 18 - cxB * PAR.motes, WB);
      var y = floorB() - mod(t * (4 + hash(i) * 5) + hash(i * 4 + 1) * HB * 0.6, HB * 0.6);
      if (Math.sin(t * 2.2 + i * 1.7) < -0.3) continue;
      dot(bx, x, y, rgba(i % 2 ? P.mote : '#5ee6ff', night ? 0.8 : 0.45));
    }
  }

  function drawBack() {
    bx.drawImage(sky, 0, 0);
    drawStars();
    drawMoon();
    drawShootingStars();
    drawLayer(far, PAR.far);
    drawDrones();
    drawLayer(mid, PAR.mid);
    drawTrain();
    drawLayer(near, PAR.near);
    drawHome();
    drawMotes();
    drawVeil();
  }
  function drawVeil() { // darkens the city behind the page's text column (about 1060 CSS px), fading out to the sides and the rooftop
    var col = Math.min(WB, Math.round(1060 / S)), edge = Math.round(140 / S), x0 = Math.round((WB - col) / 2), fb = floorB();
    var a = night ? 0.42 : 0.36, c = night ? '10,6,30' : '24,14,64', k = edge / (col + 2 * edge);
    var g = bx.createLinearGradient(x0 - edge, 0, x0 + col + edge, 0);
    g.addColorStop(0, 'rgba(' + c + ',0)'); g.addColorStop(k, 'rgba(' + c + ',' + a + ')');
    g.addColorStop(1 - k, 'rgba(' + c + ',' + a + ')'); g.addColorStop(1, 'rgba(' + c + ',0)');
    bx.fillStyle = g;
    bx.fillRect(0, 0, WB, fb - 60);
    for (var y = 0; y < 60; y += 4) { bx.globalAlpha = 1 - y / 60; bx.fillRect(0, fb - 60 + y, WB, 4); }
    bx.globalAlpha = 1;
  }

  /* ---------- foreground ---------- */
  // benches along the rooftop, one every few slots; she walks over and sits on them (the seat is 11px up, to match her sitting frames)
  var SLOT = 34, BENCH_EVERY = 9, BENCH_W = 26, SIT_DX = 6;
  function isBench(k) { return mod(k, BENCH_EVERY) === 4; }
  function benchLeft(k) { return k * SLOT + 4; }
  function drawBench(x, gy) {
    rect(fx, x + 1, gy - 10, 4, 10, OUTLINE); rect(fx, x + BENCH_W - 5, gy - 10, 4, 10, OUTLINE);
    rect(fx, x + 2, gy - 9, 2, 9, '#45397e'); rect(fx, x + BENCH_W - 4, gy - 9, 2, 9, '#45397e');
    rect(fx, x + 4, gy - 5, BENCH_W - 8, 1, '#352a64');
    rect(fx, x - 1, gy - 12, BENCH_W + 2, 4, OUTLINE);
    rect(fx, x, gy - 11, BENCH_W, 2, '#6a5ca6'); rect(fx, x, gy - 11, BENCH_W, 1, '#9a8cd0');
  }
  function nearestBench() { // centre of the closest bench on screen (front px), or null
    var cx = Math.round(cxF), best = null;
    for (var k = Math.floor(cx / SLOT) - 1; k <= Math.floor((cx + WF) / SLOT) + 1; k++) {
      if (!isBench(k)) continue;
      var c = benchLeft(k) + BENCH_W / 2 - cx;
      if (c < 30 || c > WF - 30) continue;
      if (best === null || Math.abs(c - girl.x) < Math.abs(best - girl.x)) best = c;
    }
    return best;
  }

  function drawDecor(cx) {
    var slot = SLOT, gy = FLOOR(), k0 = Math.floor(cx / slot) - 1, k1 = Math.floor((cx + WF) / slot) + 1;
    for (var k = k0; k <= k1; k++) {
      if (isBench(k)) { drawBench(benchLeft(k) - cx, gy); continue; }
      var x = k * slot + Math.floor(hash(k * 17 + 1) * 18) - cx;
      if (hash(Math.floor(k / 4) * 31 + 7) < 0.14) { // railing runs
        var rx = k * slot - cx;
        rect(fx, rx, gy - 13, slot, 1, '#9284c8'); rect(fx, rx, gy - 12, slot, 1, '#352a64');
        rect(fx, rx, gy - 7, slot, 1, '#6a5ca6');
        for (var p = 4; p < slot; p += 15) { rect(fx, rx + p - 1, gy - 14, 3, 14, OUTLINE); rect(fx, rx + p, gy - 13, 1, 13, '#a596d0'); }
        continue;
      }
      var r = hash(k * 13 + 5);
      if (hash(k * 29 + 3) < 0.5) continue;           // every other slot left bare, so the rooftop stays calm
      if (r < 0.1) {                                   // traffic cone
        rect(fx, x - 1, gy - 1, 9, 2, OUTLINE); rect(fx, x, gy - 1, 7, 1, '#2e2648');
        for (var c = 0; c < 9; c++) { var hw = Math.floor(c / 3); rect(fx, x + 3 - hw - 1, gy - 10 + c, hw * 2 + 3, 1, c === 4 || c === 5 ? '#f2f2f7' : '#ff7a4a'); }
        dot(fx, x + 2, gy - 10, OUTLINE); dot(fx, x + 4, gy - 10, OUTLINE);
      } else if (r < 0.2) {                            // crates
        rect(fx, x - 1, gy - 11, 16, 11, OUTLINE); rect(fx, x, gy - 10, 14, 10, '#5f4f96'); rect(fx, x, gy - 10, 14, 1, '#7a6ab0');
        rect(fx, x + 6, gy - 10, 2, 10, '#4a3c7c');
        if (hash(k * 5) < 0.5) { rect(fx, x + 2, gy - 18, 10, 7, OUTLINE); rect(fx, x + 3, gy - 17, 8, 6, '#6c5ca2'); rect(fx, x + 3, gy - 17, 8, 1, '#8676bc'); }
      } else if (r < 0.27) {                           // a little CRT left on the floor
        rect(fx, x - 1, gy - 12, 16, 12, OUTLINE); rect(fx, x, gy - 11, 14, 11, '#9a8cc8'); rect(fx, x + 2, gy - 9, 9, 6, '#6a4fd8');
        var p2 = mod(t * 0.7 + k, 1.4);
        if (p2 < 1) dot(fx, x + 10 - Math.round(p2 * 9), gy - 9 + Math.round(p2 * 5), '#ffb0d8');
      } else if (r < 0.34) {                           // cable coil
        disc(fx, x + 5, gy - 3, 4, OUTLINE); disc(fx, x + 5, gy - 3, 3, '#2c2446'); disc(fx, x + 5, gy - 3, 1, OUTLINE);
        rect(fx, x + 9, gy - 1, 10, 1, '#2c2446'); dot(fx, x + 19, gy - 1, '#ff6fb5');
      } else if (r < 0.4) {                            // potted plant
        rect(fx, x, gy - 6, 8, 6, '#6a5ca6'); rect(fx, x - 1, gy - 7, 10, 2, '#9284c8');
        for (var l = 0; l < 7; l++) for (var j = 0; j < 4 + (l % 3) * 2; j++) dot(fx, x + 4 + Math.round(Math.sin(-1 + l * 0.35) * j * 0.7), gy - 8 - j, j > 4 ? '#7fd1a6' : '#4fa982');
      } else if (r < 0.46) {                           // bollard with a glowing cap
        rect(fx, x - 1, gy - 12, 6, 12, OUTLINE); rect(fx, x, gy - 11, 4, 11, '#6a5ca6'); rect(fx, x, gy - 11, 1, 11, '#9284c8');
        rect(fx, x - 2, gy - 15, 8, 4, 'rgba(94,230,255,.25)'); rect(fx, x, gy - 13, 4, 2, '#5ee6ff');
      } else if (r < 0.52) {                           // flyers on the floor
        rect(fx, x, gy - 1, 7, 1, '#e8eeff'); rect(fx, x + 5, gy, 6, 1, '#cfdcff'); dot(fx, x + 2, gy - 1, '#ff9ccc');
      }
    }
  }

  function drawKiosks(cx) { // one per section; it lights up green with a star once you have seen that section
    var gy = FLOOR();
    for (var i = 0; i < markers.length; i++) {
      var x = Math.round(markers[i] * WALK / S + home() + 16 - cx);
      if (x < -20 || x > WF + 20) continue;
      var on = !!done[i];
      rect(fx, x - 2, gy - 18, 5, 18, OUTLINE); rect(fx, x - 1, gy - 17, 3, 17, '#45397e'); rect(fx, x - 1, gy - 17, 1, 17, '#6a5ca6');
      rect(fx, x - 5, gy - 1, 11, 2, '#2f2658');
      if (on) rect(fx, x - 13, gy - 36, 27, 21, 'rgba(124,240,168,.18)');
      rect(fx, x - 11, gy - 34, 23, 17, OUTLINE);
      rect(fx, x - 10, gy - 33, 21, 15, '#2e2560'); rect(fx, x - 10, gy - 33, 21, 1, '#574a96');
      rect(fx, x - 8, gy - 31, 17, 11, on ? '#7cf0a8' : '#140e30');
      if (on) {
        var ck = [[-4, -26], [-3, -25], [-2, -24], [-1, -25], [0, -26], [1, -27], [2, -28], [3, -29]];
        ck.forEach(function (p) { dot(fx, x + p[0], gy + p[1], '#0e3a24'); dot(fx, x + p[0], gy + p[1] + 1, '#0e3a24'); });
        var sy = gy - 43 + (Math.floor(t * 2 + i) % 2);  // star bobbing above
        rect(fx, x - 1, sy, 3, 5, '#ffbf4d'); rect(fx, x - 3, sy + 2, 7, 1, '#ffbf4d'); dot(fx, x, sy + 1, '#fff3c4');
      } else {
        if (t % 1 < 0.6) rect(fx, x - 6, gy - 22, 3, 1, '#5ee6ff');
        rect(fx, x - 6, gy - 29, 7, 1, '#3d2f7a'); rect(fx, x - 6, gy - 27, 10, 1, '#3d2f7a'); rect(fx, x - 6, gy - 25, 5, 1, '#3d2f7a');
        if (girl.mode === 'act' && girl.act.kiosk === i) { // she is typing on it: her lines appear, a letter at a time
          var typed = Math.max(0, Math.floor((t - girl.since - 0.5) * 8)), LINES = [7, 12, 4, 10];
          for (var ln = 0; ln < LINES.length && typed > 0; ln++) {
            rect(fx, x - 6, gy - 30 + ln * 2, Math.min(typed, LINES[ln]), 1, '#5ee6ff'); typed -= LINES[ln];
          }
        }
      }
    }
  }

  // the cats: one in roughly every third 170px slot, never in the two slots at the start
  var CRIT = 170;
  function isCat(k) { return k !== 0 && k !== -1 && hash(k * 101 + 9) < 0.34; }
  function critterX(k) { return k * CRIT + 40 + Math.floor(hash(k * 41) * 60); }   // world px, left edge
  function catFlip(k) { return hash(k * 7) < 0.5 ? 0 : 1; }                          // 1: mirrored, head on the right
  function catSpots() { // cats on screen: the middle of each one's head, in front px
    var cx = Math.round(cxF), out = [];
    for (var k = Math.floor(cx / CRIT) - 1; k <= Math.floor((cx + WF) / CRIT) + 1; k++) {
      if (isCat(k)) out.push({ x: critterX(k) - cx + (catFlip(k) ? 9 : 5), opt: k });
    }
    return out;
  }
  function pettedCat() { return girl.mode === 'act' && girl.act.cat !== undefined ? girl.act.cat : null; }
  function drawCritters(cx) {
    var slot = CRIT, gy = FLOOR(), k0 = Math.floor(cx / slot) - 1, k1 = Math.floor((cx + WF) / slot) + 1;
    for (var k = k0; k <= k1; k++) {
      if (k === 0 || k === -1) continue; // keep the start clear
      var r = hash(k * 101 + 9), ph = hash(k * 37) * 6.28, base = critterX(k) - cx, img;
      if (r < 0.34) {                                      // a cat sitting, blinking (eyes shut and content while she pets it)
        var set = CATS[hash(k * 3) < 0.6 ? 0 : 1], blink = mod(t + ph, 4) < 0.15 || pettedCat() === k;
        img = (blink ? set.blink : set.front)[catFlip(k)];
        fx.drawImage(img, Math.round(base), gy - img.height + 1);
      } else if (r < 0.46) {                               // a patrol robot going back and forth
        var a = t * 0.5 + ph, bxp = base + Math.sin(a) * 26, dir = Math.cos(a) >= 0 ? 0 : 1;
        img = BOT[dir];
        var bob = Math.floor(t * 8) % 2;
        fx.drawImage(img, Math.round(bxp), gy - img.height + 1 - bob * 0);
        var vx = Math.round(bxp) + 2 + Math.floor(mod(t * 4 + ph, 1) * 7);
        dot(fx, vx, gy - img.height + 5, '#5ee6ff');
        if ((t + ph) % 1 < 0.5) dot(fx, Math.round(bxp) + 5, gy - img.height + 1, '#ff5a6a');
      }
    }
  }

  function drawButterflies() { // little holographic butterflies
    var cols = ['#5ee6ff', '#ff8fd0', '#b6f7ff'], gy = FLOOR();
    for (var i = 0; i < 3; i++) {
      var x = Math.round(mod(hash(i * 5 + 2) * WF + Math.sin(t * 0.6 + i * 2) * 30 + t * 6, WF));
      var y = Math.round(gy - 18 - Math.abs(Math.sin(t * 1.3 + i)) * 16);
      var open = Math.floor(t * 9 + i) % 2;
      rect(fx, x - 3, y - 2, 7, 5, rgba(cols[i], 0.15));
      if (open) { rect(fx, x - 2, y - 1, 2, 2, cols[i]); rect(fx, x + 1, y - 1, 2, 2, cols[i]); dot(fx, x - 1, y + 1, cols[i]); dot(fx, x + 1, y + 1, cols[i]); }
      else { rect(fx, x - 1, y - 1, 1, 2, cols[i]); rect(fx, x + 1, y - 1, 1, 2, cols[i]); }
      rect(fx, x, y - 1, 1, 3, '#ffffff');
    }
  }

  /* ---------- the girl: what she does ---------- */
  var RUN_FPS = 12;                       // her run cycle shows at most this many frames a second, however fast the page scrolls
  var WALK_SPEED = 40, DASH_SPEED = 80;   // front px per second: a stroll, and a happy sprint (80 = 12 run frames a second)
  function stepRun(px, dt) { if (G) girl.runF += Math.min(px / G.anim.run.len * 6, RUN_FPS * dt); }
  var TURN = 0.09;                        // seconds on each in-between frame when she turns
  // a timeline: [[frame, seconds, facing?], ...] -> { dur, at(e) }; facing (1 / -1) turns her, 0 leaves it
  function hold(list) {
    var dur = list.reduce(function (s, x) { return s + x[1]; }, 0);
    return {
      dur: dur,
      at: function (e) { for (var i = 0, acc = 0; i < list.length; i++) { acc += list[i][1]; if (e < acc) return list[i]; } return list[list.length - 1]; },
      into: function (e) { for (var i = 0, acc = 0; i < list.length; i++) { if (e < acc + list[i][1]) return e - acc; acc += list[i][1]; } return 0; }
    };
  }
  function breathe(pose, secs, face) { // hold a pose, sinking 1px on each out-breath
    var l = [], n = Math.max(1, Math.round(secs / 0.75));
    for (var i = 0; i < n; i++) l.push([i % 2 ? pose + 'B' : pose, secs / n, face || 0]);
    return l;
  }
  function turnTo(pose, d) { return [['three', TURN, d], ['side', TURN, d]].slice(0, pose === 'side' ? 1 : 2); }
  function stretchOut(d) { // one arm up, both up, a big yawn, arms down and out, and settle
    return [['stretch0', 0.35, d], ['stretch1', 0.4, d], ['stretch2', 0.9, d], ['stretch1', 0.2, d], ['stretch3', 0.3, d],
      ['stretch4', 0.55, d], ['stretch5', 0.4, d]];
  }
  // things she can walk over to and use (front px on screen): the kiosks, the cats, the vending machines in the back row
  function kioskSpots() {
    var cx = Math.round(cxF), out = [];
    for (var i = 0; i < markers.length; i++) out.push({ x: Math.round(markers[i] * WALK / S + home() + 16 - cx), opt: i });
    return out;
  }
  function vendSpots() { // each machine's buttons; they scroll with the back row of the rooftop
    var out = [];
    if (!near) return out;
    for (var x0 = -mod(Math.round(cxB * PAR.near), TILE); x0 < WB; x0 += TILE) near.vends.forEach(function (v) { out.push({ x: x0 + v + 19, opt: null }); });
    return out;
  }
  function nearest(list) { // the closest one on screen, if it is a short walk away
    var best = null;
    list.forEach(function (o) {
      if (o.x >= 20 && o.x <= WF - 20 && (!best || Math.abs(o.x - girl.x) < Math.abs(best.x - girl.x))) best = o;
    });
    return best && Math.abs(best.x - girl.x) < 220 ? best : null;
  }
  function standBy(o, reach, prefer) { // where she stands to use it: reach px to one side, facing it (her near side unless told)
    if (!o) return null;
    var sides = prefer ? [prefer, -prefer] : girl.x <= o.x ? [1, -1] : [-1, 1];
    for (var i = 0; i < 2; i++) {
      var x = o.x - sides[i] * reach;
      if (x >= 24 && x <= WF - 24) return { x: x, face: sides[i], opt: o.opt };
    }
    return null;
  }

  var wishAt = -9;                        // when she last looked up at the sky
  var ACTS = {
    roam: {},                             // weights for roam and dash live in weight()
    dash: {},
    look: { w: 12, make: function (d) {    // looks one way, then the other
      return hold([].concat(turnTo('side', d), breathe('side', 1 + Math.random() * 0.6, d), [['sideBlink', 0.12, d], ['three', TURN, d], ['front', 0.35]],
        turnTo('side', -d), breathe('side', 0.9 + Math.random() * 0.5, -d), [['three', TURN, -d]]));
    } },
    gaze: { w: 12, make: function (d) {    // turns round to watch the skyline for a while, and a star falls
      var a = hold([].concat(turnTo('back', d), breathe('back', 2.6 + Math.random() * 1.8), [['side', TURN, -d], ['three', TURN, -d]]));
      a.events = [[0.9, 'wish']]; return a;
    } },
    wave: { w: 8, make: function (d) {     // waves at you: only the hand moves, so her face stays crisp
      var flap = [['wave1', 0.17, d], ['wave2', 0.17, d]];
      return hold([['wave0', 0.22, d]].concat(flap, flap, flap, [['wave0', 0.3, d], ['waveBlink', 0.12, d], ['wave0', 0.3, d], ['front', 0.2]]));
    } },
    smile: { w: 8, make: function (d) {    // a calm moment: closes her eyes and smiles, then glances aside
      return hold([['calm', 0.9, d], ['calmBlink', 0.12, d], ['calm', 0.5, d], ['calmHalf', 0.12, d], ['calmSmile', 1.3, d],
        ['calmHalf', 0.12, d], ['calm', 0.7, d], ['calmLook', 1 + Math.random() * 0.6, d], ['calm', 0.6, d]]);
    } },
    stretch: { w: 8, make: function (d) {  // a big stretch and a yawn
      return hold([['three', TURN, d]].concat(stretchOut(d), [['three', TURN, d]]));
    } },
    notice: { w: 8, make: function (d, arriving) {   // glances off to the side, then turns round to you and smiles
      var away = arriving ? [['notice0', 0.35, d]] : [['three', TURN, d], ['notice0', 1 + Math.random() * 0.8, d]];
      return hold(away.concat([['notice1', 0.12, d], ['notice2', 0.12, d], ['notice3', 0.2, d], ['notice4', 1, d],
        ['notice5', 0.7, d], ['notice4', 0.6, d], ['front', 0.2]]));
    } },
    rest: { w: 10, make: function (d) {    // stands easy for a while, shifting her weight
      return hold([['three', TURN, d], ['pose0', 1.2 + Math.random(), d], ['pose0Blink', 0.12, d], ['pose0', 0.6, d], ['pose1', 1.3 + Math.random(), d],
        ['pose1Blink', 0.12, d], ['pose1', 0.7, d], ['pose2', 1 + Math.random() * 0.8, d], ['three', TURN, d]]);
    } },
    sit: { w: 0, make: function (f) {      // sits on a bench: leans back, hugs her knees, then gets up (weight in weight())
      var r = Math.random;
      var lean = [['sitLean', 0.9, f], ['sitLean2', 0.9, f], ['sitLeanBlink', 0.12, f], ['sitLean', 0.8 + r() * 0.8, f], ['sitLean2', 0.9, f]];
      var hug = [['sitHug', 1.2 + r(), f], ['sitHugBlink', 0.12, f], ['sitHug', 1 + r() * 1.2, f]];
      var a = hold([['three', TURN, f], ['sitDown', 0.16, f], ['sit', 0.7 + r() * 0.6, f], ['sitBlink', 0.12, f], ['sit', 0.6 + r() * 0.8, f]]
        .concat(r() < 0.5 ? lean.concat([['sit', 0.5, f]], hug) : hug.concat([['sit', 0.5, f]], lean),
          [['sit', 0.4, f], ['sitUp', 0.16, f], ['stand3', 0.24, f]], r() < 0.5 ? stretchOut(f) : [], [['three', TURN, f]]));
      a.sit = true; return a;
    } },
    phone: { w: 9, make: function (d) {   // checks her phone: scrolls, smiles at something, puts it away
      return hold([['three', TURN, d], ['phone0', 0.3, d], ['phone1', 0.45, d], ['phone2', 1.3 + Math.random(), d], ['phone2Blink', 0.12, d],
        ['phone2', 0.9, d], ['phone3', 1.3, d], ['phone2', 0.7, d], ['phone4', 0.35, d], ['phone5', 0.45, d], ['three', TURN, d]]);
    } },
    photo: { w: 7, make: function (d) {   // a photo of the skyline: lines it up, snap (a flash), looks at it, pleased
      return hold([['three', TURN, d], ['photo0', 0.45, d], ['photo1', 1.1, d], ['photo2', 0.2, d], ['photo1', 0.35, d], ['photo3', 0.9, d],
        ['photo3Blink', 0.12, d], ['photo3', 0.6, d], ['photo4', 1.3, d], ['three', TURN, d]]);
    } },
    music: { w: 7, make: function (d) {   // headphones on, eyes shut, nodding along to a song, then off again
      var l = [['three', TURN, d], ['music0', 0.6, d], ['music1', 0.45, d], ['music2', 1.2, d]], n = 6 + Math.floor(Math.random() * 5), i;
      for (i = 0; i < n; i++) l.push(['music3', 0.26, d], ['music3B', 0.26, d]);
      l.push(['music4', 1.2, d]);
      for (i = 0; i < 4; i++) l.push(['music3', 0.26, d], ['music3B', 0.26, d]);
      return hold(l.concat([['music2', 0.6, d], ['music5', 0.45, d], ['music0', 0.4, d], ['three', TURN, d]]));
    } },
    chill: { w: 0, make: function (d) {   // hands in her pockets, a shiver, then easy, breathing out little clouds (weight in weight())
      var l = [['three', TURN, d], ['chill0', 1.1, d], ['chill1', 0.9, d], ['chill2', 1.2, d], ['chill2Blink', 0.12, d], ['chill2', 0.6, d]];
      for (var i = 0, n = 2 + Math.floor(Math.random() * 2); i < n; i++) l.push(['chill3', 1.5, d], ['chill2', 1.1, d]);
      return hold(l.concat([['chill2Blink', 0.12, d], ['chill2', 0.5, d], ['three', TURN, d]]));
    } },
    fly: { w: 6, make: function (d) {     // holds up a finger: a holo-butterfly flies in, rests on it, and flutters off
      var a = hold([['three', TURN, d], ['fly0', 1.8, d], ['fly1', 1, d], ['fly1Blink', 0.12, d], ['fly1', 0.6, d], ['fly2', 1.2, d],
        ['fly3', 1.4, d], ['fly4', 0.9, d], ['three', TURN, d]]);
      a.land = TURN + 1.8; a.off = a.land + 2.92;   // when fly1 starts (it lands) and when fly3 starts (it leaves)
      a.fly = true; return a;
    } },
    // the next three walk her over to something first (find: where to stand), and only count when one is close by
    type: { w: 10, find: function () { return standBy(nearest(kioskSpots()), 14); }, make: function (f, i) {
      var l = [['three', TURN, f], ['type0', 0.4, f]], r = Math.random;
      function burst(pose, n) { for (var k = 0; k < n; k++) l.push([pose, 0.1 + r() * 0.1, f], [pose + 'Tap', 0.09 + r() * 0.05, f]); }
      burst('type1', 6); l.push(['type1', 0.5, f], ['type1Blink', 0.12, f]); burst('type1', 5);
      l.push(['type2', 0.6, f]); burst('type2', 6);
      var a = hold(l.concat([['type2', 0.5, f], ['type3', 0.9, f], ['type0', 0.3, f], ['three', TURN, f]]));
      a.kiosk = i; return a;
    } },
    pet: { w: 14, find: function () { return standBy(nearest(catSpots()), 12); }, make: function (f, k) {
      var l = [['three', TURN, f], ['pet0', 0.35, f], ['pet1', 0.7, f]], n = 3 + Math.floor(Math.random() * 3);
      for (var i = 0; i < n; i++) l.push(['pet2', 0.4, f], ['pet2Slide', 0.4, f]);
      var a = hold(l.concat([['pet3', 0.5, f], ['pet4', 1.4, f], ['pet1', 0.4, f], ['pet0', 0.35, f], ['three', TURN, f]]));
      a.cat = k; return a;
    } },
    drink: { w: 10, find: function () { return standBy(nearest(vendSpots()), 20, -1); }, make: function (f) {
      return hold([['three', TURN, f], ['drink0', 0.5, f], ['drink1', 0.8, f], ['drink2', 0.6, f], ['drink3', 0.45, f], ['drink4', 1.3, f],
        ['drink5', 0.9, f], ['drink4', 1, f], ['drink5', 1.2, f], ['three', TURN, f]]);
    } },
    doze: { w: 6, make: function (f) {     // sits down on the floor and nods off (twice), jolts awake, gets up and stretches
      var r = Math.random;
      var a = hold([['three', TURN, f], ['sitDown', 0.18, f], ['doze0', 1 + r() * 0.6, f], ['doze0Blink', 0.12, f], ['doze0', 0.7, f],
        ['doze1', 0.9, f], ['doze2', 2.4 + r() * 1.6, f], ['doze3', 0.8, f], ['doze0', 0.9, f], ['doze4', 1, f], ['doze5', 2 + r() * 1.4, f],
        ['doze3', 0.7, f], ['doze0', 0.8, f], ['doze0Blink', 0.12, f], ['doze0', 0.4, f], ['sitUp', 0.18, f], ['stand3', 0.24, f]]
        .concat(stretchOut(f), [['three', TURN, f]]));
      a.sit = true; return a;
    } }
  };
  var ASLEEP = { doze2: 1, doze5: 1 };    // frames that get little z's drifting up
  var lastAct = 'roam';
  function weight(name) { // she wanders between little moments, and never does the same trick twice in a row
    var moved = lastAct === 'roam' || lastAct === 'dash';
    if (name === 'roam') return moved ? 18 : 70;
    if (name === 'dash') return moved ? 0 : 9;
    if (name === 'sit') { var b = nearestBench(); return lastAct !== 'sit' && b !== null && Math.abs(b - girl.x) < 220 ? 16 : 0; }
    if (name === 'doze' && lastAct === 'sit') return 0;                 // not straight after a sit on the bench
    if (name === lastAct) return 0;
    if (name === 'chill') return night ? 12 : 3;                        // mostly on cold nights
    if (ACTS[name].find) return ACTS[name].find() ? ACTS[name].w : 0;
    return ACTS[name].w;
  }
  function startAct(name, face, opt) {
    girl.act = ACTS[name].make(face, opt);
    girl.act.fired = 0;
    girl.mode = 'act';
    girl.since = t;
    lastAct = name;
  }
  // a reaction asked for by the page (wave, notice…): plays as soon as she is free, or is dropped after a few seconds
  function tryMood() {
    var q = girl.mood;
    if (!q) return;
    if (t > q.until || (girl.mode === 'act' && girl.act.sit)) { girl.mood = null; return; }
    if (girl.mode === 'run' || girl.y > 0 || girl.vy > 0 || girl.prep >= 0 || reduce || !G) return;
    girl.mood = null; girl.after = 0;
    startAct(q.name, girl.facing, true);    // true: a reaction is quick (notice skips its long glance away)
  }
  function pickAction() {
    var names = Object.keys(ACTS), total = 0, i;
    for (i = 0; i < names.length; i++) total += weight(names[i]);
    var r = Math.random() * total, name = names[0];
    for (i = 0; i < names.length; i++) { r -= weight(names[i]); if (r < 0) { name = names[i]; break; } }
    lastAct = name;
    if (name === 'sit') {                  // walk over to the bench first; she sits when she gets there
      var face = Math.random() < 0.5 ? -1 : 1;
      girl.target = nearestBench() + SIT_DX * face;
      girl.after = { name: 'sit', face: face };
      girl.facing = girl.target >= girl.x ? 1 : -1;
      girl.fast = false;
      girl.mode = 'roam';
    } else if (ACTS[name].find) {          // walk over to it; she starts when she gets there
      var spot = ACTS[name].find();
      girl.target = spot.x;
      girl.after = { name: name, face: spot.face, opt: spot.opt };
      girl.facing = girl.target >= girl.x ? 1 : -1;
      girl.fast = false;
      girl.mode = 'roam';
    } else if (name === 'roam' || name === 'dash') {
      var dir = Math.random() < 0.5 ? -1 : 1, dist = name === 'dash' ? 90 + Math.random() * 130 : 40 + Math.random() * Math.min(170, WF * 0.4);
      var to = girl.x + dir * dist;
      if (to < 24 || to > WF - 24) to = girl.x - dir * dist;
      girl.target = clamp(to, 24, WF - 24);
      girl.facing = girl.target >= girl.x ? 1 : -1;
      girl.fast = name === 'dash';
      girl.mode = 'roam';
    } else {
      girl.act = ACTS[name].make(Math.random() < 0.5 ? -1 : 1);
      girl.act.fired = 0;
      girl.mode = 'act';
    }
    girl.since = t;
  }
  function hopUp(v0) { // crouch for a beat, then take off at v0 (190 = a full jump, 140 = a little hop)
    if (reduce || girl.y > 0 || girl.vy > 0 || girl.prep >= 0) return false;
    girl.v0 = v0; girl.prep = t;
    return true;
  }
  function settleIdle(delay) { girl.mode = 'idle'; girl.since = t; girl.act = null; girl.next = t + delay; }

  function idleFront() { // breathing in and out, blinking now and then
    var out = mod(t, 3.2) > 1.7;
    if (mod(t, 3.7) < 0.13 || mod(t, 11.3) < 0.1) return out ? 'blinkB' : 'blink';
    return out ? 'frontB' : 'front';
  }
  function girlFrame() {
    if (!GIRL) return null;
    var a = G.anim;
    if (girl.y > 0.5 || girl.vy > 0) return a.jump[girl.vy > girl.v0 * 0.35 ? 0 : girl.vy > -girl.v0 * 0.35 ? 1 : 2];
    if (girl.prep >= 0) return 'crouch';
    if (t - girl.landed < 0.1) return 'land';
    if (girl.mode === 'run') return a.run.frames[Math.floor(girl.runF) % 6];
    if (girl.mode === 'roam') {
      if (t - girl.since < TURN) return 'three';                       // turning to set off
      if (girl.fast) return a.run.frames[Math.floor(girl.runF) % 6];
      return a.walk.frames[Math.floor(girl.dist / a.walk.len * 6) % 6];
    }
    if (girl.mode === 'act') { var en = girl.act.at(t - girl.since); if (en[2]) girl.facing = en[2]; return en[0]; }
    var still = t - girl.lastMove;                                     // just stopped: side, three-quarter, then you
    if (still < TURN) return 'side';
    if (still < TURN * 2) return 'three';
    return idleFront();
  }

  function updateGirl(dt, d) {
    if (Math.abs(d) > 0.1) {                         // the camera moves: she runs on the spot
      girl.facing = d > 0 ? 1 : -1;
      girl.dist += Math.abs(d) / S;
      stepRun(Math.abs(d) / S, dt);
      girl.lastMove = t;
      if (girl.mode !== 'run') { girl.mode = 'run'; girl.act = null; girl.after = 0; }
      girl.next = t + 2.5 + Math.random() * 2.5;
    } else if (girl.mode === 'run' && t - girl.lastMove > 0.1) {
      settleIdle(girl.next - t);
    }
    if (girl.mode === 'roam' && t - girl.since >= TURN) {
      var gap = girl.target - girl.x, step = (girl.fast ? DASH_SPEED : WALK_SPEED) * dt;
      if (Math.abs(gap) <= step) {
        girl.x = girl.target; girl.lastMove = t;
        if (girl.after) { startAct(girl.after.name, girl.after.face, girl.after.opt); girl.after = 0; }   // there: sit down, pet the cat...
        else if (!girl.fast && lastAct !== 'notice' && Math.random() < 0.3) startAct('notice', girl.facing, true);   // stops and turns round to you
        else settleIdle(0.8 + Math.random() * 1.6);
      }
      else { girl.facing = gap > 0 ? 1 : -1; girl.x += step * girl.facing; girl.dist += step; if (girl.fast) stepRun(step, dt); girl.lastMove = t; }
    }
    if (girl.mode === 'act') {
      var e = t - girl.since, ev = girl.act.events;
      while (ev && girl.act.fired < ev.length && e >= ev[girl.act.fired][0]) {
        var what = ev[girl.act.fired][1];
        if (what === 'wish') wishAt = t;
        girl.act.fired++;
      }
      if (e > girl.act.dur) settleIdle(0.9 + Math.random() * 1.8);
    }
    tryMood();
    if (girl.mode === 'idle' && t > girl.next && girl.y === 0 && girl.prep < 0 && t > bubbleUntil && !reduce && G) pickAction();
    if (girl.prep >= 0 && t - girl.prep > 0.07) { girl.prep = -1; girl.vy = girl.v0; girl.y = 0.01; }   // anticipation, then off
    if (girl.y > 0 || girl.vy > 0) {
      girl.y += girl.vy * dt;
      girl.vy -= 600 * dt;
      if (girl.y <= 0) { girl.y = 0; girl.vy = 0; girl.landed = t; }
    }
  }

  // little z's drifting up from her head while she naps: three at a time, growing and fading as they rise
  var ZS = [['####', '..#.', '.#..', '####'], ['#####', '...#.', '..#..', '.#...', '#####']];
  function drawZzz(x, top, face) {
    for (var i = 0; i < 3; i++) {
      var p = mod(t * 0.42 + i / 3, 1), z = ZS[p > 0.45 ? 1 : 0];
      var zx = Math.round(x + face * (3 + p * 9) + Math.sin(t * 2 + i * 2) * 1.2), zy = Math.round(top - 3 - p * 21);
      var c = rgba('#f7f2ff', p < 0.12 ? p / 0.12 : 1 - (p - 0.12) / 0.88);
      for (var r = 0; r < z.length; r++) for (var k = 0; k < z[r].length; k++) if (z[r][k] === '#') dot(fx, zx + k, zy + r, c);
    }
  }
  // little extras for her moments: the camera flash, breath on a cold night, music notes, hearts from the cat, the butterfly.
  // Her frames face right; facing left mirrors them about her centre, so a pixel dx to the right lands at x + facing * dx.
  var NOTE = ['.##', '.#.', '##.', '##.'], HEART = ['##.##', '#####', '.###.', '..#..'];
  var FLY_TIP = { fly0: [15, -41], fly1: [15, -40], fly1Blink: [15, -40], fly2: [14, -39], fly3: [14, -42] };   // her fingertip
  function glyph(rows, x, y, c) {
    for (var r = 0; r < rows.length; r++) for (var k = 0; k < rows[r].length; k++) if (rows[r][k] === '#') dot(fx, x + k, y + r, c);
  }
  function fade(p) { return p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85; }
  function drawBug(x, y, col, open, a) { // a holo-butterfly, like the ones flitting about
    x = Math.round(x); y = Math.round(y);
    rect(fx, x - 3, y - 2, 7, 5, rgba(col, 0.15 * a));
    var c = rgba(col, a);
    if (open) { rect(fx, x - 2, y - 1, 2, 2, c); rect(fx, x + 1, y - 1, 2, 2, c); dot(fx, x - 1, y + 1, c); dot(fx, x + 1, y + 1, c); }
    else { rect(fx, x - 1, y - 1, 1, 2, c); rect(fx, x + 1, y - 1, 1, 2, c); }
    rect(fx, x, y - 1, 1, 3, 'rgba(255,255,255,' + a + ')');
  }
  function drawProps(name, gx, fl) {
    var a = girl.act, e = t - girl.since, f = girl.facing, i, p, x, y;
    if (name === 'photo2') {                                  // the flash
      x = gx + f * 16; y = fl - 39;
      rect(fx, x - 3, y - 3, 7, 7, 'rgba(255,255,255,.3)'); rect(fx, x - 2, y, 5, 1, '#ffffff'); rect(fx, x, y - 2, 1, 5, '#ffffff');
    }
    if (name === 'chill3') {                                  // a little cloud of breath, drifting off and fading
      p = (a.into(e) - 0.15) / 1.2;
      if (p > 0 && p < 1) {
        var c = 'rgba(236,244,255,' + (0.85 * (1 - p * p)).toFixed(2) + ')', r = p < 0.3 ? 1 : 2;
        x = Math.round(gx + f * (9 + p * 8)); y = Math.round(fl - 40 - p * 5);
        rect(fx, x - r + 1, y, 2 * r - 1, 1, c); rect(fx, x, y - r + 1, 1, 2 * r - 1, c);       // a soft little plus, growing
        if (r > 1) { dot(fx, x - f * 3, y + 1, c); dot(fx, x + f * 2, y - 2, c); }             // wisps
      }
    }
    if (/^music[234]/.test(name)) {                           // notes drifting up from the headphones
      for (i = 0; i < 2; i++) {
        p = mod(t / 1.6 + i / 2, 1);
        x = gx - f * (9 + p * 6) + Math.sin(t * 3 + i * 2) * 1.2; y = fl - 46 - p * 14;
        glyph(NOTE, Math.round(x) - 1, Math.round(y), rgba(i ? '#5ee6ff' : '#ff8fd0', fade(p)));
      }
    }
    if (a.cat !== undefined && /^pet[234]/.test(name)) {      // a heart now and then from the happy cat
      p = mod(e / 1.3, 1);
      glyph(HEART, gx + f * 12 - 2, Math.round(fl - 23 - p * 10), rgba('#ff8fd0', Math.min(1, fade(p) * 1.6)));
    }
    if (a.fly) {                                              // the butterfly: in to her fingertip, a rest, then away
      var tip = FLY_TIP[name] || FLY_TIP.fly3, tx = gx + f * tip[0], ty = fl + tip[1] - 2, flap = Math.floor(t * 12) % 2;
      if (e < a.land) {
        p = e / a.land; var q = 1 - (1 - p) * (1 - p);
        drawBug(tx + f * (1 - q) * 46 + Math.sin(e * 5) * 4 * (1 - p), ty - (1 - q) * 30 + Math.sin(e * 9) * 3 * (1 - p), '#5ee6ff', flap, Math.min(1, p * 5));
      } else if (e < a.off) {
        drawBug(tx, ty, '#5ee6ff', mod(e - a.land, 1.4) < 0.9, 1);   // resting: wings open, now and then a slow close
      } else if ((p = (e - a.off) / 1.8) < 1) {
        drawBug(tx + f * p * 24 + Math.sin(e * 6) * 3, ty - p * 44, '#5ee6ff', flap, p < 0.6 ? 1 : (1 - p) / 0.4);
      }
    }
  }
  function drawFront(dt) {
    fx.imageSmoothingEnabled = false;
    fx.clearRect(0, 0, front.width, front.height);
    var cx = Math.round(cxF), gy = gyF();
    drawDecor(cx);
    drawKiosks(cx);
    drawCritters(cx);
    var off = mod(cx, TILE_F);
    for (var x0 = -off; x0 < WF; x0 += TILE_F) fx.drawImage(groundTile, x0, 0);
    if (night) { // dim the rooftop and props; the neon edge and the characters stay bright
      fx.globalCompositeOperation = 'source-atop';
      fx.fillStyle = 'rgba(16,8,40,.45)';
      fx.fillRect(0, 0, front.width, front.height);
      fx.globalCompositeOperation = 'source-over';
      rect(fx, 0, gy + 9, WF, 1, EDGE_NEON);
      rect(fx, 0, gy + 10, WF, 1, 'rgba(255,134,216,.25)');
    }
    drawButterflies();

    var name = girlFrame(), lift = Math.round(girl.y), fl = FLOOR();
    var sw = Math.max(8, 18 - Math.floor(lift / 3));
    rect(fx, Math.round(girl.x - sw / 2), fl, sw, 1, 'rgba(6,8,20,.4)');
    if (name && GIRL[name]) {
      var img = GIRL[name][girl.facing > 0 ? 0 : 1];
      fx.drawImage(img, Math.round(girl.x) - (G.AX + 1), fl - img.height + 2 - lift);
      if (ASLEEP[name]) drawZzz(girl.x, fl + 2 - G.poses[name].rows.length, girl.facing);
      if (girl.mode === 'act') drawProps(name, Math.round(girl.x), fl - lift);
    }
    if (bubble) {
      if (t < bubbleUntil) {
        bubble.style.left = (girl.x * S) + 'px';
        bubble.style.bottom = ((FRONT_H - fl + girlTop + 6 + lift) * S) + 'px';
      } else if (bubble.classList.contains('is-visible')) bubble.classList.remove('is-visible');
    }
  }

  /* ---------- loop ---------- */
  function update(dt) {
    if (keys.d) keyOff += 140 * dt;
    if (keys.a) keyOff -= 140 * dt;
    var target = targetCam();
    cam = reduce ? target : cam + (target - cam) * Math.min(1, dt * 9);
    if (Math.abs(target - cam) < 0.05) cam = target;
    var d = cam - prevCam;
    prevCam = cam;
    cxF = cam / S;
    cxB = cam / S;
    updateGirl(dt, d);
    updateTrain(dt);
  }

  function frame(now) {
    now /= 1000;
    if (!last) last = now - 1 / 60;
    var dt = now - last;
    if (dt < 1 / 75) { requestAnimationFrame(frame); return; }  // up to ~60 fps, even on fast displays
    dt = Math.min(dt, 0.1);
    last = now;
    t += dt;
    update(dt);
    drawBack();
    drawFront(dt);
    requestAnimationFrame(frame);
  }

  function renderStatic() { // reduced motion: redraw only when something changes
    update(0);
    drawBack();
    drawFront(1);
  }

  /* ---------- input ---------- */
  function typing() {
    var a = document.activeElement;
    return a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
  }
  document.addEventListener('keydown', function (e) {
    if (typing() || e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === 'a' || k === 'd') keys[k] = true;
    if (k === 'w' && !e.repeat) api.jump();
  });
  document.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', function () { keys = {}; });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { resize(); if (reduce) renderStatic(); }, 150);
  });

  /* ---------- public API ---------- */
  var api = {
    jump: function (quiet) {
      if (!hopUp(190)) return false;
      if (girl.mode === 'act' && quiet !== true) settleIdle(2.5);
      if (api.onJump && quiet !== true) api.onJump();
      return true;
    },
    // mood: what she does as she says it (any act: 'wave', 'notice', 'smile', 'gaze', 'look'); without one she just turns to you
    say: function (text, ms, mood) {
      if (!bubble) return;
      bubble.textContent = text;
      bubble.classList.add('is-visible');
      bubbleFrom = t;
      bubbleUntil = t + (ms || 2200) / 1000;
      var sitting = girl.mode === 'act' && girl.act.sit;
      if (mood && ACTS[mood]) girl.mood = { name: mood, until: t + 4 };
      else if (!sitting && girl.mode === 'act') settleIdle(2);
      if (reduce) {
        bubble.style.left = (girl.x * S) + 'px';
        bubble.style.bottom = ((GROUND - 3 + girlTop + 6) * S) + 'px';
        setTimeout(function () { bubble.classList.remove('is-visible'); }, ms || 2200);
      }
    },
    setNight: function (v) {
      if (night === !!v && sky) return;
      night = !!v;
      P = night ? THEMES.night : THEMES.day;
      if (WB) buildScenery();
      if (reduce) renderStatic();
    },
    setMarkers: function (list) { markers = list.slice(); if (reduce) renderStatic(); },
    markDone: function (i) { if (!done[i]) found++; done[i] = true; if (reduce) renderStatic(); },
    onJump: null
  };
  window.World = api;

  buildGirl();
  resize();
  if (reduce) {
    renderStatic();
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; renderStatic(); });
    }, { passive: true });
  } else {
    requestAnimationFrame(frame);
  }
})();

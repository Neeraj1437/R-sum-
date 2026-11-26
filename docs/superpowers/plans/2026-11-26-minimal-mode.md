# Plain Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The site opens on a plain, dark, text-first page (`index.html`), with a highlighted icon that leads to the existing pixel city (moved to `world.html`), which links back.

**Architecture:** Two static pages, no build step (GitHub Pages). The plain page has its own stylesheet and at most a tiny inline script for BibTeX copy. It loads none of the city's JS/CSS. The city is the current `index.html`, moved as-is, plus one top-bar icon and one quick-menu entry.

**Tech Stack:** Plain HTML/CSS/JS. Verification uses Node 26 (static checks) and headless Edge (screenshots).

**Spec:** `docs/superpowers/specs/2026-11-26-minimal-mode-design.md`

## Global Constraints

- Every visit to `index.html` shows the plain page; no stored mode preference (no localStorage for mode).
- The plain page must not reference `girl.js`, `world.js`, `avatar.js`, `script.js` or `style.css`.
- Dark only; no light theme. One column, about 680px wide.
- The switch highlight runs on every load for about 4 s, then stays still; `prefers-reduced-motion: reduce` gets a steady ring with no pulsing.
- City behaviour unchanged apart from the back icon and quick-menu entry.
- Do not stage or commit the user's pre-existing `world.js` change, and only commit when the user asks.
- Copy comes from the current page's text (facts, numbers, links) and must match it exactly.

## Review Focus

- Phone width (360px): no horizontal scroll, the fixed switch icon doesn't cover the name/header.
- The city still works at its new URL: the `images/`, `resume.pdf` and script paths are relative, and `#section` anchors work in `world.html`.
- Keyboard users: the switch is a real link that can be focused, with a visible focus ring and an accessible name.
- Clipboard blocked (file:// or old browser): the BibTeX copy falls back gracefully (it selects the text or shows a message) and does not throw.
- An old bookmark to `index.html#projects` lands on the plain page's Projects section (the plain page uses the same section ids).

---

### Task 1: Move the city to `world.html` and add the way back

**Files:**
- Create: `world.html` (the current `index.html` content, via `git mv index.html world.html`)
- Modify: `world.html` (HUD actions: new button before `#theme-toggle`)
- Modify: `script.js:331` (quick-menu `Actions` group)
- Modify: `style.css` only if the new HUD item needs `a.hud-btn` link styling (no underline, same colour)

**Interfaces:**
- Produces: `world.html`, the page Task 2's switch links to.

- [ ] **Step 1:** `git mv index.html world.html`.
- [ ] **Step 2:** In `world.html` `.hud__actions`, add as the first child `<a class="hud-btn" href="index.html" id="plain-link" aria-label="Plain version" title="Plain version"><i class="pi" data-pi="file-alt"></i></a>`. If `file-alt` isn't in pixelarticons 1.8.1, pick an existing document-like icon and check the URL returns 200.
- [ ] **Step 3:** In `script.js`, add `{ g: 'Actions', icon: <same icon>, label: 'Plain version', run: function () { location.href = 'index.html'; } }` as the first `Actions` entry.
- [ ] **Step 4: Verify.** Run `node -e` to assert that `world.html` contains `href="index.html"`, `girl.js` and `script.js`. Then take a headless Edge screenshot: `msedge --headless --disable-gpu --window-size=1280,800 --screenshot=<scratchpad>/world.png file:///.../world.html`. Expected: the city renders and the new icon sits in the top bar beside the others.

### Task 2: The plain page

**Files:**
- Create: `index.html`
- Create: `plain.css`

**Interfaces:**
- Consumes: `world.html` (Task 1).
- Produces: `.mode-switch` (the `<a>` to `world.html`) and `.mode-switch__hint` (its hint text), both styled and animated in Task 3.

- [ ] **Step 1: Head.** Copy the `<title>`, description, theme-color (use the plain page's background colour), OG tags and favicon from `world.html`. Link only `plain.css` (plus one Google Fonts link at most, e.g. JetBrains Mono for small labels).
- [ ] **Step 2: Switch markup.** Right after `<body>`: `<a class="mode-switch" href="world.html" aria-label="Interactive version" title="Interactive version"><svg …inline gamepad icon…/><span class="mode-switch__hint">Try the interactive version</span></a>`. Make the icon inline SVG so it doesn't depend on the CDN.
- [ ] **Step 3: Content.** One `<main>` column, with sections in this order and these ids: header (`#home`), `#about`, `#experience`, `#publication`, `#projects`, `#skills`, `#education`, then a footer. The detail level is fixed by the spec: each project gets title + repo link, a 2–3 line summary with its strongest numbers, and a stack line. Links: Résumé `resume.pdf`, GitHub, LinkedIn, `mailto:` personal email, DOI. Publication gets a "Copy BibTeX" button. Copy the BibTeX string verbatim from `script.js` (`bibtex` var) into a small inline script that uses `navigator.clipboard.writeText`, wrapped in try/catch, with a fallback that changes the button text to "Copy failed".
- [ ] **Step 4: Styles in `plain.css`.** Define colour tokens on `:root` (near-black background, light grey text, muted grey secondary text, one accent for links). Use system-ui sans for the body and `max-width: 680px` with a 16px side gutter. Section headings are small, uppercase, muted. Keep spacing generous and add no decoration.
- [ ] **Step 5: Verify.** Run a `node -e` check on `index.html`: no `girl.js|world.js|avatar.js|script.js|style.css`, no `localStorage`, contains `href="world.html"`, all 7 ids present, and the 6 project repo URLs from `world.html` present. Take headless Edge screenshots at 1280×900 and 375×900 into the scratchpad. Read them: one clean column, no horizontal overflow, switch visible top-right without covering the name.

### Task 3: Highlight the switch on every visit, and update the README

**Files:**
- Modify: `plain.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: `.mode-switch`, `.mode-switch__hint` (Task 2).

- [ ] **Step 1: Styles.** Fix `.mode-switch` at the top right (with safe spacing on phones). Run a CSS `@keyframes` glow/pulse (box-shadow + slight scale) 3 iterations over ~4 s, `animation-delay` ~0.6 s, so it plays on every load without JS. `.mode-switch__hint` fades in, then out over the same window, and is hidden at the end (`animation-fill-mode: forwards`). On hover/focus the hint shows again. Add a `:focus-visible` ring. Under `@media (prefers-reduced-motion: reduce)`: no animation, a steady accent ring on the icon, and the hint simply shown statically for the first visit view (it may stay visible).
- [ ] **Step 2: Verify.** Run a `node -e` check that `plain.css` contains `@keyframes`, `prefers-reduced-motion` and `:focus-visible`. Take headless Edge screenshots of `index.html` with `--virtual-time-budget=1500` (mid-pulse: glow and hint visible) and `--virtual-time-budget=6000` (settled: no hint, icon still visible).
- [ ] **Step 3: README.** Add `index.html` (plain page), `plain.css` and `world.html` (interactive city) to the file table, and say the live link opens the plain version.

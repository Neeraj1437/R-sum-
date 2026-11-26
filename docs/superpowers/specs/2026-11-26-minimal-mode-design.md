# Plain mode for the portfolio: design

## Why

The pixel city is fun but slow to read. Recruiters and researchers want the facts fast. The site should open on a
plain, dark, text-first page like the personal pages experienced researchers keep. The city stays one click away for
anyone who wants it.

## Goals

- Every visit to the site's main link opens the plain page. No previous choice is remembered.
- The plain page has one icon that leads to the pixel city. That icon is highlighted on every visit, so people notice it.
- The city has an icon that leads back to the plain page.
- The plain page gives a bit more than researcher one-liners: per project, a short summary, its one or two strongest
  numbers, the stack and a repo link. It skips the full bullet lists.

## Non-goals

- No light theme for the plain page (the request was a dark screen).
- No changes to how the city looks or behaves, beyond the "back to plain" icon.
- No contact form on the plain page. Email and links are enough.

## Anti-goals

- The plain page loading any of the city's scripts or pixel styles.
- Highlighting the icon so hard that it pulls attention from the content, or animating forever.

## Approaches considered

1. **Two separate pages (picked).** `index.html` becomes the plain page with its own small stylesheet. The current page
   moves unchanged to `world.html`. The plain page is fast and nothing in the city can break. Cost: text lives in two
   files, so content edits are made twice.
2. One page with a mode switch. Content stays in one place, but every visitor downloads the city's scripts, the pixel
   styles have to be undone, and the markup is shaped around game parts.
3. One content file rendered into both pages by a script. Nothing duplicated, but it rewrites a working page and hides
   the text from crawlers until the script runs.

Picked 1: fastest plain page, zero risk to the city, and the duplication is acceptable for a site this size.

## The design

**Files**
- `index.html`: the new plain page. It keeps the current page's title, description, Open Graph tags and favicon.
- `plain.css`: the plain page's styles (my call to keep them in a separate file, so `style.css` stays the city's).
- `world.html`: the current `index.html`, moved with no changes other than the icon below.
- `README.md`: updated to describe both pages.

**Plain page layout** (dark background, light grey text, one accent colour for links). On phones and narrow windows it is
one column about 680px wide. From 1100px wide (added after approval, at the user's request to "format to fullscreen") it
becomes a dashboard: intro and About in a sticky left sidebar, the rest on the right, experience, publications and
projects as cards, one per row up to 1280px wide and two per row above that.
1. Header: name, "AI/ML engineer · LLM systems", RV University, Bengaluru, open to work. Links: Résumé (PDF), GitHub,
   LinkedIn, email.
2. About: two or three sentences.
3. Experience: the RVITM internship, with a short summary and its key numbers (98.26% character accuracy vs EasyOCR's
   4.28%, ~11 s page to speech).
4. Publications: the Springer paper (authors, venue, DOI link, BibTeX copy) and the IEEE-accepted paper.
5. Projects: the five non-paper projects (the CNN-Filtered GAN paper is listed once, under Publications), each with title, a 2–3 line summary with the strongest numbers, a stack line and a repo link.
6. Skills: one line per group.
7. Education and achievements: a compact list.
8. Footer: copyright.

**The switch to the city**
- A small icon button fixed at the top right of the plain page, linking to `world.html`, with the label "Interactive
  version".
- On every page load it glows and pulses a few times over roughly 4 seconds, with a short hint beside it ("Try the
  interactive version") that fades out. Then it settles to a still, plainly visible icon.
- If the visitor has reduced motion turned on, it gets a steady highlight ring with no pulsing.

**The switch back**
- A new icon in the city's top bar, next to the theme button, linking to `index.html` ("Plain version").
- A matching entry in the city's quick menu (Ctrl + K).

## Left to the builder

- Exact colours, font (system sans plus a mono for small labels is the starting point), spacing and icon.
- Exact wording of the condensed project summaries, taken from the current page's text.

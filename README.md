# Neeraj Rajiv Shivam — Portfolio

**Live site: [neeraj1437.github.io/R-sum-](https://neeraj1437.github.io/R-sum-/)**

Personal portfolio site: LLM systems end to end (LoRA fine-tuning and evals, agents, Python backends), computer vision and edge AI.

Plain HTML, CSS and JavaScript with no build step, so it can be served directly by GitHub Pages.

| File | What it holds |
| --- | --- |
| `index.html` | All content (edit text here) |
| `style.css` | Pixel UI: violet dusk/night colour tokens, neon panels, lit-sign headings, the About player card and portrait, buttons |
| `girl.js` | The pink-haired player character as pixel frames (one character per pixel), traced from five sprite sheets: front, three-quarter, side and back poses, 6-frame walk and run cycles, jump (crouch, rise, tuck, fall, land), waving, relaxed standing poses, a calm smile, a stretch and yawn, turning round to face you, sitting down / leaning back / hugging her knees / getting up, nodding off on the floor, typing at a kiosk, taking a photo, headphones on, hands in pockets on a cold night, checking her phone, a vending-machine drink, petting a cat and a butterfly landing on her finger, plus breathing, blink, key-tap, nod and stroke frames |
| `world.js` | The violet neon city on two canvases: cloud bands, a far skyline with a domed tower, dense lit buildings with water towers, fire escapes and a few pink neon word signs, kept sparse and dimmed behind the text column so the page stays easy to read, an elevated train, a turning wall fan, the rooftop with AC units, CRTs and a vending machine, the home desk with a fish tank and a terminal, kiosks, black and orange cats, critters. Also runs her free-roaming behaviour (strolls, sprints, looks around, turns to watch the sky, waves, strikes a relaxed pose, smiles to herself, stretches and yawns, turns round to look at you, walks over to the rooftop benches to sit for a while, sits down on the floor to nod off, with little z's, checks her phone, snaps a photo of the skyline with a flash, puts her headphones on and nods along with music notes, stands with her hands in her pockets breathing little clouds (mostly at night), holds up a finger for a holo-butterfly to land on, and walks over to type at a kiosk, pet a cat (it shuts its eyes and hearts float up) or get a drink from a vending machine). She only jumps when you press `W` or pick Jump! in the menu. `World.say(text, ms, mood)` shows a speech bubble; the optional mood (`'wave'`, `'notice'`, `'smile'`, `'gaze'`, `'look'`) makes her react as soon as she's free |
| `avatar.js` | The pixel portrait of Neeraj in the top bar and on the player card (frames in `images/avatar.png`: 21 head angles and 10 expressions traced from two matching sheets): he turns his head towards the pointer (7 left–right turns × up/level/down), blinks, says the hero line when the page opens, looks bored if left alone, looks away while the tab is hidden, and pulls faces when things happen (`Avatar.show(name, ms)`, `Avatar.talk(ms)`). The tab icon, `images/favicon.png`, is his front face on a pink rounded square |
| `script.js` | XP/discovery system, dusk/night, 8-bit sound, project filters, menu (command palette), contact form, and the fade that keeps text from running under the rooftop |
| `resume.pdf` | Résumé linked from the "Résumé" button |

Run locally: open `index.html`, or `python -m http.server` and visit http://localhost:8000.

Controls: scroll to walk · `A`/`D` walk · `W` jump · `T` dusk/night · `Ctrl/⌘ + K` or `/` menu. Leave her alone and she wanders off on her own.

Icons: [pixelarticons](https://pixelarticons.com) (MIT) loaded from jsDelivr.

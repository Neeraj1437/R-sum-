# Neeraj Rajiv Shivam — Portfolio

Personal portfolio site: LLM systems end to end (LoRA fine-tuning and evals, agents, Python backends), computer vision and edge AI.

Plain HTML, CSS and JavaScript with no build step, so it can be served directly by GitHub Pages.

| File | What it holds |
| --- | --- |
| `index.html` | All content (edit text here) |
| `style.css` | Pixel UI: violet dusk/night colour tokens, neon panels, lit-sign headings, the About player card and portrait, buttons |
| `girl.js` | The pink-haired player character as pixel frames (one character per pixel), traced from three sprite sheets: front, three-quarter, side and back poses, 6-frame walk and run cycles, jump (crouch, rise, tuck, fall, land), waving, relaxed standing poses, a calm smile, a stretch and yawn, turning round to face you, sitting down / leaning back / hugging her knees / getting up, and nodding off on the floor, plus breathing and blink frames |
| `world.js` | The violet neon city on two canvases: cloud bands, a far skyline with a domed tower, dense lit buildings with water towers, fire escapes and pink neon word signs (BAR, INN, BANK, ATM, XO…), an elevated train, a turning wall fan, the rooftop with AC units, CRTs and a vending machine, the home desk with fish tank and a sleeping orange cat, kiosks, black and orange cats, critters. Also runs her free-roaming behaviour (strolls, sprints, looks around, turns to watch the sky, waves, strikes a relaxed pose, smiles to herself, stretches and yawns, turns round to look at you, walks over to the rooftop benches to sit for a while, and sits down on the floor to nod off, with little z's). She only jumps when you press `W` or pick Jump! in the menu. `World.say(text, ms, mood)` shows a speech bubble; the optional mood (`'wave'`, `'notice'`, `'smile'`, `'gaze'`, `'look'`) makes her react as soon as she's free |
| `avatar.js` | The pixel portrait of Neeraj in the top bar and on the player card (frames in `images/avatar.png`, traced from a portrait sheet): he looks towards the pointer, blinks, says the hero line when the page opens, looks bored if left alone, looks away while the tab is hidden, and pulls faces when things happen (`Avatar.show(name, ms)`, `Avatar.talk(ms)`) |
| `script.js` | XP/discovery system, dusk/night, 8-bit sound, project filters, menu (command palette), contact form |
| `resume.pdf` | Résumé linked from the "Résumé" button |

Run locally: open `index.html`, or `python -m http.server` and visit http://localhost:8000.

Controls: scroll to walk · `A`/`D` walk · `W` jump · `T` dusk/night · `Ctrl/⌘ + K` or `/` menu. Leave her alone and she wanders off on her own.

Icons: [pixelarticons](https://pixelarticons.com) (MIT) loaded from jsDelivr.

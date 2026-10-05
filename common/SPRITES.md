# Sprites and fun: art direction for all 22 pieces

User direction (5 Oct 2026): "make sprites specific to the project ... not just graphs ... a lot of the
graphs are repetitive ... make it more fun." Every piece gets its own cast of characters and props,
drawn for that subject, so the first thing a visitor sees is a playful illustrated scene rather than a chart.

## The house style: "ultramarine ink pixel art"
- Pixel art on a 16–48 px base grid, scaled by integer factors, with smoothing off (`InkSprite` does this).
- A strict shared palette in the Moth Hack look: outline ink `K #19238E`, mid ink `B #545BA9`, light ink
  `L #A1A4CE`, tint `T #D3D3E6`, paper `W #FBFAF9`. Warm accent `O #B4541A` ONLY for light, fire, heat,
  glow or annihilation flashes. `G #1F7A4D` only for a rare "success" moment. No other colours in sprites.
  Engine-output artwork (blurred images and so on) keeps its own colours. Sprites are the cast around it.
- 1 px dark-ink outline on characters; 2–3 tone shading; readable silhouettes at 2× and 3×.
- Characters have personality: 2–6 frame idle loops (wing flap, blink, bob, tail flick), and they REACT
  to what the user does and to the real data (a whale's head pulses when its click sounds, a frog's throat
  puffs on its call, the bat swoops when it predicts you, a beaver steps along the tape).
- Animate only after a user action, or as a gentle idle loop on visible characters; respect
  `prefers-reduced-motion` (InkSprite.frameAt returns frame 0 then).

## Rules
1. Use the shared helper `common/inksprite.js`: inline it into the page at build time (replace a
   `/*INKSPRITE*/` marker inside a `<script>` with the file contents). Hand-authored SVG ink illustrations
   are fine too, in the same palette, for large scenes (a pond, a loom, a telescope).
2. **Scene first, data one click away.** The default view is the illustrated scene or game. Charts move
   behind a `.seg` "Scene / Data" toggle, or into a drawer. Keep every chart that carries a result, just
   not as the hero, and remove duplicate charts that repeat the same information.
3. **Sprites never fake data.** Anything a sprite does that looks like a measurement must be driven by the
   real cached job data already on the page (counts, timings, outcomes). Decorative motion is clearly
   decorative. Keep all honesty labels and drawers.
4. **The user stays in control:** sprites respond to the user's clicks, drags and keys; nothing big
   happens on its own; pause and reset still work.
5. Keep sprite pixel data in ONE place, `web/sprites.json` (`{"name": {"frames": [[rows...], ...], "fps": 8}}`),
   inline it into the page at build time, and use it for both the page and the mascot. Make a **mascot**:
   `python common/mascot.py entries/NN-slug/web/sprites.json <name> entries/NN-slug/web/img/mascot.png --scale 4`
   (transparent PNG, roughly 96–192 px) for the hub. Add `"mascot": "web/img/mascot.png"` to piece.json and
   list the file in web/files.json.
6. Small celebratory moments are good (a moth reaching home, a restored tiling sparkle, a correct guess)
   but keep them brief, skippable and honest.
7. Keep everything else from BUILD_GUIDE.md: the Moth look, ASCII page, files.json, page QA ok, audio on
   the page with play/stop, no autoplay, and no new Atlas jobs (MOTH_FREEZE=1).

## Realism pass (user, 5 Oct 2026 ~02:00): "make the sprites real life"
For pieces 03, 07, 08, 10, 12 and 14 the user wants REAL-LIFE, scientifically accurate depictions of the
actual objects, not cute cartoons:
- Draw from how the real thing looks. Use WebSearch/WebFetch to read descriptions and check anatomy,
  geometry and proportions. Draw your own original art and never trace or embed photos.
- Use higher-resolution pixel art (64-160 px base) with 4-5 ink tones, OR detailed SVG ink
  "engraving / scientific plate" illustrations (hatching, hairline leader lines, labelled callouts).
  Keep the shared palette (ink tones + paper; O only for light/heat).
- Accuracy matters: the right number of LIGO arms and their 4 km length, a dilution refrigerator's stacked
  gold plates, a compound eye's hexagonal ommatidia, the fly brain's real neuropils, and so on. Label the
  parts. Cute faces and anthropomorphic characters are replaced by (or demoted beneath) realistic subjects.
- Keep the interactivity, the data binding, the honesty labels, audio on the page, QA ok and MOTH_FREEZE=1.

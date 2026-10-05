/* InkSprite: tiny pixel-art sprite helper shared by every piece of "What the Noise Remembers".
   Inline it into a page by putting the comment marker for INKSPRITE inside a <script> and replacing it
   in build_web.py with this file's text (see common/SPRITES.md).

   Sprites are authored as arrays of strings, one char per pixel, using the shared ink palette:
     '.' or ' ' transparent   'K' ink #19238E (outline)   'B' ink-2 #545BA9   'L' ink-3 #A1A4CE
     'T' tint #D3D3E6         'W' paper #FBFAF9 (white)    'O' warm accent #B4541A (light, fire, heat ONLY)
     'G' good #1F7A4D (sparingly)
   Extra keys can be passed per sprite.

   const moth = InkSprite.make({ frames: [ ["..K..", ".KBK.", ...], [...] ], fps: 8 });
   InkSprite.draw(ctx, moth, frameIndex, x, y, scale, {flipX, alpha, rotate});   // x,y = centre
   const t = InkSprite.frameAt(moth, timeSeconds);                                 // looping frame index
   InkSprite.toDataURL(moth, 0, 4) -> PNG data URL (for <img>, favicons, CSS backgrounds)
*/
(function (root) {
  const PALETTE = { K: '#19238E', B: '#545BA9', L: '#A1A4CE', T: '#D3D3E6', W: '#FBFAF9', O: '#B4541A', G: '#1F7A4D' };
  const cache = new Map();
  let uid = 0;

  function make(def) {
    const frames = (def.frames || [def.rows]).map(f => f.map(r => r.replace(/\s/g, '.')));
    const h = frames[0].length, w = Math.max(...frames[0].map(r => r.length));
    return { id: ++uid, frames, w, h, fps: def.fps || 6, palette: Object.assign({}, PALETTE, def.palette || {}) };
  }

  function bake(sp, f, scale) {
    const key = sp.id + ':' + f + ':' + scale;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = sp.w * scale; c.height = sp.h * scale;
    const x = c.getContext('2d');
    const rows = sp.frames[f % sp.frames.length];
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.' || !sp.palette[ch]) continue;
      x.fillStyle = sp.palette[ch];
      x.fillRect(i * scale, j * scale, scale, scale);
    }
    cache.set(key, c);
    return c;
  }

  function draw(ctx, sp, f, cx, cy, scale, o) {
    o = o || {};
    const img = bake(sp, f | 0, Math.max(1, Math.round(scale)));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(Math.round(cx), Math.round(cy));
    if (o.rotate) ctx.rotate(o.rotate);
    if (o.flipX) ctx.scale(-1, 1);
    if (o.flipY) ctx.scale(1, -1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  function frameAt(sp, t) {
    if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return Math.floor(t * sp.fps) % sp.frames.length;
  }

  function toDataURL(sp, f, scale) { return bake(sp, f || 0, scale || 4).toDataURL('image/png'); }

  root.InkSprite = { make, draw, frameAt, toDataURL, PALETTE };
})(typeof window !== 'undefined' ? window : globalThis);

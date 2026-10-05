export const meta = {
  name: 'images-piece',
  description: 'For each of the 22 pieces: one hero/poster image (1:1 to 4:3) and 5 more still images for the submission form',
  phases: [{ title: 'Images', detail: 'one quick agent per piece' }],
}
const ROOT = 'C:\\Users\\Rahma\\OneDrive\\Desktop\\MOTH QUANTUM'
const job = c => `CONTEXT: the user is filling in the Moth Hack 2026 submission form for each of the 22 pieces of "What the Noise Remembers" (playable quantum pieces on Moth Quantum's Atlas engines) and asked, verbatim: "do it for all 22 pieces we did pls for each piece which was in a challenge: hero image, 5 pics, presentation PER 22 things". This task is the hero image + 5 pics for ONE piece. The form says: Poster art: "Upload a single 'hero image' that we can use as a poster / preview thumbnail. (Aspect ratios between 1:1 and landscape 4:3 will be easiest for us to use.) ... if using an image-generating engine like Blur, just the output image itself." Additional images: "You may attach up to 5 more here." Be quick.
YOUR PIECE: ${c.title} (${ROOT}\\entries\\${c.slug}), Challenge ${c.ch} · ${c.chname}.
Candidates: the piece's hero.png and other figure PNGs (piece folder, out/, web/img/), ${ROOT}\\docs\\demos\\${c.slug}.png (page still, 640 wide), ${ROOT}\\entries\\${c.slug}\\qa\\*.png (1280x900 page screenshots), and frames of ${ROOT}\\docs\\demos\\${c.slug}.mp4 (ffmpeg from python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"). Look with Read (a downscaled contact sheet is fine) and choose the most striking, clear, varied ones: real engine outputs, the playable scene with its characters, a key figure or result. No near-duplicates.
Write into ${ROOT}\\submission\\${c.slug}\\ (create it):
- HERO_${c.slug}.png: ONE image, aspect ratio between 1:1 and 4:3 landscape (e.g. 1600x1200 or 1600x1600), at least 1200 px wide, under 5 MB: the single most striking engine output or page scene. If the best image is wider than 4:3 (e.g. a triptych), crop to its strongest panel or region, or pad onto #FBFAF9 paper; never stretch. Upscale pixel art with NEAREST, other images with LANCZOS.${c.hero ? ` A good hero already exists: ${c.hero}; use it unless something is clearly better.` : ''}
- 1_<name>.png ... 5_<name>.png: exactly 5 more stills (PNG or JPG, each under 5 MB, at least 960 px wide where the source allows), named for what they show.
Check with Pillow: list sizes and dimensions; the hero ratio must be within 1.0-1.334. Return the files with one line each on what they show.`
const OUT = {type:'object', properties:{slug:{type:'string'}, files:{type:'array', items:{type:'object', properties:{file:{type:'string'}, shows:{type:'string'}}, required:['file','shows']}}}, required:['slug','files']}
return await parallel(args.pieces.map(c => () => agent(job(c), {label:`img:${c.slug}`, phase:'Images', schema: OUT, effort:'low'})))

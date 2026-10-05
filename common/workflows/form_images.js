export const meta = {
  name: 'form-images',
  description: 'For each challenge: one hero/poster image (1:1 to 4:3) and 5 additional still images for the submission form',
  phases: [{ title: 'Images', detail: 'one quick agent per challenge' }],
}
const ROOT = 'C:\\Users\\Rahma\\OneDrive\\Desktop\\MOTH QUANTUM'
const job = c => `CONTEXT: the user is filling in the Moth Hack 2026 submission form for "What the Noise Remembers" (22 playable quantum pieces on Moth Quantum's Atlas engines), one submission per challenge, and asked, verbatim: "just want for each challenge: hero image , 5 other images, presentation thats it". The form says: Poster art: "Upload a single 'hero image' that we can use as a poster / preview thumbnail. (Aspect ratios between 1:1 and landscape 4:3 will be easiest for us to use.) ... if using an image-generating engine like Blur, just the output image itself." Additional images: "Want to include additional still images? You may attach up to 5 more here." Be quick.
YOUR CHALLENGE: Challenge ${c.n} · ${c.name}. Pieces: ${c.pieces.join(', ')} (folders in ${ROOT}\\entries\\).
Candidates: each piece's hero.png and other figure PNGs (piece folder, out/, web/img/), ${ROOT}\\docs\\demos\\<slug>.png (page still, 640 wide), ${ROOT}\\entries\\<slug>\\qa\\desktop.png and other qa/*.png (1280x900 page screenshots), and frames of ${ROOT}\\docs\\demos\\<slug>.mp4 (extract with the ffmpeg from python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"). Look at candidates with Read (downscaled contact sheets are fine) and choose the most striking, clear, varied ones: real engine outputs, the playable scene with its characters, a key figure. No near-duplicates; cover every piece in the challenge.
Write into ${ROOT}\\submission\\challenge-${c.n}\\FOR_FORM\\ (create it; leave other files in submission\\challenge-${c.n}\\ alone):
- HERO_<short-name>.png: ONE image, aspect ratio between 1:1 and 4:3 landscape (e.g. 1600x1200 or 1600x1600), at least 1200 px wide, under 5 MB: the single most striking engine output or page scene for this challenge. If the best image is wider than 4:3 (e.g. a triptych), crop to its strongest panel or region, or pad onto #FBFAF9 paper; never stretch. Upscale small pixel-art with NEAREST, photos with LANCZOS.${c.hero ? ` A hero already exists for this challenge: ${c.hero}; use it (copy it in) unless something is clearly better.` : ''}
- 1_<name>.png ... 5_<name>.png: exactly 5 more stills (PNG or JPG, each under 5 MB, at least 960 px wide where the source allows), named for what they show.
Then check: list the folder with sizes and pixel dimensions (Pillow) and confirm the hero ratio is within 1.0-1.334. Return the files and a one-line description of each.`
const OUT = {type:'object', properties:{challenge:{type:'string'}, files:{type:'array', items:{type:'object', properties:{file:{type:'string'}, size:{type:'string'}, shows:{type:'string'}}, required:['file','size','shows']}}}, required:['challenge','files']}
const res = await parallel(args.challenges.map(c => () => agent(job(c), {label:`img:${c.n}`, phase:'Images', schema: OUT})))
return res

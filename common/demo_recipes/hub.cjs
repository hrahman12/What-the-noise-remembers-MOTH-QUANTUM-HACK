// Hub tour: drag the before/after wipe, say hello to a few cast members, open a challenge row.
module.exports = async (page, h) => {
  const w = await h.center('#wipe');
  await h.drag({ x: w.box.x + w.box.width * 0.5, y: w.y }, { x: w.box.x + w.box.width * 0.12, y: w.y }, 30);
  await h.drag({ x: w.box.x + w.box.width * 0.12, y: w.y }, { x: w.box.x + w.box.width * 0.85, y: w.y }, 40);
  await h.wait(400);
  await page.evaluate(() => document.getElementById('cast-h').scrollIntoView({ behavior: 'smooth' }));
  await h.wait(900);
  for (const k of [2, 5, 8, 16, 19]) { await page.hover(`#parade a:nth-child(${k})`); await h.wait(650); }
  await page.evaluate(() => document.getElementById('index').scrollIntoView({ behavior: 'smooth' }));
  await h.wait(900);
  await page.click('#c05 > summary'); await h.wait(1400);
};

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Generate splash screens for Android (portrait) at common sizes
const defaultSrc = path.resolve(process.cwd(), 'futureisticVision.jpg');
const cleaned = path.resolve(process.cwd(), 'assets', 'icon-source.png');
const src = fs.existsSync(cleaned) ? cleaned : defaultSrc;
const outDir = path.resolve(process.cwd(), 'public', 'splash');
const sizes = [320, 480, 720, 960, 1280, 1440];

if (!fs.existsSync(src)) {
  console.error('Source image not found:', src);
  process.exit(1);
}
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

(async () => {
  for (const h of sizes) {
    const out = path.join(outDir, `splash-${h}.png`);
    // create a portrait splash with background and centered image
    await sharp(src)
      .resize({ height: h, fit: 'cover' })
      .png()
      .toFile(out);
    console.log('Generated', out);
  }
})();

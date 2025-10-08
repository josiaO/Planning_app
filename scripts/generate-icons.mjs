import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const sizes = [48, 72, 96, 144, 192, 256, 384, 512];
const defaultSrc = path.resolve(process.cwd(), 'futureisticVision.jpg');
const cleaned = path.resolve(process.cwd(), 'assets', 'icon-source.png');
const src = fs.existsSync(cleaned) ? cleaned : defaultSrc;
const outDir = path.resolve(process.cwd(), 'public', 'icons');

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function generate() {
  if (!fs.existsSync(src)) {
    console.error('Source image not found at', src);
    process.exit(1);
  }
  await ensureDir(outDir);
  for (const size of sizes) {
    const out = path.join(outDir, `icon-${size}x${size}.png`);
    await sharp(src).resize(size, size).png().toFile(out);
    console.log('Generated', out);
  }
  // also generate a 512x512 webmanifest icon alias
  const manifestOut = path.join(process.cwd(), 'public', 'icons', 'icon-512x512.png');
  await sharp(src).resize(512,512).png().toFile(manifestOut);
  console.log('Generated', manifestOut);
}

generate().catch((e) => { console.error(e); process.exit(1); });

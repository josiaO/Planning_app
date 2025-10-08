import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const srcJpg = path.resolve(process.cwd(), 'futureisticVision.jpg');
const outPng = path.resolve(process.cwd(), 'assets', 'icon-source.png');

if (!fs.existsSync(srcJpg)) {
  console.error('Source JPG not found at', srcJpg);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outPng), { recursive: true });

(async () => {
  // center-crop to square at 2048 then save as PNG for best quality
  await sharp(srcJpg).resize(2048, 2048, { fit: 'cover', position: 'centre' }).png().toFile(outPng);
  console.log('Generated cleaned PNG at', outPng);
})();

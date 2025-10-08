import fs from 'fs';
import path from 'path';

const androidResDir = path.resolve(process.cwd(), 'android', 'app', 'src', 'main', 'res');
const publicIcons = path.resolve(process.cwd(), 'public', 'icons');
const publicSplash = path.resolve(process.cwd(), 'public', 'splash');
const androidTemplates = path.resolve(process.cwd(), 'scripts', 'android_templates');

if (!fs.existsSync(androidResDir)) {
  console.warn('Android resources directory not found. Run this after you add Android platform.');
  process.exit(0);
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// Copy icons into mipmap folders
const mipmapMap = [
  { icon: 'icon-48x48.png', folder: 'mipmap-mdpi' },
  { icon: 'icon-72x72.png', folder: 'mipmap-hdpi' },
  { icon: 'icon-96x96.png', folder: 'mipmap-xhdpi' },
  { icon: 'icon-144x144.png', folder: 'mipmap-xxhdpi' },
  { icon: 'icon-192x192.png', folder: 'mipmap-xxxhdpi' },
  { icon: 'icon-512x512.png', folder: 'mipmap-xxxhdpi' }
];

for (const m of mipmapMap) {
  const src = path.join(publicIcons, m.icon);
  const dest = path.join(androidResDir, m.folder, 'ic_launcher.png');
  copyIfExists(src, dest);
}

// copy splash images to drawable-nodpi
if (fs.existsSync(publicSplash)) {
  const destDir = path.join(androidResDir, 'drawable-nodpi');
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of fs.readdirSync(publicSplash)) {
    copyIfExists(path.join(publicSplash, f), path.join(destDir, f));
  }
}

// copy Android template XMLs (launch_background, styles) if present
if (fs.existsSync(androidTemplates)) {
  // launch_background.xml -> drawable
  const launchSrc = path.join(androidTemplates, 'launch_background.xml');
  if (fs.existsSync(launchSrc)) {
    copyIfExists(launchSrc, path.join(androidResDir, 'drawable', 'launch_background.xml'));
  }
  // styles.xml -> values
  const stylesSrc = path.join(androidTemplates, 'styles.xml');
  if (fs.existsSync(stylesSrc)) {
    copyIfExists(stylesSrc, path.join(androidResDir, 'values', 'styles.xml'));
  }
  // AndroidManifest.xml -> android/app/src/main/AndroidManifest.xml
  const manifestSrc = path.join(androidTemplates, 'AndroidManifest.xml');
  if (fs.existsSync(manifestSrc)) {
    const dest = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    copyIfExists(manifestSrc, dest);
  }
}

console.log('Resources copied (if Android platform exists).');

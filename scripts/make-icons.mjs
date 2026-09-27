import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="220" fill="#07080C"/>
  <circle cx="512" cy="400" r="168" fill="#D6FF4A"/>
  <rect x="292" y="640" width="440" height="92" rx="46" fill="#8B7CFF"/>
</svg>`;

const dir = fileURLToPath(new URL('../apps/mobile/assets/', import.meta.url));
await mkdir(dir, { recursive: true });
const png = await sharp(Buffer.from(svg)).png().toBuffer();
for (const name of ['icon.png', 'splash-icon.png', 'android-icon-foreground.png', 'android-icon-background.png', 'android-icon-monochrome.png']) {
  await sharp(png).resize(1024, 1024).toFile(path.join(dir, name));
}
await sharp(png).resize(48, 48).toFile(path.join(dir, 'favicon.png'));
console.log('Iconos escritos en apps/mobile/assets');

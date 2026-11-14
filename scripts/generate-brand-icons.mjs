import fs from 'node:fs/promises';
import sharp from 'sharp';

const source = await fs.readFile(new URL('../app/icon.svg', import.meta.url));
await sharp(source).resize(180, 180).flatten({ background: '#050505' }).png().toFile(new URL('../app/apple-icon.png', import.meta.url).pathname);
const sizes = [16, 32, 48, 256];
const images = await Promise.all(sizes.map(size => sharp(source).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let i = 0; i < sizes.length; i++) {
  const entry = 6 + i * 16;
  header[entry] = header[entry + 1] = sizes[i] === 256 ? 0 : sizes[i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[i].length;
}
await fs.writeFile(new URL('../app/favicon.ico', import.meta.url), Buffer.concat([header, ...images]));

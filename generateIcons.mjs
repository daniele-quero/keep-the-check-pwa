// Script Node.js per generare PNG da SVG usando sharp (se disponibile)
// Altrimenti usa questo SVG direttamente come fallback

// Per generare le PNG:
// 1. npm install -D sharp
// 2. node generateIcons.mjs
// 3. Trovi icon-192.png e icon-512.png in public/

import { readFile, writeFile } from "fs/promises";
import sharp from "sharp";

const svgBuffer = await readFile("public/icon.svg");

await sharp(svgBuffer).resize(192, 192).png().toFile("public/icon-192.png");
await sharp(svgBuffer).resize(512, 512).png().toFile("public/icon-512.png");

console.log("? icon-192.png");
console.log("? icon-512.png");

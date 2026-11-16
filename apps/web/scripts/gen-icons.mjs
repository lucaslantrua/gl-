// Génère les icônes PNG de la PWA à partir de public/favicon.svg.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
// Version "maskable" : fond plein bord à bord, motif réduit dans la zone de sécurité.
const maskable = svg.replace('rx="112"', 'rx="0"').replace('<clipPath', '<g transform="translate(64 64) scale(.75)"><clipPath').replace('</svg>', '</g></svg>');
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname;

await sharp(Buffer.from(svg)).resize(192).png().toFile(out('pwa-192.png'));
await sharp(Buffer.from(svg)).resize(512).png().toFile(out('pwa-512.png'));
await sharp(Buffer.from(maskable)).resize(512).png().toFile(out('pwa-maskable-512.png'));
await sharp(Buffer.from(maskable)).resize(180).png().toFile(out('apple-touch-icon.png'));
console.log('icônes générées');

// Copies the MediaPipe wasm runtime into public/ so the app needs no CDN. Idempotent.
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const src = 'node_modules/@mediapipe/tasks-vision/wasm';
const dest = 'public/mediapipe/wasm';
if (!existsSync(src)) {
  console.log('[copy-mediapipe] tasks-vision not installed yet, skipping');
} else {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log('[copy-mediapipe] wasm copied to', dest);
}

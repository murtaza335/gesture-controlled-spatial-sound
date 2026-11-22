import { CONFIG } from '../config.js';

export class CameraError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Opens the webcam into a <video>. Throws CameraError with a user-readable message. */
export async function startCamera(videoEl) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported', 'Camera is not available in this browser. Using mouse mode instead.');
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: CONFIG.VIDEO.width, height: CONFIG.VIDEO.height, facingMode: 'user' },
      audio: false,
    });
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      throw new CameraError('denied', 'Camera blocked. Allow camera access in the address bar, then press Start again. Using mouse mode for now.');
    }
    if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
      throw new CameraError('missing', 'No camera found. Using mouse mode instead (press M to toggle).');
    }
    throw new CameraError('failed', `Camera could not start (${err.name}). Using mouse mode instead.`);
  }
  videoEl.srcObject = stream;
  videoEl.muted = true;
  videoEl.playsInline = true;
  await videoEl.play();
  return stream;
}

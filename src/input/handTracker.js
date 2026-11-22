import { CONFIG } from '../config.js';
import { createHandFrameBuilder } from './handFrame.js';

const BASE = import.meta.env.BASE_URL;

/** Creates the MediaPipe hand tracker. Tries GPU, falls back to CPU. */
export async function createHandTracker(videoEl) {
  const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(`${BASE}mediapipe/wasm`);

  const options = (delegate) => ({
    baseOptions: { modelAssetPath: `${BASE}models/hand_landmarker.task`, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  let delegate = 'GPU';
  let landmarker;
  try {
    landmarker = await HandLandmarker.createFromOptions(vision, options('GPU'));
  } catch (err) {
    console.warn('GPU delegate failed, using CPU', err);
    delegate = 'CPU';
    landmarker = await HandLandmarker.createFromOptions(vision, options('CPU'));
  }

  const builder = createHandFrameBuilder(CONFIG);
  let lastVideoTime = -1;
  let lastTs = 0;
  let frame = { t: 0, left: null, right: null, source: 'camera' };
  const stats = { delegate, trackMs: 0, trackFps: 0 };
  let fpsCount = 0;
  let fpsStart = performance.now();

  return {
    stats,
    /** Runs detection only on new video frames; otherwise returns the previous frame. */
    getFrame(now) {
      if (videoEl.readyState >= 2 && videoEl.currentTime !== lastVideoTime) {
        lastVideoTime = videoEl.currentTime;
        const ts = Math.max(now, lastTs + 1); // must strictly increase
        lastTs = ts;
        const t0 = performance.now();
        const result = landmarker.detectForVideo(videoEl, ts);
        stats.trackMs = performance.now() - t0;
        frame = builder.build(result, ts);
        fpsCount++;
        if (now - fpsStart >= 1000) {
          stats.trackFps = (fpsCount * 1000) / (now - fpsStart);
          fpsCount = 0;
          fpsStart = now;
        }
      }
      return frame;
    },
    close() {
      landmarker.close();
    },
  };
}

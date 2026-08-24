// Frame sources. A video and a set of still images are exposed through the same
// interface, so the rest of the app never branches on the input kind.
//
// Browser-only (uses <video>, requestVideoFrameCallback and createImageBitmap).

'use strict';

/**
 * @typedef {Object} Frame
 * @property {CanvasImageSource} image
 * @property {number} width
 * @property {number} height
 * @property {number|null} time media time in seconds (null for still images)
 *
 * @typedef {Object} FrameSource
 * @property {'video'|'images'} kind
 * @property {string} name
 * @property {string[]} files
 * @property {number} width
 * @property {number} height
 * @property {number} frameCount
 * @property {number|null} fps
 * @property {'detected'|'manual'|null} fpsSource
 * @property {(index: number) => Promise<Frame>} getFrame
 * @property {(fps: number) => void} setFps
 * @property {() => void} dispose
 */

/** Frame rates that real cameras and containers actually use. */
const COMMON_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 119.88, 120, 200, 240];

/**
 * Snap a measured frame rate to a standard one when it is within 2%.
 * @param {number} f
 * @returns {number}
 */
function snapFps(f) {
  for (const c of COMMON_FPS) {
    if (Math.abs(f - c) / c < 0.02) return c;
  }
  return Math.round(f * 1000) / 1000;
}

/**
 * Measure the frame rate by playing a short burst and reading the frame metadata
 * that the browser reports for each presented frame.
 * @param {HTMLVideoElement} video
 * @returns {Promise<number|null>} null when the browser has no requestVideoFrameCallback
 */
function detectVideoFps(video) {
  const rvfc = /** @type {any} */ (video).requestVideoFrameCallback;
  if (typeof rvfc !== 'function') return Promise.resolve(null);

  return new Promise((resolve) => {
    /** @type {any} */ let first = null;
    /** @type {any} */ let last = null;
    let seen = 0;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.pause();
      if (!first || !last) return resolve(null);
      const dt = last.mediaTime - first.mediaTime;
      const df = last.presentedFrames - first.presentedFrames;
      if (!(dt > 0) || !(df > 0)) return resolve(null);
      resolve(snapFps(df / dt));
    };

    const onFrame = (/** @type {number} */ _now, /** @type {any} */ meta) => {
      if (done) return;
      if (!first) first = meta;
      else last = meta;
      seen++;
      if (seen >= 24) return finish();
      rvfc.call(video, onFrame);
    };

    const timer = setTimeout(finish, 4000);
    video.muted = true;
    video.currentTime = 0;
    video.play().then(() => rvfc.call(video, onFrame)).catch(() => finish());
  });
}

/**
 * Media time of the frame the browser actually presented, when it can tell us.
 * @param {HTMLVideoElement} video
 * @returns {Promise<number|null>}
 */
function presentedMediaTime(video) {
  const rvfc = /** @type {any} */ (video).requestVideoFrameCallback;
  if (typeof rvfc !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve(null); }
    }, 250);
    rvfc.call(video, (/** @type {number} */ _now, /** @type {any} */ meta) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(meta.mediaTime);
    });
  });
}

/**
 * Some containers (notably WebM written by MediaRecorder) report duration as Infinity
 * until the video has been seeked to its end. Force the browser to resolve it.
 * @param {HTMLVideoElement} video
 * @returns {Promise<void>}
 */
function ensureDuration(video) {
  if (isFinite(video.duration) && video.duration > 0) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('timeupdate', onUpdate);
      clearTimeout(timer);
      try { video.currentTime = 0; } catch (e) { /* nothing to reset */ }
      resolve();
    };
    const onUpdate = () => { if (isFinite(video.duration)) finish(); };
    const timer = setTimeout(finish, 3000);
    video.addEventListener('timeupdate', onUpdate);
    video.currentTime = 1e7;
  });
}

/**
 * @param {File} file
 * @param {(msg: string) => void} log
 * @returns {Promise<FrameSource>}
 */
async function createVideoSource(file, log) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve(undefined);
    video.onerror = () => reject(new Error(`動画を読み込めませんでした: ${file.name}`));
  });
  await ensureDuration(video);
  const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  if (duration === 0) {
    log('警告: この動画の長さを取得できませんでした。フレーム送りができない可能性があります。');
  }

  log('フレームレートを検出中...');
  let fps = await detectVideoFps(video);
  /** @type {'detected'|'manual'} */
  let fpsSource = 'detected';
  if (!fps) {
    fps = 30;
    fpsSource = 'manual';
    log('フレームレートを自動検出できませんでした（このブラウザは requestVideoFrameCallback 非対応）。30 fps と仮定します。ツールバーで変更できます。');
  } else {
    log(`フレームレート検出: ${fps} fps`);
  }
  video.currentTime = 0;

  const src = /** @type {FrameSource} */ ({
    kind: 'video',
    name: file.name,
    files: [file.name],
    width: video.videoWidth,
    height: video.videoHeight,
    fps,
    fpsSource,
    frameCount: Math.max(1, Math.round(duration * fps)),

    setFps(newFps) {
      src.fps = newFps;
      src.fpsSource = 'manual';
      src.frameCount = Math.max(1, Math.round(duration * newFps));
    },

    async getFrame(index) {
      const f = src.fps || 30;
      // aim at the middle of the frame interval: robust against rounding at frame edges
      const target = Math.min((index + 0.5) / f, Math.max(0, duration - 1e-4));
      if (Math.abs(video.currentTime - target) > 1e-6) {
        await new Promise((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve(undefined);
          };
          video.addEventListener('seeked', onSeeked);
          video.currentTime = target;
        });
      }
      const media = await presentedMediaTime(video);
      return {
        image: video,
        width: video.videoWidth,
        height: video.videoHeight,
        time: media === null ? video.currentTime : media,
      };
    },

    dispose() {
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    },
  });
  return src;
}

/**
 * @param {File[]} files
 * @param {(msg: string) => void} log
 * @returns {Promise<FrameSource>}
 */
async function createImageSource(files, log) {
  const sorted = files.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const bitmaps = await Promise.all(sorted.map(async (f) => {
    try {
      return await createImageBitmap(f);
    } catch (e) {
      throw new Error(`画像を読み込めませんでした: ${f.name}`);
    }
  }));

  const sizes = bitmaps.map((b) => `${b.width}x${b.height}`);
  if (new Set(sizes).size > 1) {
    log(`警告: 画像のサイズが揃っていません（${Array.from(new Set(sizes)).join(', ')}）。キャリブレーションは全画像で共通に適用されるため、拡大率が異なる画像では実世界座標がずれます。`);
  }

  const src = /** @type {FrameSource} */ ({
    kind: 'images',
    name: sorted.length === 1 ? sorted[0].name : `${sorted.length} 枚の画像`,
    files: sorted.map((f) => f.name),
    width: bitmaps[0].width,
    height: bitmaps[0].height,
    fps: null,
    fpsSource: null,
    frameCount: bitmaps.length,
    setFps() { /* not applicable to still images */ },
    async getFrame(index) {
      const b = bitmaps[index];
      return { image: b, width: b.width, height: b.height, time: null };
    },
    dispose() {
      for (const b of bitmaps) b.close();
    },
  });
  return src;
}

if (typeof module !== 'undefined') {
  module.exports = { snapFps, COMMON_FPS };
}

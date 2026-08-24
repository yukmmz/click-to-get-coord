// Builders for every artifact written into the output folder.
// Everything here is a pure function of the dataset, so it is unit-testable in node.

'use strict';

/**
 * @typedef {{x: number, y: number}} Pt
 * @typedef {{p0: Pt, r0: Pt, scaleX: number, scaleY: number}} Transform
 *
 * @typedef {Object} Dataset
 * @property {string} appVersion
 * @property {string} exportedAt           ISO 8601, local time offset included
 * @property {'video'|'images'} sourceKind
 * @property {string} sourceName           video file name, or a summary for image sets
 * @property {string[]} sourceFiles        every input file name, in frame order
 * @property {number} width                frame width in pixels
 * @property {number} height               frame height in pixels
 * @property {number|null} fps             video only
 * @property {'detected'|'manual'|null} fpsSource
 * @property {number} frameCount
 * @property {(number|null)[]} frameTimes  media time (s) of each frame; null for images
 * @property {Transform|null} transform
 * @property {Pt[]} calibImg               the two calibration points, image coords
 * @property {Pt[]} calibReal              the two calibration points, real coords
 * @property {Pt[][]} framesRaw            clicked points per frame, image coords
 * @property {Pt[][]} framesReal           the same points in real coords (NaN when uncalibrated)
 */

/** Where the app lives, so a stray output folder can always be traced back to it. */
const APP_URL = 'https://yukmmz.github.io/click-to-get-coord/';
const SOURCE_URL = 'https://github.com/yukmmz/click-to-get-coord';

const CSV_COLUMNS = ['frame_index', 'frame_number', 'time_sec', 'point_index', 'x_img', 'y_img', 'x_real', 'y_real'];

/** @param {number} v */
function num(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'NaN';
  return String(Number(v.toFixed(6)));
}

/**
 * One CSV holding every point of every frame, with the metadata as `#` comment lines.
 * @param {Dataset} d
 * @returns {string}
 */
function buildCsv(d) {
  const t = d.transform;
  const lines = [
    `# click-to-get-coord ${d.appVersion} — coordinate export`,
    `# app: ${APP_URL}`,
    `# source: ${SOURCE_URL}`,
    `# exported_at: ${d.exportedAt}`,
    `# source_kind: ${d.sourceKind}`,
    `# source_name: ${d.sourceName}`,
    `# frame_count: ${d.frameCount}`,
    `# image_size_px: ${d.width}x${d.height}`,
    `# fps: ${d.fps === null ? 'n/a' : `${d.fps} (${d.fpsSource})`}`,
    '# calibration: X = r0x + (x_img - p0x) * scale_x ; Y = r0y + (y_img - p0y) * scale_y',
    t
      ? `# calibration_params: p0=(${num(t.p0.x)}, ${num(t.p0.y)}) r0=(${num(t.r0.x)}, ${num(t.r0.y)}) scale_x=${num(t.scaleX)} scale_y=${num(t.scaleY)}`
      : '# calibration_params: none (x_real / y_real are NaN)',
    '# x_img,y_img are pixels; origin at top-left, y grows downward.',
    '# x_real,y_real are in the unit the user typed during calibration.',
    CSV_COLUMNS.join(','),
  ];

  for (let f = 0; f < d.framesRaw.length; f++) {
    const raw = d.framesRaw[f];
    const real = d.framesReal[f] || [];
    const time = d.frameTimes[f];
    for (let i = 0; i < raw.length; i++) {
      const r = real[i] || { x: NaN, y: NaN };
      lines.push([
        f,
        f + 1,
        time === null || time === undefined ? '' : num(time),
        i,
        num(raw[i].x),
        num(raw[i].y),
        num(r.x),
        num(r.y),
      ].join(','));
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Variables written into the .mat file.
 * coords_raw / coords_real keep the exact layout of the original Python tool.
 * @param {Dataset} d
 */
function buildMatVars(d) {
  const t = d.transform;
  /** @type {Record<string, any>} */
  const vars = {
    coords_raw: { kind: 'cell', value: d.framesRaw },
    coords_real: { kind: 'cell', value: d.framesReal },
    source_name: { kind: 'char', value: d.sourceName },
    source_kind: { kind: 'char', value: d.sourceKind },
    image_size: { kind: 'matrix', rows: 1, cols: 2, data: [d.width, d.height] },
    fps: { kind: 'matrix', rows: 1, cols: 1, data: [d.fps === null ? NaN : d.fps] },
    frame_times: {
      kind: 'matrix',
      rows: 1,
      cols: d.frameTimes.length,
      data: d.frameTimes.map((v) => (v === null || v === undefined ? NaN : v)),
    },
    calib_img: {
      kind: 'matrix',
      rows: d.calibImg.length,
      cols: 2,
      data: d.calibImg.map((p) => p.x).concat(d.calibImg.map((p) => p.y)),
    },
    calib_real: {
      kind: 'matrix',
      rows: d.calibReal.length,
      cols: 2,
      data: d.calibReal.map((p) => p.x).concat(d.calibReal.map((p) => p.y)),
    },
    calib_scale: {
      kind: 'matrix',
      rows: 1,
      cols: 2,
      data: t ? [t.scaleX, t.scaleY] : [NaN, NaN],
    },
  };
  return vars;
}

/**
 * Full state, re-loadable by the app to continue an interrupted session.
 * @param {Dataset} d
 * @returns {string}
 */
function buildSessionJson(d) {
  return JSON.stringify({
    format: 'click-to-get-coord/session',
    formatVersion: 1,
    appVersion: d.appVersion,
    appUrl: APP_URL,
    sourceUrl: SOURCE_URL,
    exportedAt: d.exportedAt,
    source: {
      kind: d.sourceKind,
      name: d.sourceName,
      files: d.sourceFiles,
      width: d.width,
      height: d.height,
      fps: d.fps,
      fpsSource: d.fpsSource,
      frameCount: d.frameCount,
      frameTimes: d.frameTimes,
    },
    calibration: d.transform
      ? { imagePoints: d.calibImg, realPoints: d.calibReal, transform: d.transform }
      : null,
    framesRaw: d.framesRaw,
  }, null, 2) + '\n';
}

/**
 * Self-contained description of the output folder, as Markdown: someone (or something)
 * reading only this file plus the folder contents must be able to interpret every number.
 * @param {Dataset} d
 * @param {string[]} fileNames names actually written, in write order
 * @returns {string}
 */
function buildReadme(d, fileNames) {
  const t = d.transform;
  const hasPlots = fileNames.some((f) => f.startsWith('plot_frame_'));
  const hasOverlays = fileNames.some((f) => f.startsWith('overlay_frame_'));

  const calibBlock = t
    ? [
      '```',
      `画像点 p0 = (${num(t.p0.x)}, ${num(t.p0.y)}) [px]  ->  実世界点 r0 = (${num(t.r0.x)}, ${num(t.r0.y)})`,
      `画像点 p1 = (${num(d.calibImg[1] ? d.calibImg[1].x : NaN)}, ${num(d.calibImg[1] ? d.calibImg[1].y : NaN)}) [px]`
        + `  ->  実世界点 r1 = (${num(d.calibReal[1] ? d.calibReal[1].x : NaN)}, ${num(d.calibReal[1] ? d.calibReal[1].y : NaN)})`,
      `scale_x = ${num(t.scaleX)}   [実世界単位 / px]`,
      `scale_y = ${num(t.scaleY)}   [実世界単位 / px]`,
      '```',
    ].join('\n')
    : '**キャリブレーション未実施。実世界座標は全て NaN です。**';

  const sourceBlock = d.sourceKind === 'video'
    ? `| フレームレート | ${d.fps === null ? '不明' : `${d.fps} fps`}（${d.fpsSource === 'detected' ? 'ブラウザの requestVideoFrameCallback による自動検出' : '利用者が手入力'}） |

各フレームの実際の再生時刻は \`frame_times\` / \`time_sec\` 列に秒単位で記録されています。
フレーム番号は「先頭を 0 とする通し番号」であり、動画コンテナ内部のフレーム番号と厳密に
一致する保証はありません。**時刻の方が信頼できます。**`
    : `
入力ファイル（フレーム順）:

| frame_index | ファイル名 |
|---|---|
${d.sourceFiles.map((f, i) => `| ${i} | ${f} |`).join('\n')}`;

  const sections = [];

  sections.push(`# click-to-get-coord — 出力データ

このファイルは、同じフォルダ内の全ファイルを、アプリの仕様を知らない読み手
（人間・プログラム・AI のいずれでも）が単独で解釈できるように書かれています。

| 項目 | 内容 |
|---|---|
| 生成アプリ | click-to-get-coord ${d.appVersion} |
| 出力日時 | ${d.exportedAt} |
| アプリ | ${APP_URL} |
| ソースコード | ${SOURCE_URL} |

ブラウザ上で動画または画像をクリックし、クリック点の画素座標を2点キャリブレーションで
実世界座標へ変換して記録するツールです。同じアプリを開けば、下記の \`session.json\` から
この作業を再開できます。`);

  sections.push(`## 1. 入力データ

| 項目 | 内容 |
|---|---|
| 種別 | ${d.sourceKind === 'video' ? '動画 (video)' : '画像 (images)'} |
| 名前 | ${d.sourceName} |
| フレーム数 | ${d.frameCount} |
| 画像サイズ | 幅 ${d.width} px × 高さ ${d.height} px |
${sourceBlock}`);

  sections.push(`## 2. 座標系

### 画素座標 (x_img, y_img)

原点は画像の左上。x は右方向、y は下方向が正。単位は px。
値は連続値（サブピクセル）で、クリック位置を画像解像度へ換算したものです。

### 実世界座標 (x_real, y_real)

利用者がキャリブレーション時に入力した数値の単位（mm, m, 任意単位など。アプリは単位を
関知しません）。以下の軸ごとの線形変換で画素座標から求めます。

\`\`\`
x_real = r0x + (x_img - p0x) * scale_x
y_real = r0y + (y_img - p0y) * scale_y
\`\`\`

回転は含みません（画像の軸と実世界の軸が平行である前提）。実世界 Y 軸が上向きの場合、
画像 y が下向きのため scale_y は負になります。

本データのキャリブレーション値:

${calibBlock}

\`NaN\` は「キャリブレーション前に打たれた点」または「キャリブレーション無し」を意味します。`);

  sections.push(`## 3. ファイル一覧

${fileNames.map((f) => `- \`${f}\``).join('\n')}`);

  sections.push(`### coords.mat

MATLAB Level 5 形式（無圧縮）。MATLAB の \`load\`、Python の \`scipy.io.loadmat\` の
どちらでも読めます。

| 変数 | 内容 |
|---|---|
| \`coords_raw\` | 1×${d.frameCount} の cell 配列。\`coords_raw{i}\` は i 番目のフレームでクリックされた点の画素座標を並べた (n_i × 2) の double 行列。列は [x_img, y_img]、行はクリック順。点が無いフレームは 0×2 |
| \`coords_real\` | 同じ構造で、実世界座標 [x_real, y_real]。未キャリブレーション時は NaN |
| \`source_name\` | 入力データ名（文字列） |
| \`source_kind\` | \`'video'\` または \`'images'\`（文字列） |
| \`image_size\` | 1×2 double [幅_px, 高さ_px] |
| \`fps\` | 1×1 double（画像入力時は NaN） |
| \`frame_times\` | 1×${d.frameCount} double。各フレームの再生時刻 [秒]（画像入力時は NaN） |
| \`calib_img\` | 2×2 double。キャリブレーション2点の画素座標。行=点, 列=[x, y] |
| \`calib_real\` | 2×2 double。上の2点に対応する実世界座標 |
| \`calib_scale\` | 1×2 double [scale_x, scale_y]（未キャリブレーション時は NaN） |

\`\`\`python
from scipy.io import loadmat

d = loadmat('coords.mat')
coords_real = d['coords_real'][0]     # shape (n_frames,) の object 配列
pts = coords_real[0]                  # フレーム0の点群, shape (n_points, 2)
x, y = pts[:, 0], pts[:, 1]
\`\`\`

\`\`\`matlab
S = load('coords.mat');
pts = S.coords_real{1};   % フレーム1（= frame_index 0）の点群 (n×2)
\`\`\``);

  sections.push(`### coords.csv

UTF-8 のテキスト。1行1点。\`#\` で始まる行はメタデータのコメントです。

| 列 | 内容 |
|---|---|
| \`frame_index\` | 0 から始まるフレーム番号 |
| \`frame_number\` | 1 から始まるフレーム番号（アプリ画面の表示と一致） |
| \`time_sec\` | そのフレームの再生時刻 [秒]（画像入力時は空欄） |
| \`point_index\` | そのフレーム内で何番目にクリックされたか（0 始まり） |
| \`x_img\`, \`y_img\` | 画素座標 [px] |
| \`x_real\`, \`y_real\` | 実世界座標（未キャリブレーション時は NaN） |

数値は小数6桁に丸めてあります。厳密な値が要る場合は \`coords.mat\` を使ってください。

\`\`\`python
import pandas as pd

df = pd.read_csv('coords.csv', comment='#')
\`\`\``);

  if (hasPlots) {
    sections.push(`### plot_frame_XXXX.png

実世界座標系でのクリック点のプロット。横軸 x_real、縦軸 y_real で、縦軸は上が正
（数学的な向き）に描いてあります。丸印がクリック点、それを結ぶ線はクリックされた順に
結んだ折れ線または平滑曲線。各点の脇の数字は \`point_index\`（0 始まり）。
\`XXXX\` は \`frame_index\` の4桁ゼロ埋めです。点が1つ以上あるフレームについてのみ生成されます。`);
  }

  if (hasOverlays) {
    sections.push(`### overlay_frame_XXXX.png

元のフレーム画像に、クリック点（塗り丸）とキャリブレーション点（別色の丸）を重ね描きした
検証用画像。座標は画素座標そのままなので、画像の画素位置と 1:1 で対応します。`);
  }

  if (!hasPlots || !hasOverlays) {
    const missing = !hasPlots && !hasOverlays ? 'プロット画像・重ね描き画像'
      : !hasPlots ? 'プロット画像' : '重ね描き画像';
    sections.push(`### フレームごとの PNG について

このフォルダに${missing}は含まれていません。動画は対象フレームが大量になりうるため、
既定で書き出しを止めています（アプリの設定で有効にできます）。数値データは
\`coords.mat\` と \`coords.csv\` に全て入っており、図はそこから作り直せます。`);
  }

  sections.push(`### session.json

アプリに読み戻して作業を再開するための完全な状態。\`format\` / \`formatVersion\` で形式を
識別します。\`source\` に入力データの情報、\`calibration\` にキャリブレーション2点と変換係数、
\`framesRaw\` にフレームごとのクリック点（画素座標）が入ります。実世界座標は
\`calibration\` から再計算できるため保存していません。

入力の動画・画像そのものは含まれません。再開時は同じファイルを開き直してください。`);

  sections.push(`## 4. 注意

- 実世界座標はキャリブレーション実施時点の変換で計算されます。後からキャリブレーションを
  やり直した場合は全フレームの実世界座標が再計算されるため、出力に含まれるのは
  **最後に有効だった変換の結果**です。
- 画素座標はクリック位置を画像の実解像度へ換算した値であり、表示倍率には依存しません。
`);

  return sections.join('\n\n');
}

if (typeof module !== 'undefined') {
  module.exports = { buildCsv, buildMatVars, buildSessionJson, buildReadme, CSV_COLUMNS };
}

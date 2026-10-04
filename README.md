# click-to-get-coord

*English / [日本語](README_ja.md)*

Click points on a **video or image** in your browser and get them back as
**real-world coordinates**, calibrated from two or three reference points.

No upload, no server, no install — everything runs locally in the browser.

**→ [Open App](https://yukmmz.github.io/click-to-get-coord/)**

## Features

- **Video or images** — step through video frames, or load a set of still images as a sequence
- **Two- or three-point calibration** — click two points, type their real-world coordinates, done.
  When they share x or y, a third point (e.g. origin, a point on the x axis, a point on the y axis) finishes it
- **Rulers** — drag horizontal / vertical guide lines over the frame; after calibration they show
  their position in real-world coordinates (screen only, never exported)
- **Add / Delete modes** — record points per frame, remove the nearest one
- **Frame-accurate stepping** — the frame rate is detected from the video itself
  (`requestVideoFrameCallback`), and the media time of every visited frame is recorded
- **Save to a folder** — pick an output folder and the tool writes every artifact into it
- **Resume later** — reload `session.json` to continue where you left off
- **Japanese / English UI** — follows the browser language; switch it in the settings (⚙).
  Only the screen is translated: the exported files are the same in either language
- **Feedback (FB)** — the FB button at the top right opens a small form to send comments or a
  bug report to the developer

## Usage

1. **Open** / 開く (Ctrl+O) — choose a video file, or one or more image files (drag & drop works too)
2. Calibration mode starts automatically: click points whose real-world coordinates you
   know, and type each as `x,y`. Two points that differ in **both** x and y are enough; if point 2
   differs from point 1 in only one of them, the guide bar asks for a third point that differs in
   the other.
3. Add mode starts automatically: click to record points. `d` switches to Delete mode.
4. **Save** / 保存 (Ctrl+S) — choose an output folder.

### Moving between frames

A seek bar spans the whole sequence: drag it, or click anywhere on it, to jump to a frame.
`◀` / `▶` (and `←` `→` / `z` `x`) move by the **frame step**, which starts at 1 and can be
changed in the toolbar box or with `,` / `.` (1, 2, 5, 10, 20, 50, 100, 200, 500). `j` jumps
to a frame number. Dragging the bar coalesces requests, so a fast drag settles on the frame
you released on rather than decoding every frame on the way.

### Zoom and pan

| Input | Effect |
|---|---|
| Trackpad pinch, or `Ctrl/Cmd` + wheel | Zoom about the cursor |
| Two-finger scroll | Pan |
| Wheel / `Shift` + wheel | Pan vertically / horizontally (mouse) |
| `+` / `-` | Zoom in / out |
| `0` | Fit the whole frame again |

Three-finger scroll is consumed by macOS itself and never reaches the page.

### Keyboard shortcuts

| Key | Effect |
|---|---|
| `Ctrl/Cmd + O` | Open files |
| `Ctrl/Cmd + S` | Save |
| `c` / `a` / `d` | Calibration / Add / Delete mode |
| `→` or `x` | Next frame |
| `←` or `z` | Previous frame |
| `j` | Jump to a frame number |
| `,` / `.` | Smaller / larger frame step |
| `[` / `]` | Smaller / larger point markers |
| `r` / `v` | Add a horizontal / vertical ruler |
| `f` | Turn ruler editing on / off |
| `e` | Settings — same as ⚙ (colours, marker outline, smooth curve, plot aspect, …) |
| `?` or `h` | How to use — same as the ? button at the top right |
| `Esc` | Close the settings, the QR codes, the changelog, the help or the feedback window |

### Re-calibrating part way through

Press `c` at any time to redo the calibration. Recorded points are kept: their pixel
coordinates are what is stored, so confirming a new set of reference points recomputes
every real-world coordinate. The calibration already in force stays active until the new
one is confirmed, so abandoning a half-entered re-calibration costs nothing.

### Rulers

`─` / `│` in the toolbar (or `r` / `v`) add a horizontal / vertical guide line through the middle
of the view. Lines ignore the pointer until **Edit rulers** (`f`) is on, so you can click a
point right on a line. While it is on, drag a line to move it; right-click it and press "Delete",
or drag it off the screen, to remove it. Each line shows its position — in real-world coordinates once calibrated,
in pixels before that. Rulers are drawn on screen only and never go into the saved files.

### Marker appearance

The marker outline thickness follows the marker size, so a 4 px point gets a hairline and a
20 px point gets a proper edge. The outline can be switched off in the settings. Point
numbers take the point colour by default — never white, since these figures are usually on a
light background — and can be given their own colour.

### Resuming a session

Saving writes `session.json` next to the data. To continue later: open the same video or
images again, press **Resume** (作業を再開), and pick that `session.json` — the calibration and every
recorded point come back. The media itself is never stored in the session file.

### Settings, language and sharing

The ⚙ button at the top right (or `e`) opens the settings. Every change applies at once —
there is no OK button; close the panel with ✕, a click outside it, or `Esc`. Besides the
marker and plot options it holds the language (日本語 / English), QR codes for the app and
its source, the changelog (also opened by clicking the version next to the app name) and a
link to the other apps. ⛶ next to it toggles full screen where the browser supports it, and
? (or the `?` / `h` key) opens the how-to-use window with every shortcut; it closes the same
way as the changelog (Close, a click outside it, or `Esc`).

## Running locally

| How | What it covers |
|---|---|
| Open `index.html` directly (`file://`) | Everything, including loading files and rendering. Verified in Chrome. |
| Serve the folder over http, then open `http://localhost:8000` | Same as above, and matches how GitHub Pages will serve it. Use the VS Code *Live Server* extension, `npx serve`, or any other static server. |
| `node tests/test_e2e_chrome.js` | Automated end-to-end run in headless Chrome (images + video). |

`node tests/test_e2e_chrome.js` starts its own throwaway static server; `--file` runs the same
checks straight off disk with no server at all.

## Saved data

The app keeps only a few small things in the browser (`localStorage`): the settings changed
in ⚙ (`click-to-get-coord/settings` — the per-frame PNG switch is not kept, since it is chosen
again each time you open files), the chosen language (`click-to-get-coord/lang`) and the last
version whose changelog you have seen (`click-to-get-coord/seen-version`). **Clear saved data**
at the bottom of the settings removes all of them. Videos, images and points are never stored.

Nothing is sent anywhere, with one exception: when you press **Send** in the FB (feedback) window,
what you wrote there is sent to the developer, together with the app name, version and display
language. Your videos, images and points are never sent.

## Output

Choosing an output folder writes:

| File | Contents |
|---|---|
| `coords.mat` | MATLAB Level 5 binary. `coords_raw` / `coords_real` are 1×N cell arrays of `n_i × 2` doubles — the same layout as the original Python tool, readable by MATLAB and `scipy.io.loadmat` |
| `coords.csv` | Every point of every frame in one text file, with the calibration in `#` comment lines |
| `plot_frame_XXXX.png` | The clicked points of that frame in calibrated coordinates, connected in click order |
| `overlay_frame_XXXX.png` | The source frame with the clicked points drawn on it, for verification |
| `session.json` | Full state, reloadable by the app |
| `README.md` | A self-contained description of every file and every column |

The per-frame PNGs default to **on for images and off for video** — an annotated clip can
easily mean hundreds of files and a long export. The switch is in the settings (⚙), and the
written `README.md` says which of them are present. The numbers are all in `coords.mat` /
`coords.csv`, so the figures can be redrawn later either way.

```python
from scipy.io import loadmat
d = loadmat('coords.mat')
pts = d['coords_real'][0][0]     # frame 0, shape (n_points, 2)
```

## Calibration

Two or three points define a per-axis linear map, with no rotation. Each axis takes the first
pair of points (in click order) whose real-world values differ on that axis — with origin, x-axis
point and y-axis point, that is origin + x-axis point for x and origin + y-axis point for y:

```
x_real = r0x + (x_img - p0x) * scale_x
y_real = r0y + (y_img - p0y) * scale_y
```

`scale_y` comes out negative when your real-world Y axis points up, because image Y grows
downward. This matches the original desktop tool exactly.

## Browser support

- **Chrome / Edge** — full support, including writing all output files into a folder you pick
  (File System Access API) and frame-rate detection.
- **Safari / Firefox** — the app works, but the output files are downloaded individually
  instead of written into a folder, and Firefox cannot detect the frame rate
  (it falls back to 30 fps, which you can correct in the toolbar).

## Development

There is no build step, no package manager and **no server-side code** — the whole app is
`index.html` + `style.css` + a handful of `.js` files (plus `qr.svg` / `src-qr.svg` and the
icon), which is exactly what GitHub Pages serves. Everything runs in the browser.

UI text lives in the `STRINGS` table in `app.js` (Japanese and English) and is applied by
`i18n.js`, a file shared unchanged by all the yukmmz.github.io apps.

### Tests

Node only, no packages required:

```
node tests/test_calib.js       # calibration maths
node tests/test_points.js      # per-frame point list
node tests/test_plot.js        # plot tick generation
node tests/test_exporters.js   # CSV / session / README / .mat encoding
node tests/test_wiring.js      # index.html <-> app.js consistency, STRINGS keys in both languages
node tests/test_e2e_chrome.js  # end-to-end in headless Chrome (needs Chrome installed)
```

## Origin

A browser port of a Python + Tkinter + OpenCV desktop tool, extended to support still images
in addition to video.

## License

MIT — see [LICENSE](LICENSE).

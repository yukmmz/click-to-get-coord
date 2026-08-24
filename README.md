# click-to-get-coord

Click points on a **video or image** in your browser and get them back as
**real-world coordinates**, calibrated from two reference points.

No upload, no server, no install — everything runs locally in the browser.

**→ [Open App](https://yukmmz.github.io/click-to-get-coord/)**

## Features

- **Video or images** — step through video frames, or load a set of still images as a sequence
- **Two-point calibration** — click two points, type their real-world coordinates, done
- **Add / Delete modes** — record points per frame, remove the nearest one
- **Frame-accurate stepping** — the frame rate is detected from the video itself
  (`requestVideoFrameCallback`), and the media time of every visited frame is recorded
- **Save to a folder** — pick an output folder and the tool writes every artifact into it
- **Resume later** — reload `session.json` to continue where you left off

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
easily mean hundreds of files and a long export. The switch is in the settings, and the
written `README.md` says which of them are present. The numbers are all in `coords.mat` /
`coords.csv`, so the figures can be redrawn later either way.

```python
from scipy.io import loadmat
d = loadmat('coords.mat')
pts = d['coords_real'][0][0]     # frame 0, shape (n_points, 2)
```

## Usage

1. **開く** (Ctrl+O) — choose a video file, or one or more image files (drag & drop works too)
2. Calibration mode starts automatically: click two points whose real-world coordinates you
   know, and type each as `x,y`. Pick two points that differ in **both** x and y.
3. Add mode starts automatically: click to record points. `d` switches to Delete mode.
4. **保存** (Ctrl+S) — choose an output folder.

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
| `e` | Settings (colours, marker outline, smooth curve, plot aspect) |
| `h` | Help |

### Re-calibrating part way through

Press `c` at any time to redo the calibration. Recorded points are kept: their pixel
coordinates are what is stored, so confirming a new pair of reference points recomputes
every real-world coordinate. The calibration already in force stays active until the new
pair is confirmed, so abandoning a half-entered re-calibration costs nothing.

### Marker appearance

The marker outline thickness follows the marker size, so a 4 px point gets a hairline and a
20 px point gets a proper edge. The outline can be switched off in the settings. Point
numbers take the point colour by default — never white, since these figures are usually on a
light background — and can be given their own colour.

### Resuming a session

Saving writes `session.json` next to the data. To continue later: open the same video or
images again, press **作業を再開**, and pick that `session.json` — the calibration and every
recorded point come back. The media itself is never stored in the session file.

## Calibration

Two points define a per-axis linear map, with no rotation:

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
`index.html` + `style.css` + a handful of `.js` files, which is exactly what GitHub Pages
serves. Everything runs in the browser.

### Trying it locally

| How | What it covers |
|---|---|
| Open `index.html` directly (`file://`) | Everything, including loading files and rendering. Verified in Chrome. |
| Serve the folder over http, then open `http://localhost:8000` | Same as above, and matches how GitHub Pages will serve it. Use the VS Code *Live Server* extension, `npx serve`, or any other static server. |
| `node test_e2e_chrome.js` | Automated end-to-end run in headless Chrome (images + video). |

`node test_e2e_chrome.js` starts its own throwaway static server; `--file` runs the same
checks straight off disk with no server at all.

### Tests

Node only, no packages required:

```
node test_calib.js       # calibration maths
node test_points.js      # per-frame point list
node test_plot.js        # plot tick generation
node test_exporters.js   # CSV / session / README / .mat encoding
node test_wiring.js      # index.html <-> app.js consistency
node test_e2e_chrome.js  # end-to-end in headless Chrome (needs Chrome installed)
```

## Origin

A browser port of a Python + Tkinter + OpenCV desktop tool, extended to support still images
in addition to video.

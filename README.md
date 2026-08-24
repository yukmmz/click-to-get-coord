# click-to-get-coord

A browser-based tool for clicking points on a **video or image** and converting them into
real-world coordinates via a two-point calibration.

No upload, no server — everything runs locally in your browser.

## Status

Work in progress. Currently only the skeleton (file loading, canvas display, frame navigation)
is implemented.

## Planned features

- Load a **video** (frame-by-frame navigation) or a **still image**
- **Calibration mode** — click two points and enter their real-world coordinates
- **Add mode** — click to record a point (image coordinates + real-world coordinates)
- **Delete mode** — click to remove the nearest recorded point
- Export the recorded coordinates per frame

## Usage

1. Open the app
2. Load a video or image file
3. Calibrate with two points of known real-world coordinates
4. Click points to record them; export when done

### Keyboard shortcuts

| Key | Effect |
|---|---|
| `c` | Calibration mode |
| `a` | Add mode |
| `d` | Delete mode |
| `→` / `x` | Next frame |
| `←` / `z` | Previous frame |

## Browser support

Chrome / Edge / Safari / Firefox (desktop). Video decoding depends on the browser's codec support.

## Origin

A browser port of a Python + Tkinter + OpenCV desktop tool, extended to support still images
in addition to video.

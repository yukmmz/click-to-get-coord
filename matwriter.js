// Minimal MATLAB Level 5 MAT-file writer (uncompressed, little-endian).
//
// Produces files readable by both MATLAB (`load`) and SciPy (`scipy.io.loadmat`),
// so the output is a drop-in replacement for the .mat written by the original
// Python tool (references/clickapp_tkcv-main).
//
// Supported variable kinds (enough for this app, not a general-purpose writer):
//   - 'cell'   : 1xN cell array whose cells are n_i x 2 double matrices
//   - 'matrix' : rows x cols double matrix (column-major data)
//   - 'char'   : 1xL character string
//
// Reference: MATLAB "MAT-File Format" (Level 5) specification.

'use strict';

const miINT8 = 1;
const miINT32 = 5;
const miUINT32 = 6;
const miDOUBLE = 9;
const miUTF8 = 16;
const miMATRIX = 14;

const mxCELL_CLASS = 1;
const mxCHAR_CLASS = 4;
const mxDOUBLE_CLASS = 6;

/**
 * @typedef {{x: number, y: number}} Pt
 * @typedef {{kind: 'cell', value: Pt[][]}} CellVar
 * @typedef {{kind: 'matrix', rows: number, cols: number, data: number[]}} MatrixVar  data is column-major
 * @typedef {{kind: 'char', value: string}} CharVar
 * @typedef {CellVar | MatrixVar | CharVar} MatVar
 */

/** @param {number} n */
function padLen(n) {
  return (8 - (n % 8)) % 8;
}

/** @param {Uint8Array[]} parts */
function concat(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/**
 * Wrap a payload in a MAT data element (8-byte tag + data + padding to 8 bytes).
 * @param {number} type miXXX data type
 * @param {Uint8Array} data
 */
function element(type, data) {
  const pad = padLen(data.length);
  const out = new Uint8Array(8 + data.length + pad);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, type, true);
  dv.setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}

/**
 * Array Flags subelement.
 * @param {number} klass mxXXX_CLASS
 */
function arrayFlags(klass) {
  const buf = new Uint8Array(8);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, klass & 0xff, true); // no complex/global/logical flags
  dv.setUint32(4, 0, true); // nzmax (sparse only)
  return element(miUINT32, buf);
}

/**
 * Dimensions subelement.
 * @param {number[]} dims
 */
function dimensions(dims) {
  const buf = new Uint8Array(4 * dims.length);
  const dv = new DataView(buf.buffer);
  dims.forEach((d, i) => dv.setInt32(4 * i, d, true));
  return element(miINT32, buf);
}

/**
 * Array Name subelement (ASCII).
 * @param {string} name '' for cell contents, which are unnamed
 */
function arrayName(name) {
  const buf = new Uint8Array(name.length);
  for (let i = 0; i < name.length; i++) buf[i] = name.charCodeAt(i) & 0x7f;
  return element(miINT8, buf);
}

/**
 * @param {number[]} values column-major
 */
function doubleData(values) {
  const buf = new Uint8Array(8 * values.length);
  const dv = new DataView(buf.buffer);
  values.forEach((v, i) => dv.setFloat64(8 * i, v, true));
  return element(miDOUBLE, buf);
}

/**
 * rows x cols double matrix as a complete miMATRIX element.
 * @param {string} name
 * @param {number} rows
 * @param {number} cols
 * @param {number[]} colMajor
 */
function doubleMatrix(name, rows, cols, colMajor) {
  return element(miMATRIX, concat([
    arrayFlags(mxDOUBLE_CLASS),
    dimensions([rows, cols]),
    arrayName(name),
    doubleData(colMajor),
  ]));
}

/**
 * n x 2 double matrix built from a point list (column-major: all x, then all y).
 * @param {string} name
 * @param {Pt[]} pts
 */
function pointMatrix(name, pts) {
  const colMajor = new Array(pts.length * 2);
  for (let i = 0; i < pts.length; i++) {
    colMajor[i] = pts[i].x;
    colMajor[pts.length + i] = pts[i].y;
  }
  return doubleMatrix(name, pts.length, 2, colMajor);
}

/**
 * 1xL char array, stored as UTF-8 bytes (miUTF8).
 *
 * The dimension is the number of *characters* (code points), not the number of bytes —
 * that is what the MAT spec means by the dimensions of a char array, and it is what
 * SciPy expects. Verified against scipy.io.loadmat with non-ASCII text; miUINT16 is
 * NOT a safe alternative (SciPy misreads it whenever its uint16 codec is UTF-8).
 * @param {string} name
 * @param {string} str
 */
function charArray(name, str) {
  const codePoints = Array.from(str).length;
  const bytes = new TextEncoder().encode(str);
  return element(miMATRIX, concat([
    arrayFlags(mxCHAR_CLASS),
    dimensions([codePoints ? 1 : 0, codePoints]),
    arrayName(name),
    element(miUTF8, bytes),
  ]));
}

/**
 * 1xN cell array whose cells are n_i x 2 double matrices.
 * @param {string} name
 * @param {Pt[][]} frames
 */
function cellOfPointLists(name, frames) {
  const cells = frames.map((pts) => pointMatrix('', pts));
  return element(miMATRIX, concat([
    arrayFlags(mxCELL_CLASS),
    dimensions([1, frames.length]),
    arrayName(name),
    concat(cells),
  ]));
}

/** 128-byte MAT-file header. */
function header() {
  const buf = new Uint8Array(128);
  const text = 'MATLAB 5.0 MAT-file, Platform: browser, Created by: click-to-get-coord';
  for (let i = 0; i < 116; i++) buf[i] = i < text.length ? text.charCodeAt(i) : 0x20; // space padded
  // bytes 116..123: subsystem data offset — zeros mean "none"
  const dv = new DataView(buf.buffer);
  dv.setUint16(124, 0x0100, true); // version
  buf[126] = 0x49; // 'I'
  buf[127] = 0x4d; // 'M'  -> "IM" marks a little-endian file
  return buf;
}

/**
 * Encode a set of variables into a .mat byte array.
 * @param {Record<string, MatVar>} vars
 * @returns {Uint8Array}
 */
function encodeMatV5(vars) {
  const parts = [header()];
  for (const [name, v] of Object.entries(vars)) {
    if (v.kind === 'cell') {
      parts.push(cellOfPointLists(name, v.value));
    } else if (v.kind === 'matrix') {
      parts.push(doubleMatrix(name, v.rows, v.cols, v.data));
    } else if (v.kind === 'char') {
      parts.push(charArray(name, v.value));
    } else {
      throw new Error(`Unsupported variable kind for "${name}"`);
    }
  }
  return concat(parts);
}

if (typeof module !== 'undefined') {
  module.exports = { encodeMatV5 };
}

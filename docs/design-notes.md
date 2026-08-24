# 設計メモ

移植元 `references/clickapp_tkcv-main`（Python + Tkinter + OpenCV）を Web に載せ替えるにあたっての、
未決事項と検討メモ。決まった事項はここに追記していく。

## 1. フレーム精度のシーク（動画）

移植元は OpenCV の `VideoCapture` でフレーム番号を直接指定できるが、ブラウザの `<video>` は
**時刻ベース**のシークしか持たない。候補:

- `video.currentTime += 1 / fps` + `seeked` イベント — 実装が軽い。fps を知る必要があり、
  可変フレームレート動画では累積誤差が出る。
- `requestVideoFrameCallback()` — 実際に表示されたフレームの `mediaTime` が取れる。
  Chrome / Safari は対応、Firefox は未対応。
- `WebCodecs` (`VideoDecoder`) — 真のフレーム単位。実装コストが高く、対応ブラウザが限られる。

**暫定**: 骨組みでは fps を仮定した時刻シーク。実運用でズレが問題になるかを確認してから
`requestVideoFrameCallback` へ寄せるか判断する。

## 2. 静止画対応（移植元に無い機能）

- 単一画像は「1フレームの動画」として扱えば、モード・保存の処理を共通化できる。
- 複数画像を読み込んだ場合はフレーム列として扱う（`batch-image-cropper` と同じ操作感）。
- 内部表現を「フレーム列（`getFrame(i)` で描画できるもの）」に抽象化し、
  動画ソースと画像ソースの差をその裏に隠すのが素直。

## 3. キャリブレーション

移植元は2点の画像座標と実世界座標から対応関係を作る（並進 + 等方スケール想定と思われる）。
`references/clickapp_tkcv-main/click_app/click_gui.py` の該当箇所を読んで、同じ式を再現すること。
射影変換（4点）へ拡張するかは、必要になってから検討する。

## 4. 出力フォーマット

移植元は SciPy の `.mat`（`coords_raw`・`coords_real`、いずれもフレーム数ぶんの可変長 cell 配列）。
Web 版の候補:

- **JSON** — 実装が楽。読み込み側（MATLAB / Python）で変換が要る。
- **CSV**（`frame, index, x_raw, y_raw, x_real, y_real`） — 表計算・Python で扱いやすい。
- **.mat 互換** — 既存の解析スクリプトをそのまま使えるが、JS からの書き出しは実装が重い。

**暫定**: JSON と CSV の両方を出す。既存の `.mat` 前提の解析がある場合は、
変換スクリプトを `scratch/` に置いて対応する。

## 5. 大きな動画の扱い

`URL.createObjectURL(file)` でローカルファイルをそのまま `<video>` に渡すため、
ファイルサイズによるメモリ制約は緩い。アップロードは一切しない。

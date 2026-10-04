// click-to-get-coord — UI, state and export flow.
//
// Depends on the globals defined by the other scripts loaded before this one:
//   i18n.js  calib.js  points.js  matwriter.js  exporters.js  plot.js  source.js
//
// Only the UI is translated (STRINGS below). Everything written to the output folder
// (coords.mat / coords.csv / PNGs / session.json / README.md) keeps one fixed format
// whatever the UI language is: downstream analysis code depends on it.

'use strict';

/* Single source of truth for the version; session.json records it. The app and source
 * URLs are APP_URL / SOURCE_URL in exporters.js (shared global scope of the classic
 * scripts), and the QR images (qr.svg / src-qr.svg) encode those same URLs. */
const APP_VERSION = '1.3.0';

/* Shared feedback endpoint (Google Apps Script web app, one for every yukmmz.github.io app).
 * Public on purpose: it can only append a row to a sheet and post to a Discord channel. */
const FEEDBACK_URL = 'https://script.google.com/macros/s/AKfycbxFJ-rTK2e5h05r6_j0RJJu-1Fo4Or3nsAnYcnGXC2i9I8FEdOIbNaXI1BfjunkQHEP/exec';
const FEEDBACK_APP_ID = 'click-to-get-coord';

const LANG_KEY = 'click-to-get-coord/lang';
const SEEN_VERSION_KEY = 'click-to-get-coord/seen-version';
/** The ⚙ settings (colours, sizes, toggles) as one JSON object. */
const SETTINGS_KEY = 'click-to-get-coord/settings';
/** Every key this app keeps in the browser starts with this; "Clear saved data" removes them all. */
const STORAGE_PREFIX = 'click-to-get-coord/';

/* What changed, newest first, shown from the settings sheet and from the version next
 * to the app name. Bumping APP_VERSION means adding an entry here (test_wiring.js checks
 * that the first entry matches). Written for users, in both languages. */
const CHANGELOG = [
  { version: '1.3.0', date: '2026-10-04', items: [
    { ja: 'ヘッダーに「FB」ボタンを追加しました。ご意見・不具合の報告を開発者に送れます',
      en: 'New "FB" button in the header: send feedback or a bug report to the developer' },
  ] },
  { version: '1.2.0', date: '2026-10-01', items: [
    { ja: '使い方を上部の ? ボタンに移しました（? キーや h キーでも開きます）',
      en: 'How to use moved to the ? button at the top (the ? and h keys open it too)' },
    { ja: '全画面表示中は、全画面ボタンが「縮小」の形に変わるようにしました',
      en: 'While in full screen, the full-screen button changes to a "shrink" icon' },
    { ja: '設定（⚙）で変えた点の直径・色・表示の切り替えを、次に開いたときも覚えておくようにしました。設定に「保存データを消す」を追加しました',
      en: 'The marker size, colours and display toggles you set in ⚙ are now remembered for next time. Added "Clear saved data" to the settings' },
  ] },
  { version: '1.1.0', date: '2026-10-01', items: [
    { ja: '左上にアプリ名とバージョンを表示するようにしました。バージョンを押すと更新履歴が開きます',
      en: 'The app name and version are shown at the top left; click the version to open this changelog' },
    { ja: '設定を ⚙ ボタンの画面にまとめました。変更はその場で反映されます。言語・共有・更新履歴・他のアプリもここから',
      en: 'Settings moved to the ⚙ button and apply immediately; language, sharing, changelog and other apps are there too' },
    { ja: '全画面表示ボタン（⛶）を追加しました',
      en: 'Added a full-screen button (⛶)' },
    { ja: '画面を英語でも使えるようにしました（書き出すファイルの中身は変わりません）',
      en: 'The app can be used in English (the exported files are unchanged)' },
    { ja: 'QR コードでアプリとソースを共有できるようにしました',
      en: 'Share the app and its source by QR code' },
  ] },
  { version: '1.0.0', date: '2026-08-25', items: [
    { ja: '最初の公開版: 動画・画像の上をクリックして点を記録し、2点キャリブレーションで実世界座標に変換',
      en: 'First release: click points on a video or images and convert them to real-world coordinates with a two-point calibration' },
    { ja: 'シークバーと送り幅でのフレーム移動、拡大・移動',
      en: 'Frame navigation with a seek bar and a frame step, plus zoom and pan' },
    { ja: 'CSV / .mat / PNG / session.json / README の書き出しと、session.json からの作業の再開',
      en: 'Export to CSV / .mat / PNG / session.json / README, and resume work from session.json' },
  ] },
];

/* UI strings. `c.*` keys are the common ones every yukmmz.github.io app uses with the same
 * wording; the rest belong to this app. Values used with data-i18n-html are HTML. */
const STRINGS = {
  ja: {
    'c.settings': '設定', 'c.close': '閉じる', 'c.language': '言語', 'c.share': '共有',
    'c.showQr': 'QR コードを表示', 'c.changelog': '更新履歴', 'c.showChangelog': '表示',
    'c.otherApps': '他のアプリ', 'c.openPortal': 'アプリ一覧を開く', 'c.fullscreen': '全画面表示',
    'c.help': '使い方', 'c.exitFullscreen': '全画面を終了',
    'c.data': 'データ', 'c.clearData': '保存データを消す',
    'c.feedback': 'フィードバックを送る', 'c.feedbackLead': 'ご意見・ご要望・不具合の報告をお寄せください。',
    'c.feedbackMessage': 'フィードバックの内容', 'c.feedbackPlaceholder': '使ってみた感想、困ったこと、ほしい機能など',
    'c.feedbackContact': '連絡先（任意・返信がほしい場合）',
    'c.feedbackNote': '送信を押したときに、書いた内容とアプリ名・バージョン・表示言語だけを開発者に送ります。',
    'c.feedbackSend': '送信', 'c.feedbackSending': '送信中…', 'c.feedbackThanks': '送信しました。ありがとうございます！',
    'c.feedbackEmpty': '内容を入力してください。', 'c.feedbackError': '送信できませんでした。時間をおいてもう一度お試しください。',
    'c.clearConfirm': 'このブラウザに保存されている、このアプリのデータ（設定の点の直径・色・表示の切り替え、言語、更新履歴の既読）をすべて消して、ページを読み込み直します。'
      + 'クリックした点とキャリブレーションはもともと保存されないので、書き出していない点は失われます。元に戻せません。よろしいですか？',

    'tb.open': '開く',
    'tb.resume': '作業を再開',
    'tb.resumeTitle': '前回の保存フォルダにある session.json を読み込み、キャリブレーションとクリック点を復元して続きから作業します',
    'tb.save': '保存',
    'tb.mode': 'モード',
    'tb.diameter': '点の直径',
    'tb.diameterTitle': '点の直径（画面上のピクセル）。[ で細く、] で太く',
    'tb.diameterKeys': '[ で細く、] で太く',

    'nav.step': '送り幅',
    'nav.stepTitle': '◀ ▶ 1回で進むフレーム数。, で減らし . で増やす',
    'nav.stepKeys': ', で減らし . で増やす',
    'nav.jump': 'ジャンプ (j)',
    'nav.view': '表示',
    'nav.zoomOut': '縮小（- キー）',
    'nav.zoomIn': '拡大（+ キー）',
    'nav.prev': '前のフレーム（← / z）',
    'nav.next': '次のフレーム（→ / x）',
    'nav.fit': '全体',
    'nav.fitTitle': '全体表示に戻す（0 キー）',
    'nav.gestures': 'ピンチ/Ctrl+ホイール=拡大縮小、2本指スクロール=移動',
    'nav.seekTitle': 'ドラッグまたはクリックで任意のフレームへ移動',
    'nav.pointCount': 'このフレーム {here} 点 / 全体 {total} 点',
    'placeholder': '動画または画像ファイルを開いてください（ドラッグ＆ドロップも可）',
    'fps.detected': '(自動検出)',
    'fps.manual': '(手動)',

    'set.diameter': '点の直径（px）',
    'set.pointColor': 'クリック点の色',
    'set.calibColor': 'キャリブレーション点の色',
    'set.framePngs': 'フレームごとの PNG',
    'set.framePngsNote': 'plot / overlay を書き出す。画像は既定でオン、動画は枚数が膨らむため既定でオフ',
    'set.indexAuto': '点の番号を点と同じ色にする',
    'set.indexColor': '点の番号の色',
    'set.indexColorNote': '上のチェックを外したとき',
    'set.markerEdge': '点に白い縁取りをつける',
    'set.markerEdgeNote': '太さは点の大きさに連動',
    'set.smooth': 'プロットの線を滑らかな曲線にする',
    'set.showIndex': '点の番号を表示する',
    'set.equalAspect': 'プロットの縦横比を 1:1 に固定する',
    'set.equalAspectNote': '長さの計測など、x と y が同じ量のとき',

    'dlg.cancel': 'キャンセル',
    'dlg.ok': 'OK',
    'dlg.okEnter': 'OK（Enter）',
    'dlg.confirmTitle': '確認',
    'dlg.messageTitle': 'お知らせ',
    'calib.title': 'キャリブレーション {n}点目の実世界座標',
    'calib.pixel': 'クリック位置（画素）: x = {x}, y = {y}',
    'calib.lead': 'この点の<b>実際の座標</b>を入力してください。単位は任意（mm でも m でも図面上の値でも可）。',
    'calib.note1': 'この後もう1点クリックします。2点で座標系が決まります。',
    'calib.note2': '1点目と x も y も異なる点であること。同じだとその軸の倍率を決められません。',
    'calib.sameImgX': '2点の画像 X 座標が同じです。scaleX = 1 を使用します。',
    'calib.sameImgY': '2点の画像 Y 座標が同じです。scaleY = 1 を使用します。',
    'calib.zeroScaleX': 'scaleX が 0 です。2点の実世界 X 座標が同じではありませんか。',
    'calib.zeroScaleY': 'scaleY が 0 です。2点の実世界 Y 座標が同じではありませんか。',
    'jump.title': 'フレームへ移動',
    'jump.label': 'フレーム番号',
    'jump.range': '1 から {max} の範囲で指定してください。',
    'jump.go': '移動（Enter）',

    'guide.open': '動画または画像ファイルを開いてください',
    'guide.openSub': '左上の「開く」ボタン、またはこの画面にドラッグ＆ドロップ（画像は複数選択可）',
    'guide.nav': ' / ← → でフレーム移動',
    'guide.calibInput': '{n}点目の実世界座標を入力してください',
    'guide.calibInputSub': 'いま画面に出ているダイアログに、その点の実際の x と y を入れて OK。間違えたらキャンセルして打ち直せます',
    'guide.calib1': '実世界の座標が分かっている点を、画像上でクリック（1点目）',
    'guide.calib1Redo': '記録済みの点は消えません。新しい2点が確定するまで今のキャリブレーションが有効で、確定後に全点の実世界座標を計算し直します',
    'guide.calib1Sub': 'クリックすると座標を入力する画面が出ます。例: グラフの原点、定規の目盛り、既知の長さの端点など',
    'guide.calib2': '2点目をクリック（1点目と x も y も異なる点）',
    'guide.calib2Redo': '中断したい場合は a キーで Add に戻れば、今のキャリブレーションがそのまま残ります',
    'guide.calib2Sub': '例: 1点目が原点なら、x 軸と y 軸のどちらの目盛りも違う点を選ぶ',
    'guide.del': '消したい点の近くをクリックすると、いちばん近い点が削除されます',
    'guide.delSub': '点の追加に戻るには a キー（または Add ボタン）{nav}',
    'guide.warnStep': '注意',
    'guide.noCalib': 'キャリブレーションが未完了です。このまま打つと実世界座標は NaN になります',
    'guide.noCalibSub': 'c キー（または Calibration ボタン）でやり直せます',
    'guide.add': '記録したい位置をクリックして点を追加',
    'guide.addSub0': '間違えたら d キーで削除モード{nav}',
    'guide.addSubN': '{n} 点を記録済み。終わったら「保存」(Ctrl+S) で出力フォルダを選ぶ{nav}',
    'guide.modeStep': 'モード',
    'guide.mode': 'モードを選んでください',

    'status.ready': 'ready',
    'status.loading': '読み込み中...',
    'status.loadFailed': '読み込みに失敗しました',
    'status.calib1': 'Calibration: 1点目をクリック',
    'status.calib2': 'Calibration: 2点目をクリック',
    'status.calibInput': 'Calibration: {n}点目の実世界座標を入力',
    'status.add': 'Add: クリックで点を追加',
    'status.del': 'Delete: 消したい点の近くをクリック',
    'status.rendering': '画像を生成中... ({k} / {n})',
    'status.writing': '書き出し中... ({k} / {n}) {name}',
    'status.saved': '保存が完了しました',
    'status.saveFailed': '保存に失敗しました',

    'pick.desc': '動画または画像',
    'confirm.discardText': '保存していないクリック点があります。破棄して新しいファイルを開きますか？',
    'confirm.discardTitle': '未保存の点があります',
    'confirm.discardOk': '破棄して開く',
    'confirm.noCalibText': 'キャリブレーションがまだです。実世界座標は全て NaN になりますが、保存しますか？',
    'confirm.noCalibTitle': 'キャリブレーション未実施',
    'confirm.noPointsText': 'クリック点が1つもありません。それでも保存しますか？',
    'confirm.noPointsTitle': '点がありません',
    'confirm.saveAnyway': 'このまま保存',
    'confirm.manyPngsText': '{n} フレーム分の PNG（plot と overlay）を書き出します。{m} 枚になり時間がかかります。続けますか？',
    'confirm.manyPngsTitle': 'フレームごとの PNG',
    'confirm.write': '書き出す',
    'confirm.stop': 'やめる',
    'confirm.fpsText': 'fps を変えるとフレーム数が変わり、記録済みの点はクリアされます。続けますか？',
    'confirm.fpsTitle': 'fps の変更',
    'confirm.fpsOk': '変更する',

    'log.welcome': 'Click to Get Coord v{v} — 「開く」または画面へのドラッグ＆ドロップで動画・画像を読み込んでください。',
    'log.multiVideo': '動画が複数選択されました。先頭の {name} のみ開きます。',
    'log.loaded': '読み込み完了: {name} — {n} フレーム, {w}x{h} px',
    'log.videoPngsOff': '動画のため、フレームごとの PNG（plot / overlay）の書き出しは既定でオフです。設定（⚙ / e）でオンにできます。',
    'log.recalib': 'Calibration をやり直します。新しい2点が確定するまで今のキャリブレーションは有効なままで、記録済みの {n} 点も消えません（確定時に実世界座標を計算し直します）。',
    'log.calibStart': 'Calibration モード: 実世界座標が既知の2点をクリックしてください（x も y も異なる2点）。',
    'log.recalibAborted': 'キャリブレーションのやり直しを中断しました。前のキャリブレーションをそのまま使います。',
    'log.calibAborted': 'キャリブレーションを中断しました。',
    'log.chooseMode': 'モードを選んでからクリックしてください。',
    'log.calibCancelled': 'キャリブレーション {n} 点目の入力をキャンセルしました。もう一度クリックしてください。',
    'log.calibPoint': 'キャリブレーション {n} 点目: 画素 ({px}, {py}) -> 実世界 ({rx}, {ry})',
    'log.calibDone': 'キャリブレーション完了: scale_x = {sx}, scale_y = {sy} （実世界単位/px）',
    'log.calibUpdated': 'キャリブレーションを更新: scale_x = {sx}, scale_y = {sy} （実世界単位/px）',
    'log.recomputed': '記録済みの {n} 点の実世界座標を、この変換で計算し直しました。',
    'log.added': '[frame {f} / 点 {n}] 画素 ({px}, {py}) -> 実世界 ({rx}, {ry})',
    'log.addedNaN': '[frame {f} / 点 {n}] 画素 ({px}, {py}) — 未キャリブレーションのため実世界座標は NaN',
    'log.nothingToDelete': 'このフレームには削除できる点がありません。',
    'log.deleted': '[frame {f}] 点 {i} を削除: 画素 ({px}, {py})',
    'log.step': '送り幅を {n} フレームにしました。',
    'log.saveStopped': '保存を中止しました。設定（⚙ / e）でフレームごとの PNG をオフにできます。',
    'log.dirFailed': 'フォルダを開けませんでした: {msg}',
    'log.noDirPicker': 'このブラウザはフォルダ選択（File System Access API）に対応していません。ファイルを個別にダウンロードします。Chrome / Edge ならフォルダに直接保存できます。',
    'log.pngsSkipped': 'フレームごとの PNG は書き出しません（対象 {n} フレーム）。設定（⚙ / e）の「フレームごとの PNG」でオンにできます。',
    'log.saved': '保存しました: {n} ファイル（{f} フレーム分の PNG を含む）',
    'log.downloaded': '{n} ファイルをダウンロードしました。',
    'log.saveFailed': '保存に失敗しました: {msg}',
    'log.notSession': 'click-to-get-coord の session.json ではありません。',
    'log.sessionNameDiff': '警告: セッションの入力データ名 "{a}" が、いま開いているデータ "{b}" と異なります。',
    'log.sessionFramesDiff': '警告: セッションのフレーム数 {a} が現在の {b} と異なります。重なる範囲だけ復元します。',
    'log.sessionRestored': 'セッションを復元しました: {n} 点',
    'log.sessionFailed': 'セッションを読み込めませんでした: {msg}',
    'log.fpsChanged': 'fps を {v} に変更しました（{n} フレーム）。記録済みの点はクリアされました。',

    'src.videoFailed': '動画を読み込めませんでした: {name}',
    'src.noDuration': '警告: この動画の長さを取得できませんでした。フレーム送りができない可能性があります。',
    'src.detectingFps': 'フレームレートを検出中...',
    'src.fpsUnknown': 'フレームレートを自動検出できませんでした（このブラウザは requestVideoFrameCallback 非対応）。30 fps と仮定します。ツールバーで変更できます。',
    'src.fpsDetected': 'フレームレート検出: {fps} fps',
    'src.imageFailed': '画像を読み込めませんでした: {name}',
    'src.sizeMismatch': '警告: 画像のサイズが揃っていません（{sizes}）。キャリブレーションは全画像で共通に適用されるため、拡大率が異なる画像では実世界座標がずれます。',

    'help.body': `<ol>
  <li><b>開く</b>（Ctrl+O）で動画ファイル、または画像ファイル（複数可）を選ぶ。</li>
  <li>自動的に <b>Calibration モード</b>に入る。画像上の2点をクリックし、それぞれの実世界座標を
    入力する。<b>x も y も異なる2点</b>を選ぶこと。</li>
  <li>2点入力すると自動的に <b>Add モード</b>に入る。クリックで点を記録する。</li>
  <li>消したい点があれば <b>Delete モード</b>（d）でその点の近くをクリックする。</li>
  <li><b>保存</b>（Ctrl+S）で出力先フォルダを選ぶと、そのフォルダに全ファイルが書き出される。</li>
</ol>

<h3>フレームの移動（動画・複数画像）</h3>
<ul>
  <li>画面上部の<b>シークバー</b>をドラッグ、またはクリックで任意のフレームへ飛べます。</li>
  <li><b>◀ ▶</b>（← → / z x）は<b>送り幅</b>のフレーム数だけ進みます。既定は1フレームで、
    ツールバーの数値欄か <b>, </b>／<b>.</b> キーで 1, 2, 5, 10, 20, 50, 100, 200, 500 と切り替わります。</li>
  <li><b>j</b> でフレーム番号を直接指定できます。</li>
</ul>

<h3>キャリブレーションのやり直し</h3>
<p>点を打っている途中でも <b>c</b> キー（または Calibration ボタン）でやり直せます。</p>
<ul>
  <li>記録済みのクリック点は<b>消えません</b>。新しい2点が確定した時点で、全点の実世界座標が
    新しい変換で計算し直されます（画素座標を保持しているため）。</li>
  <li>新しい2点が確定するまで、<b>今のキャリブレーションは有効なまま</b>です。1点だけ入れて
    やめても、前の設定は失われません（a キーで Add に戻れば中断できます）。</li>
  <li>やり直し中は、前のキャリブレーション点が薄く、新しい点が濃く表示されます。</li>
</ul>

<h3>拡大・移動</h3>
<table>
  <tr><td>トラックパッドでピンチ</td><td>拡大・縮小（カーソル位置を中心に）</td></tr>
  <tr><td>Ctrl/Cmd + ホイール</td><td>同上（マウスの場合）</td></tr>
  <tr><td>2本指スクロール</td><td>表示位置の移動（パン）</td></tr>
  <tr><td>ホイール / Shift+ホイール</td><td>上下 / 左右に移動（マウスの場合）</td></tr>
  <tr><td>+ / -</td><td>拡大 / 縮小</td></tr>
  <tr><td>0</td><td>全体表示に戻す</td></tr>
</table>
<p class="hint">3本指スクロールは macOS 自身が使うため、ブラウザには届きません。</p>

<h3>ショートカット</h3>
<table>
  <tr><td>Ctrl+O</td><td>ファイルを開く</td></tr>
  <tr><td>Ctrl+S</td><td>保存</td></tr>
  <tr><td>c / a / d</td><td>Calibration / Add / Delete モード</td></tr>
  <tr><td>→ または x</td><td>次のフレーム</td></tr>
  <tr><td>← または z</td><td>前のフレーム</td></tr>
  <tr><td>j</td><td>フレーム番号を指定して移動</td></tr>
  <tr><td>, / .</td><td>送り幅（◀ ▶ 1回で進むフレーム数）を減らす / 増やす</td></tr>
  <tr><td>[ / ]</td><td>点の直径を小さく / 大きく</td></tr>
  <tr><td>e</td><td>設定（⚙ と同じ。変更はその場で反映）</td></tr>
  <tr><td>? / h</td><td>この使い方（上部の ? ボタンと同じ）</td></tr>
  <tr><td>Esc</td><td>設定・QR コード・更新履歴・使い方・フィードバックの窓を閉じる</td></tr>
</table>

<h3>「作業を再開」とは</h3>
<p>保存すると、出力フォルダに <code>session.json</code>（キャリブレーションの2点と変換係数、
  フレームごとのクリック点）が書き出されます。<b>作業を再開</b>はこれを読み戻す機能です。</p>
<ol>
  <li>前回と<b>同じ動画・画像</b>を「開く」で読み込む（画像そのものは session.json に入っていません）</li>
  <li><b>作業を再開</b>を押して、前回の <code>session.json</code> を選ぶ</li>
  <li>キャリブレーションと打った点が全部戻るので、続きから追加・削除できる</li>
</ol>
<p class="hint">用途: 途中で中断したとき、点を打ち足したいとき、キャリブレーションだけやり直したいとき。</p>

<h3>保存されるもの</h3>
<ul>
  <li><code>coords.mat</code> — MATLAB / scipy で読めるバイナリ（<code>coords_raw</code>, <code>coords_real</code> ほか）</li>
  <li><code>coords.csv</code> — 全点を1ファイルにまとめたテキスト</li>
  <li><code>plot_frame_XXXX.png</code> — 実世界座標系でのクリック点と、それを結ぶ曲線</li>
  <li><code>overlay_frame_XXXX.png</code> — 元画像にクリック点を重ねた検証用画像</li>
  <li><code>session.json</code> — 作業再開用の状態</li>
  <li><code>README.md</code> — 上記すべての読み方の説明（Markdown）</li>
</ul>
<p class="hint">フレームごとの PNG は、<b>画像入力では既定でオン、動画では既定でオフ</b>です
  （動画は対象フレームが大量になりうるため）。設定（⚙ / e）で切り替えられます。数値データは
  <code>coords.mat</code> / <code>coords.csv</code> に全て入っているので、図は後から作り直せます。
  書き出すファイルの中身は、画面の言語にかかわらず同じです。</p>`,
  },
  en: {
    'c.settings': 'Settings', 'c.close': 'Close', 'c.language': 'Language', 'c.share': 'Share',
    'c.showQr': 'Show QR codes', 'c.changelog': 'Changelog', 'c.showChangelog': 'Show',
    'c.otherApps': 'Other apps', 'c.openPortal': 'Open app list', 'c.fullscreen': 'Full screen',
    'c.help': 'How to use', 'c.exitFullscreen': 'Exit full screen',
    'c.data': 'Data', 'c.clearData': 'Clear saved data',
    'c.feedback': 'Send feedback', 'c.feedbackLead': 'Comments, requests and bug reports are welcome.',
    'c.feedbackMessage': 'Your feedback', 'c.feedbackPlaceholder': 'What you liked, what was hard, what you would like to see…',
    'c.feedbackContact': 'Contact (optional, if you would like a reply)',
    'c.feedbackNote': 'Only what you write, plus the app name, version and display language, is sent to the developer when you press Send.',
    'c.feedbackSend': 'Send', 'c.feedbackSending': 'Sending…', 'c.feedbackThanks': 'Sent. Thank you!',
    'c.feedbackEmpty': 'Please write something first.', 'c.feedbackError': 'Could not send. Please try again later.',
    'c.clearConfirm': 'This deletes everything this app has saved in this browser (the settings: marker size, colours and display toggles; the language; which changelog you have read) and reloads the page. '
      + 'Clicked points and the calibration are never saved, so any points you have not exported will be lost. This cannot be undone. Continue?',

    'tb.open': 'Open',
    'tb.resume': 'Resume',
    'tb.resumeTitle': 'Load session.json from a previous output folder, restore the calibration and the clicked points, and carry on where you left off',
    'tb.save': 'Save',
    'tb.mode': 'Mode',
    'tb.diameter': 'Point size',
    'tb.diameterTitle': 'Point diameter (screen pixels). [ smaller, ] larger',
    'tb.diameterKeys': '[ smaller, ] larger',

    'nav.step': 'Step',
    'nav.stepTitle': 'Frames moved by one press of ◀ ▶. , for fewer, . for more',
    'nav.stepKeys': ', for fewer, . for more',
    'nav.jump': 'Jump (j)',
    'nav.view': 'View',
    'nav.zoomOut': 'Zoom out (- key)',
    'nav.zoomIn': 'Zoom in (+ key)',
    'nav.prev': 'Previous frame (← / z)',
    'nav.next': 'Next frame (→ / x)',
    'nav.fit': 'Fit',
    'nav.fitTitle': 'Show the whole frame (0 key)',
    'nav.gestures': 'Pinch / Ctrl+wheel = zoom, two-finger scroll = pan',
    'nav.seekTitle': 'Drag or click to go to any frame',
    'nav.pointCount': 'This frame: {here} points / total: {total}',
    'placeholder': 'Open a video or image files (drag and drop works too)',
    'fps.detected': '(detected)',
    'fps.manual': '(manual)',

    'set.diameter': 'Point size (px)',
    'set.pointColor': 'Point colour',
    'set.calibColor': 'Calibration point colour',
    'set.framePngs': 'Per-frame PNGs',
    'set.framePngsNote': 'Write plot / overlay images. On by default for images, off for video (too many files)',
    'set.indexAuto': 'Point numbers in the point colour',
    'set.indexColor': 'Point number colour',
    'set.indexColorNote': 'Used when the option above is off',
    'set.markerEdge': 'White outline on points',
    'set.markerEdgeNote': 'Its thickness follows the point size',
    'set.smooth': 'Smooth curve in the plot',
    'set.showIndex': 'Show point numbers',
    'set.equalAspect': 'Lock the plot aspect ratio to 1:1',
    'set.equalAspectNote': 'When x and y are the same quantity, e.g. measuring lengths',

    'dlg.cancel': 'Cancel',
    'dlg.ok': 'OK',
    'dlg.okEnter': 'OK (Enter)',
    'dlg.confirmTitle': 'Confirm',
    'dlg.messageTitle': 'Notice',
    'calib.title': 'Calibration point {n}: real-world coordinates',
    'calib.pixel': 'Clicked position (pixels): x = {x}, y = {y}',
    'calib.lead': 'Enter the <b>real-world coordinates</b> of this point. Any unit works (mm, m, or values read off a drawing).',
    'calib.note1': 'You will click one more point next. Two points define the coordinate system.',
    'calib.note2': 'It must differ from point 1 in both x and y; otherwise that axis\'s scale cannot be determined.',
    'calib.sameImgX': 'The two points have the same image X. Using scaleX = 1.',
    'calib.sameImgY': 'The two points have the same image Y. Using scaleY = 1.',
    'calib.zeroScaleX': 'scaleX is 0. Do the two points have the same real-world X?',
    'calib.zeroScaleY': 'scaleY is 0. Do the two points have the same real-world Y?',
    'jump.title': 'Go to frame',
    'jump.label': 'Frame number',
    'jump.range': 'Enter a number from 1 to {max}.',
    'jump.go': 'Go (Enter)',

    'guide.open': 'Open a video or image files',
    'guide.openSub': 'Use the "Open" button at the top left, or drag and drop onto this page (several images at once are fine)',
    'guide.nav': ' / ← → to change frames',
    'guide.calibInput': 'Enter the real-world coordinates of point {n}',
    'guide.calibInputSub': 'Type the point\'s real x and y into the dialog on screen and press OK. Clicked the wrong spot? Cancel and click again',
    'guide.calib1': 'Click a point whose real-world coordinates you know (point 1)',
    'guide.calib1Redo': 'Recorded points are kept. The current calibration stays in force until two new points are confirmed; then every real-world coordinate is recomputed',
    'guide.calib1Sub': 'Clicking asks for its coordinates. For example: a graph\'s origin, a ruler mark, or an end of a known length',
    'guide.calib2': 'Click point 2 (different from point 1 in both x and y)',
    'guide.calib2Redo': 'To give up, press a to go back to Add; the current calibration stays as it is',
    'guide.calib2Sub': 'For example, if point 1 is the origin, pick a point off both the x and the y axis',
    'guide.del': 'Click near a point to delete the nearest one',
    'guide.delSub': 'Press a (or the Add button) to go back to adding points{nav}',
    'guide.warnStep': 'NOTE',
    'guide.noCalib': 'Calibration is not finished. Points added now get NaN real-world coordinates',
    'guide.noCalibSub': 'Press c (or the Calibration button) to calibrate',
    'guide.add': 'Click where you want to record a point',
    'guide.addSub0': 'Made a mistake? Press d for Delete mode{nav}',
    'guide.addSubN': '{n} points recorded. When done, press "Save" (Ctrl+S) and pick an output folder{nav}',
    'guide.modeStep': 'MODE',
    'guide.mode': 'Choose a mode',

    'status.ready': 'ready',
    'status.loading': 'Loading...',
    'status.loadFailed': 'Loading failed',
    'status.calib1': 'Calibration: click point 1',
    'status.calib2': 'Calibration: click point 2',
    'status.calibInput': 'Calibration: enter the real-world coordinates of point {n}',
    'status.add': 'Add: click to add a point',
    'status.del': 'Delete: click near the point to remove',
    'status.rendering': 'Rendering images... ({k} / {n})',
    'status.writing': 'Writing... ({k} / {n}) {name}',
    'status.saved': 'Saved',
    'status.saveFailed': 'Saving failed',

    'pick.desc': 'Video or images',
    'confirm.discardText': 'There are unsaved points. Discard them and open the new files?',
    'confirm.discardTitle': 'Unsaved points',
    'confirm.discardOk': 'Discard and open',
    'confirm.noCalibText': 'Not calibrated yet, so every real-world coordinate will be NaN. Save anyway?',
    'confirm.noCalibTitle': 'Not calibrated',
    'confirm.noPointsText': 'There are no clicked points. Save anyway?',
    'confirm.noPointsTitle': 'No points',
    'confirm.saveAnyway': 'Save anyway',
    'confirm.manyPngsText': 'This writes PNGs (plot and overlay) for {n} frames: {m} files, which takes a while. Continue?',
    'confirm.manyPngsTitle': 'Per-frame PNGs',
    'confirm.write': 'Write them',
    'confirm.stop': 'Stop',
    'confirm.fpsText': 'Changing the fps changes the frame count and clears the recorded points. Continue?',
    'confirm.fpsTitle': 'Change fps',
    'confirm.fpsOk': 'Change',

    'log.welcome': 'Click to Get Coord v{v} — load a video or images with "Open" or by dropping them onto the page.',
    'log.multiVideo': 'Several videos were selected. Only the first one, {name}, is opened.',
    'log.loaded': 'Loaded: {name} — {n} frames, {w}x{h} px',
    'log.videoPngsOff': 'This is a video, so per-frame PNGs (plot / overlay) are off by default. Turn them on in the settings (⚙ / e).',
    'log.recalib': 'Redoing the calibration. The current one stays in force until two new points are confirmed, and the {n} recorded points are kept (their real-world coordinates are recomputed then).',
    'log.calibStart': 'Calibration mode: click two points with known real-world coordinates (different in both x and y).',
    'log.recalibAborted': 'Re-calibration abandoned. The previous calibration is kept.',
    'log.calibAborted': 'Calibration abandoned.',
    'log.chooseMode': 'Choose a mode before clicking.',
    'log.calibCancelled': 'Calibration point {n} was cancelled. Click again.',
    'log.calibPoint': 'Calibration point {n}: pixel ({px}, {py}) -> real ({rx}, {ry})',
    'log.calibDone': 'Calibration done: scale_x = {sx}, scale_y = {sy} (real-world units/px)',
    'log.calibUpdated': 'Calibration updated: scale_x = {sx}, scale_y = {sy} (real-world units/px)',
    'log.recomputed': 'Recomputed the real-world coordinates of the {n} recorded points with this transform.',
    'log.added': '[frame {f} / point {n}] pixel ({px}, {py}) -> real ({rx}, {ry})',
    'log.addedNaN': '[frame {f} / point {n}] pixel ({px}, {py}) — not calibrated, so the real-world coordinates are NaN',
    'log.nothingToDelete': 'There is no point to delete in this frame.',
    'log.deleted': '[frame {f}] deleted point {i}: pixel ({px}, {py})',
    'log.step': 'Frame step set to {n}.',
    'log.saveStopped': 'Save cancelled. Per-frame PNGs can be turned off in the settings (⚙ / e).',
    'log.dirFailed': 'Could not open the folder: {msg}',
    'log.noDirPicker': 'This browser cannot pick a folder (File System Access API), so the files are downloaded one by one. Chrome / Edge can save straight into a folder.',
    'log.pngsSkipped': 'Per-frame PNGs are not written ({n} frames with points). Turn on "Per-frame PNGs" in the settings (⚙ / e).',
    'log.saved': 'Saved {n} files (including PNGs for {f} frames)',
    'log.downloaded': 'Downloaded {n} files.',
    'log.saveFailed': 'Saving failed: {msg}',
    'log.notSession': 'This is not a click-to-get-coord session.json.',
    'log.sessionNameDiff': 'Warning: the session\'s input "{a}" differs from the open data "{b}".',
    'log.sessionFramesDiff': 'Warning: the session has {a} frames but the open data has {b}. Only the overlapping range is restored.',
    'log.sessionRestored': 'Session restored: {n} points',
    'log.sessionFailed': 'Could not load the session: {msg}',
    'log.fpsChanged': 'fps changed to {v} ({n} frames). The recorded points were cleared.',

    'src.videoFailed': 'Could not load the video: {name}',
    'src.noDuration': 'Warning: could not read the length of this video. Frame stepping may not work.',
    'src.detectingFps': 'Detecting the frame rate...',
    'src.fpsUnknown': 'Could not detect the frame rate (this browser lacks requestVideoFrameCallback). Assuming 30 fps; you can change it in the toolbar.',
    'src.fpsDetected': 'Frame rate detected: {fps} fps',
    'src.imageFailed': 'Could not load the image: {name}',
    'src.sizeMismatch': 'Warning: the images differ in size ({sizes}). One calibration applies to all of them, so images at a different scale get wrong real-world coordinates.',

    'help.body': `<ol>
  <li><b>Open</b> (Ctrl+O) a video file, or one or more image files.</li>
  <li><b>Calibration mode</b> starts automatically. Click two points on the image and enter the
    real-world coordinates of each. Pick <b>two points that differ in both x and y</b>.</li>
  <li>After the second point, <b>Add mode</b> starts automatically. Click to record points.</li>
  <li>To remove a point, switch to <b>Delete mode</b> (d) and click near it.</li>
  <li><b>Save</b> (Ctrl+S) and pick an output folder; every file is written into it.</li>
</ol>

<h3>Moving between frames (video, several images)</h3>
<ul>
  <li>Drag the <b>seek bar</b> at the top, or click on it, to jump to any frame.</li>
  <li><b>◀ ▶</b> (← → / z x) move by the <b>frame step</b>. It starts at 1 and steps through
    1, 2, 5, 10, 20, 50, 100, 200, 500 with the toolbar box or the <b>, </b>/<b>.</b> keys.</li>
  <li><b>j</b> jumps to a frame number.</li>
</ul>

<h3>Redoing the calibration</h3>
<p>Press <b>c</b> (or the Calibration button) at any time, even with points already recorded.</p>
<ul>
  <li>Recorded points are <b>kept</b>. Once the two new points are confirmed, every real-world
    coordinate is recomputed with the new transform (the pixel coordinates are what is stored).</li>
  <li>Until then, <b>the current calibration stays in force</b>. Entering one point and giving up
    loses nothing (press a to go back to Add).</li>
  <li>While redoing, the old calibration points are drawn faint and the new ones solid.</li>
</ul>

<h3>Zoom and pan</h3>
<table>
  <tr><td>Trackpad pinch</td><td>Zoom in / out about the cursor</td></tr>
  <tr><td>Ctrl/Cmd + wheel</td><td>The same, with a mouse</td></tr>
  <tr><td>Two-finger scroll</td><td>Pan</td></tr>
  <tr><td>Wheel / Shift+wheel</td><td>Pan vertically / horizontally (mouse)</td></tr>
  <tr><td>+ / -</td><td>Zoom in / out</td></tr>
  <tr><td>0</td><td>Fit the whole frame again</td></tr>
</table>
<p class="hint">Three-finger scroll is taken by macOS itself and never reaches the browser.</p>

<h3>Keyboard shortcuts</h3>
<table>
  <tr><td>Ctrl+O</td><td>Open files</td></tr>
  <tr><td>Ctrl+S</td><td>Save</td></tr>
  <tr><td>c / a / d</td><td>Calibration / Add / Delete mode</td></tr>
  <tr><td>→ or x</td><td>Next frame</td></tr>
  <tr><td>← or z</td><td>Previous frame</td></tr>
  <tr><td>j</td><td>Jump to a frame number</td></tr>
  <tr><td>, / .</td><td>Smaller / larger frame step (frames per press of ◀ ▶)</td></tr>
  <tr><td>[ / ]</td><td>Smaller / larger points</td></tr>
  <tr><td>e</td><td>Settings (same as ⚙; changes apply immediately)</td></tr>
  <tr><td>? / h</td><td>This help (same as the ? button at the top)</td></tr>
  <tr><td>Esc</td><td>Close the settings, QR codes, changelog, feedback window or this help</td></tr>
</table>

<h3>What "Resume" does</h3>
<p>Saving writes <code>session.json</code> into the output folder (the two calibration points,
  the transform, and the clicked points of every frame). <b>Resume</b> reads it back.</p>
<ol>
  <li><b>Open</b> the <b>same video or images</b> as before (the images themselves are not in session.json)</li>
  <li>Press <b>Resume</b> and pick the earlier <code>session.json</code></li>
  <li>The calibration and every point come back, so you can carry on adding or deleting</li>
</ol>
<p class="hint">Useful when you were interrupted, want to add more points, or only want to redo the calibration.</p>

<h3>What is saved</h3>
<ul>
  <li><code>coords.mat</code> — binary readable by MATLAB / scipy (<code>coords_raw</code>, <code>coords_real</code> and more)</li>
  <li><code>coords.csv</code> — every point in one text file</li>
  <li><code>plot_frame_XXXX.png</code> — the clicked points in real-world coordinates, joined by a curve</li>
  <li><code>overlay_frame_XXXX.png</code> — the source image with the clicked points drawn on it, for checking</li>
  <li><code>session.json</code> — the state for resuming</li>
  <li><code>README.md</code> — how to read all of the above (Markdown)</li>
</ul>
<p class="hint">Per-frame PNGs are <b>on by default for images and off for video</b> (a video can
  have a great many annotated frames). Switch them in the settings (⚙ / e). All the numbers are in
  <code>coords.mat</code> / <code>coords.csv</code>, so the figures can be redrawn later. The exported
  files are the same whatever the UI language (the README and CSV stay in their fixed format).</p>`,
  },
};

/**
 * UI text in the current language.
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
function t(key, params) {
  return /** @type {any} */ (window).I18N.t(key, params);
}

/**
 * @typedef {{x: number, y: number}} Pt
 */

const els = {
  open: /** @type {HTMLButtonElement} */ (document.getElementById('btn-open')),
  loadSession: /** @type {HTMLButtonElement} */ (document.getElementById('btn-load-session')),
  save: /** @type {HTMLButtonElement} */ (document.getElementById('btn-save')),
  fileInput: /** @type {HTMLInputElement} */ (document.getElementById('file-input')),
  sessionInput: /** @type {HTMLInputElement} */ (document.getElementById('session-input')),
  fpsGroup: /** @type {HTMLElement} */ (document.getElementById('fps-group')),
  fpsInput: /** @type {HTMLInputElement} */ (document.getElementById('fps-input')),
  fpsSource: /** @type {HTMLElement} */ (document.getElementById('fps-source')),
  prev: /** @type {HTMLButtonElement} */ (document.getElementById('btn-prev')),
  next: /** @type {HTMLButtonElement} */ (document.getElementById('btn-next')),
  jump: /** @type {HTMLButtonElement} */ (document.getElementById('btn-jump')),
  frameStep: /** @type {HTMLInputElement} */ (document.getElementById('frame-step')),
  seekRow: /** @type {HTMLElement} */ (document.getElementById('seek-row')),
  seek: /** @type {HTMLInputElement} */ (document.getElementById('seek')),
  frameLabel: /** @type {HTMLElement} */ (document.getElementById('frame-label')),
  frameTime: /** @type {HTMLElement} */ (document.getElementById('frame-time')),
  pointCount: /** @type {HTMLElement} */ (document.getElementById('point-count')),
  stage: /** @type {HTMLElement} */ (document.getElementById('stage')),
  canvas: /** @type {HTMLCanvasElement} */ (document.getElementById('canvas')),
  placeholder: /** @type {HTMLElement} */ (document.getElementById('placeholder')),
  log: /** @type {HTMLElement} */ (document.getElementById('log')),
  logbox: /** @type {HTMLElement} */ (document.getElementById('logbox')),
  status: /** @type {HTMLElement} */ (document.getElementById('status')),
  helpBtn: /** @type {HTMLButtonElement} */ (document.getElementById('help-btn')),
  helpOverlay: /** @type {HTMLElement} */ (document.getElementById('helpOverlay')),
  helpClose: /** @type {HTMLButtonElement} */ (document.getElementById('helpClose')),
  feedbackBtn: /** @type {HTMLButtonElement} */ (document.getElementById('feedback-btn')),
  feedbackOverlay: /** @type {HTMLElement} */ (document.getElementById('feedbackOverlay')),
  feedbackForm: /** @type {HTMLFormElement} */ (document.getElementById('feedbackForm')),
  feedbackMessage: /** @type {HTMLTextAreaElement} */ (document.getElementById('feedbackMessage')),
  feedbackContact: /** @type {HTMLInputElement} */ (document.getElementById('feedbackContact')),
  feedbackWebsite: /** @type {HTMLInputElement} */ (document.getElementById('feedbackWebsite')),
  feedbackStatus: /** @type {HTMLElement} */ (document.getElementById('feedbackStatus')),
  feedbackSend: /** @type {HTMLButtonElement} */ (document.getElementById('feedbackSend')),
  feedbackClose: /** @type {HTMLButtonElement} */ (document.getElementById('feedbackClose')),
  appVersion: /** @type {HTMLElement} */ (document.getElementById('app-version')),
  fullscreenBtn: /** @type {HTMLButtonElement} */ (document.getElementById('fullscreen-btn')),
  settingsBtn: /** @type {HTMLButtonElement} */ (document.getElementById('settings-btn')),
  settingsPanel: /** @type {HTMLElement} */ (document.getElementById('settings-panel')),
  settingsClose: /** @type {HTMLButtonElement} */ (document.getElementById('settings-close')),
  backdrop: /** @type {HTMLElement} */ (document.getElementById('sheet-backdrop')),
  langSelect: /** @type {HTMLSelectElement} */ (document.getElementById('lang-select')),
  qrBtn: /** @type {HTMLButtonElement} */ (document.getElementById('qrBtn')),
  qrOverlay: /** @type {HTMLElement} */ (document.getElementById('qrOverlay')),
  qrClose: /** @type {HTMLButtonElement} */ (document.getElementById('qrClose')),
  qrUrl: /** @type {HTMLElement} */ (document.getElementById('qrUrl')),
  qrSrcUrl: /** @type {HTMLElement} */ (document.getElementById('qrSrcUrl')),
  changelogBtn: /** @type {HTMLButtonElement} */ (document.getElementById('changelogBtn')),
  changelogOverlay: /** @type {HTMLElement} */ (document.getElementById('changelogOverlay')),
  changelogList: /** @type {HTMLElement} */ (document.getElementById('changelogList')),
  changelogClose: /** @type {HTMLButtonElement} */ (document.getElementById('changelogClose')),
  modeButtons: /** @type {HTMLButtonElement[]} */ (Array.from(document.querySelectorAll('button.mode'))),
  setDiameter: /** @type {HTMLInputElement} */ (document.getElementById('set-diameter')),
  setEqualAspect: /** @type {HTMLInputElement} */ (document.getElementById('set-equal-aspect')),
  clearDataBtn: /** @type {HTMLButtonElement} */ (document.getElementById('clearDataBtn')),
  setMarkerEdge: /** @type {HTMLInputElement} */ (document.getElementById('set-marker-edge')),
  setFramePngs: /** @type {HTMLInputElement} */ (document.getElementById('set-frame-pngs')),
  setIndexAuto: /** @type {HTMLInputElement} */ (document.getElementById('set-index-auto')),
  setIndexColor: /** @type {HTMLInputElement} */ (document.getElementById('set-index-color')),
  markerSize: /** @type {HTMLInputElement} */ (document.getElementById('marker-size')),
  zoomIn: /** @type {HTMLButtonElement} */ (document.getElementById('btn-zoom-in')),
  zoomOut: /** @type {HTMLButtonElement} */ (document.getElementById('btn-zoom-out')),
  zoomReset: /** @type {HTMLButtonElement} */ (document.getElementById('btn-zoom-reset')),
  zoomLabel: /** @type {HTMLElement} */ (document.getElementById('zoom-label')),
  setPointColor: /** @type {HTMLInputElement} */ (document.getElementById('set-point-color')),
  setCalibColor: /** @type {HTMLInputElement} */ (document.getElementById('set-calib-color')),
  setSmooth: /** @type {HTMLInputElement} */ (document.getElementById('set-smooth')),
  setShowIndex: /** @type {HTMLInputElement} */ (document.getElementById('set-show-index')),

  guide: /** @type {HTMLElement} */ (document.getElementById('guide')),
  guideStep: /** @type {HTMLElement} */ (document.getElementById('guide-step')),
  guideText: /** @type {HTMLElement} */ (document.getElementById('guide-text')),
  guideSub: /** @type {HTMLElement} */ (document.getElementById('guide-sub')),

  dlgCalib: /** @type {HTMLDialogElement} */ (document.getElementById('dlg-calib')),
  calibTitle: /** @type {HTMLElement} */ (document.getElementById('calib-title')),
  calibPixel: /** @type {HTMLElement} */ (document.getElementById('calib-pixel')),
  calibNote: /** @type {HTMLElement} */ (document.getElementById('calib-note')),
  calibX: /** @type {HTMLInputElement} */ (document.getElementById('calib-x')),
  calibY: /** @type {HTMLInputElement} */ (document.getElementById('calib-y')),
  calibCancel: /** @type {HTMLButtonElement} */ (document.getElementById('calib-cancel')),

  dlgJump: /** @type {HTMLDialogElement} */ (document.getElementById('dlg-jump')),
  jumpValue: /** @type {HTMLInputElement} */ (document.getElementById('jump-value')),
  jumpRange: /** @type {HTMLElement} */ (document.getElementById('jump-range')),
  jumpCancel: /** @type {HTMLButtonElement} */ (document.getElementById('jump-cancel')),

  dlgConfirm: /** @type {HTMLDialogElement} */ (document.getElementById('dlg-confirm')),
  confirmTitle: /** @type {HTMLElement} */ (document.getElementById('confirm-title')),
  confirmText: /** @type {HTMLElement} */ (document.getElementById('confirm-text')),
  confirmCancel: /** @type {HTMLButtonElement} */ (document.getElementById('confirm-cancel')),
  confirmOk: /** @type {HTMLButtonElement} */ (document.getElementById('confirm-ok')),
};

const state = {
  /** @type {any} */ source: null,
  /** @type {any} */ currentFrame: null,
  frameIndex: 0,
  /** @type {'none'|'calib'|'add'|'del'} */ mode: 'none',
  /** @type {Pt[]} */ calibImg: [],
  /** @type {Pt[]} */ calibReal: [],
  /** @type {any} */ transform: null,
  /**
   * Calibration being entered right now. The committed calibration above stays in force
   * until two new points are confirmed, so an abandoned re-calibration cannot throw the
   * existing one (and every real-world coordinate derived from it) away.
   * @type {{img: Pt[], real: Pt[]}}
   */
  pendingCalib: { img: [], real: [] },
  /** @type {Pt[][]} */ framesRaw: [],
  /** @type {(number|null)[]} */ frameTimes: [],
  settings: {
    /** marker diameter: screen pixels on the canvas, image pixels in the exported overlay */
    diameter: 4,
    pointColor: '#e03131',
    calibColor: '#12b886',
    /** white outline around each marker; its thickness follows the marker size */
    markerEdge: true,
    smooth: false,
    showIndex: true,
    /** point numbers follow the point colour unless indexColorAuto is turned off */
    indexColorAuto: true,
    indexColor: '#1971c2',
    /** keep the exported plot's x and y at the same units-per-pixel */
    equalAspect: false,
    /**
     * Write plot_frame_XXXX.png / overlay_frame_XXXX.png. Set from the source kind when
     * a file is opened: on for images, off for video, where hundreds of annotated frames
     * would mean hundreds of PNGs and a long export.
     */
    framePngs: true,
  },
  /** canvas view transform, in CSS pixels: image point (ix,iy) -> (tx + ix*scale, ty + iy*scale) */
  view: { scale: 1, tx: 0, ty: 0 },
  dirty: false,
  busy: false,
  /** set when the view should snap back to "whole frame visible" on the next draw */
  needsFit: true,
  /** how many frames one press of prev/next moves */
  frameStep: 1,
  /** 1 or 2 while the calibration coordinate dialog is open, 0 otherwise */
  awaitingCalibInput: 0,
};

// --- small helpers -----------------------------------------------------------

/**
 * @param {string} msg
 * @param {'info'|'warn'|'err'} [level]
 */
function log(msg, level = 'info') {
  const div = document.createElement('div');
  if (level !== 'info') div.className = level === 'warn' ? 'warn' : 'err';
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  div.textContent = `[${hh}:${mm}:${ss}] ${msg}`;
  els.log.appendChild(div);
  els.logbox.scrollTop = els.logbox.scrollHeight;
}

/** The status line as a message key, so a language switch can redraw it. */
let statusMsg = { key: 'status.ready', /** @type {Record<string, string|number>|undefined} */ params: undefined };

/**
 * @param {string} key STRINGS key
 * @param {Record<string, string|number>} [params]
 */
function setStatus(key, params) {
  statusMsg = { key, params };
  els.status.textContent = t(key, params);
}

/** @param {number} n */
function pad4(n) {
  return String(n).padStart(4, '0');
}

/** ISO 8601 timestamp including the local UTC offset. */
function localIso() {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const p = (v) => String(Math.floor(Math.abs(v))).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T`
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    + `${sign}${p(off / 60)}:${p(off % 60)}`;
}

/** @param {HTMLCanvasElement} canvas */
function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(/** @type {Blob} */ (b)), 'image/png'));
}

/** Colour of the point numbers: the point colour by default. */
function indexColor() {
  return state.settings.indexColorAuto ? state.settings.pointColor : state.settings.indexColor;
}

// --- in-page dialogs ---------------------------------------------------------
// Native prompt() / confirm() / alert() are deliberately not used: Chrome can suppress
// them (and they render as an opaque page-dimming overlay when they do), which leaves the
// user stuck with no way forward. These <dialog> based versions always show up in-page.

/**
 * Move a modal dialog to the corner furthest from the click, so it never covers the
 * point being calibrated. Modal dialogs are centred by `margin: auto`, so overriding
 * the margins is enough to move them.
 * @param {HTMLDialogElement} dialog
 * @param {MouseEvent} [event]
 */
function placeDialogAwayFrom(dialog, event) {
  dialog.classList.remove('pos-left', 'pos-right', 'pos-top', 'pos-bottom');
  if (!event) return;
  dialog.classList.add(event.clientX > window.innerWidth / 2 ? 'pos-left' : 'pos-right');
  dialog.classList.add(event.clientY > window.innerHeight / 2 ? 'pos-top' : 'pos-bottom');
}

/**
 * @param {HTMLDialogElement} dialog
 * @returns {Promise<string>} the value of the button used to close it ('' if dismissed)
 */
function openDialog(dialog) {
  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      resolve(dialog.returnValue);
    };
    dialog.addEventListener('close', onClose);
    dialog.returnValue = '';
    dialog.showModal();
  });
}

/**
 * @param {string} text
 * @param {{title?: string, okLabel?: string, cancelLabel?: string}} [opts]
 * @returns {Promise<boolean>}
 */
async function showConfirm(text, opts = {}) {
  els.confirmTitle.textContent = opts.title || t('dlg.confirmTitle');
  els.confirmText.textContent = text;
  els.confirmOk.textContent = opts.okLabel || t('dlg.ok');
  els.confirmCancel.textContent = opts.cancelLabel || t('dlg.cancel');
  els.confirmCancel.hidden = false;
  return (await openDialog(els.dlgConfirm)) === 'ok';
}

/**
 * @param {string} text
 * @param {string} [title]
 * @returns {Promise<void>}
 */
async function showMessage(text, title = t('dlg.messageTitle')) {
  els.confirmTitle.textContent = title;
  els.confirmText.textContent = text;
  els.confirmOk.textContent = t('dlg.ok');
  els.confirmCancel.hidden = true;
  await openDialog(els.dlgConfirm);
  els.confirmCancel.hidden = false;
}

/**
 * Ask for the real-world coordinates of a calibration point.
 * @param {number} pointNo 1 or 2
 * @param {Pt} pixel where the user clicked
 * @param {MouseEvent} [event] the originating click, used to place the dialog
 * @returns {Promise<Pt|null>} null when cancelled
 */
async function askCalibReal(pointNo, pixel, event) {
  els.calibTitle.textContent = t('calib.title', { n: pointNo });
  els.calibPixel.textContent = t('calib.pixel', { x: pixel.x.toFixed(1), y: pixel.y.toFixed(1) });
  els.calibNote.textContent = t(pointNo === 1 ? 'calib.note1' : 'calib.note2');
  els.calibX.value = '';
  els.calibY.value = '';
  placeDialogAwayFrom(els.dlgCalib, event);
  const result = await openDialog(els.dlgCalib);
  if (result !== 'ok') return null;
  const x = Number(els.calibX.value);
  const y = Number(els.calibY.value);
  if (!isFinite(x) || !isFinite(y)) return null;
  return { x, y };
}

/**
 * @param {number} max
 * @param {number} current 1-based
 * @returns {Promise<number|null>} 1-based frame number, or null when cancelled
 */
async function askFrameNumber(max, current) {
  els.jumpValue.max = String(max);
  els.jumpValue.value = String(current);
  els.jumpRange.textContent = t('jump.range', { max });
  const result = await openDialog(els.dlgJump);
  if (result !== 'ok') return null;
  const n = Number(els.jumpValue.value);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

// --- guide bar ---------------------------------------------------------------

/**
 * Say what to do next, in the bar under the toolbar.
 * @param {{step: string, text: string, sub?: string, tone?: 'info'|'warn'|'done'}} g
 */
function setGuide(g) {
  els.guideStep.textContent = g.step;
  els.guideText.textContent = g.text;
  els.guideSub.textContent = g.sub || '';
  els.guide.className = g.tone === 'warn' ? 'warn' : g.tone === 'done' ? 'done' : '';
}

/** Recompute the guide from the current state. */
function updateGuide() {
  if (!state.source) {
    setGuide({ step: 'STEP 1', text: t('guide.open'), sub: t('guide.openSub') });
    return;
  }

  const nav = state.source.frameCount > 1 ? t('guide.nav') : '';

  if (state.mode === 'calib') {
    if (state.awaitingCalibInput) {
      setGuide({
        step: 'STEP 2',
        text: t('guide.calibInput', { n: state.awaitingCalibInput }),
        sub: t('guide.calibInputSub'),
      });
      return;
    }
    if (state.pendingCalib.img.length === 0) {
      setGuide({
        step: 'STEP 2',
        text: t('guide.calib1'),
        sub: t(state.transform ? 'guide.calib1Redo' : 'guide.calib1Sub'),
      });
    } else {
      setGuide({
        step: 'STEP 2',
        text: t('guide.calib2'),
        sub: t(state.transform ? 'guide.calib2Redo' : 'guide.calib2Sub'),
      });
    }
    return;
  }

  if (state.mode === 'del') {
    setGuide({ step: 'DELETE', text: t('guide.del'), sub: t('guide.delSub', { nav }), tone: 'warn' });
    return;
  }

  if (state.mode === 'add') {
    if (!state.transform) {
      setGuide({ step: t('guide.warnStep'), text: t('guide.noCalib'), sub: t('guide.noCalibSub'), tone: 'warn' });
      return;
    }
    const n = totalPoints(state.framesRaw);
    setGuide({
      step: 'STEP 3',
      text: t('guide.add'),
      sub: n === 0 ? t('guide.addSub0', { nav }) : t('guide.addSubN', { n, nav }),
      tone: n === 0 ? 'info' : 'done',
    });
    return;
  }

  setGuide({ step: t('guide.modeStep'), text: t('guide.mode'), sub: 'Calibration (c) / Add (a) / Delete (d)' });
}

// --- loading -----------------------------------------------------------------

async function pickFiles() {
  const anyWin = /** @type {any} */ (window);
  if (typeof anyWin.showOpenFilePicker === 'function') {
    try {
      const handles = await anyWin.showOpenFilePicker({
        multiple: true,
        types: [{
          description: t('pick.desc'),
          accept: {
            'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.webm'],
            'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tif', '.tiff'],
          },
        }],
      });
      return await Promise.all(handles.map((/** @type {any} */ h) => h.getFile()));
    } catch (e) {
      if (/** @type {any} */ (e).name === 'AbortError') return null;
      // fall through to the classic input
    }
  }
  return new Promise((resolve) => {
    els.fileInput.value = '';
    els.fileInput.onchange = () => resolve(Array.from(els.fileInput.files || []));
    els.fileInput.click();
  });
}

/** @param {File[]} files */
async function loadFiles(files) {
  if (!files || files.length === 0) return;
  if (state.dirty && !await showConfirm(t('confirm.discardText'),
    { title: t('confirm.discardTitle'), okLabel: t('confirm.discardOk') })) return;

  const videos = files.filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|m4v|webm)$/i.test(f.name));
  const images = files.filter((f) => !videos.includes(f));

  try {
    state.busy = true;
    setStatus('status.loading');
    if (state.source) {
      state.source.dispose();
      state.source = null;
    }

    if (videos.length > 0) {
      if (videos.length > 1) log(t('log.multiVideo', { name: videos[0].name }), 'warn');
      state.source = await createVideoSource(videos[0], (m) => log(m));
    } else {
      state.source = await createImageSource(images, (m) => log(m, 'warn'));
    }

    resetAnnotations();
    state.settings.framePngs = state.source.kind === 'images';
    els.canvas.style.display = 'block';
    els.placeholder.style.display = 'none';
    setEnabled(true);
    updateFpsUi();
    log(t('log.loaded', {
      name: state.source.name, n: state.source.frameCount, w: state.source.width, h: state.source.height,
    }));
    if (!state.settings.framePngs) {
      log(t('log.videoPngsOff'));
    }
    enterCalibMode();
    await showFrame(0);
  } catch (err) {
    log(/** @type {Error} */ (err).message, 'err');
    setStatus('status.loadFailed');
    // leave the UI in a consistent "nothing loaded" state rather than pointing at a disposed source
    state.source = null;
    state.currentFrame = null;
    els.canvas.style.display = 'none';
    els.placeholder.style.display = '';
    els.fpsGroup.hidden = true;
    setMode('none');
    updateGuide();
    els.prev.disabled = true;
    els.next.disabled = true;
    els.jump.disabled = true;
    els.frameStep.disabled = true;
    els.seek.disabled = true;
    els.seekRow.hidden = true;
    els.save.disabled = true;
    els.loadSession.disabled = true;
    els.zoomIn.disabled = true;
    els.zoomOut.disabled = true;
    els.zoomReset.disabled = true;
    els.modeButtons.forEach((b) => { b.disabled = true; });
  } finally {
    state.busy = false;
  }
}

function resetAnnotations() {
  const n = state.source.frameCount;
  state.framesRaw = Array.from({ length: n }, () => []);
  state.frameTimes = Array.from({ length: n }, (_, i) => (state.source.fps ? i / state.source.fps : null));
  state.calibImg = [];
  state.calibReal = [];
  state.transform = null;
  state.pendingCalib = { img: [], real: [] };
  state.frameIndex = 0;
  state.dirty = false;
  state.needsFit = true;
  setFrameStep(1);
}

/** @param {boolean} enabled */
function setEnabled(enabled) {
  const multi = enabled && state.source.frameCount > 1;
  els.prev.disabled = !multi;
  els.next.disabled = !multi;
  els.jump.disabled = !multi;
  els.frameStep.disabled = !multi;
  els.seek.disabled = !multi;
  els.seekRow.hidden = !multi;
  els.save.disabled = !enabled;
  els.loadSession.disabled = !enabled;
  els.zoomIn.disabled = !enabled;
  els.zoomOut.disabled = !enabled;
  els.zoomReset.disabled = !enabled;
  els.modeButtons.forEach((b) => { b.disabled = !enabled; });
}

function updateFpsUi() {
  const s = state.source;
  if (!s || s.kind !== 'video') {
    els.fpsGroup.hidden = true;
    return;
  }
  els.fpsGroup.hidden = false;
  els.fpsInput.value = String(s.fps);
  els.fpsSource.textContent = t(s.fpsSource === 'detected' ? 'fps.detected' : 'fps.manual');
}

// --- display -----------------------------------------------------------------

/** @param {number} index */
async function showFrame(index) {
  if (!state.source) return;
  const clamped = Math.max(0, Math.min(state.source.frameCount - 1, index));
  state.frameIndex = clamped;
  const frame = await state.source.getFrame(clamped);
  state.currentFrame = frame;
  if (frame.time !== null) state.frameTimes[clamped] = frame.time;
  if (state.needsFit) {
    fitView();
    state.needsFit = false;
  }
  redraw();
  updateLabels();
}

/** Size the backing store to the stage, in device pixels. */
function layoutCanvas() {
  const rect = els.stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (els.canvas.width !== w || els.canvas.height !== h) {
    els.canvas.width = w;
    els.canvas.height = h;
  }
  return { width: rect.width, height: rect.height, dpr };
}

/** Scale at which the whole frame fits in the stage. */
function fitScale() {
  const f = state.currentFrame;
  if (!f) return 1;
  const rect = els.stage.getBoundingClientRect();
  return Math.min(rect.width / f.width, rect.height / f.height) || 1;
}

/** Reset the view so the whole frame is visible and centred. */
function fitView() {
  const f = state.currentFrame;
  if (!f) return;
  const rect = els.stage.getBoundingClientRect();
  const scale = fitScale();
  state.view = {
    scale,
    tx: (rect.width - f.width * scale) / 2,
    ty: (rect.height - f.height * scale) / 2,
  };
}

/** Keep part of the frame on screen, so it can never be panned away completely. */
function clampView() {
  const f = state.currentFrame;
  if (!f) return;
  const rect = els.stage.getBoundingClientRect();
  const margin = 60;
  const w = f.width * state.view.scale;
  const h = f.height * state.view.scale;
  state.view.tx = Math.min(rect.width - margin, Math.max(margin - w, state.view.tx));
  state.view.ty = Math.min(rect.height - margin, Math.max(margin - h, state.view.ty));
}

/**
 * Zoom around a point given in client coordinates, keeping the image point under it fixed.
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} factor
 */
function zoomAt(clientX, clientY, factor) {
  if (!state.currentFrame) return;
  const rect = els.canvas.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const v = state.view;
  const ix = (px - v.tx) / v.scale;
  const iy = (py - v.ty) / v.scale;
  const min = Math.min(0.05, fitScale() * 0.5);
  const next = Math.max(min, Math.min(64, v.scale * factor));
  v.tx = px - ix * next;
  v.ty = py - iy * next;
  v.scale = next;
  clampView();
}

/** Zoom about the centre of the stage — used by the buttons and keyboard. */
function zoomByButton(factor) {
  const rect = els.stage.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  redraw();
}

function redraw() {
  const f = state.currentFrame;
  if (!f) return;
  const { dpr } = layoutCanvas();
  const v = state.view;
  const ctx = /** @type {CanvasRenderingContext2D} */ (els.canvas.getContext('2d'));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#101010';
  ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);

  ctx.setTransform(dpr * v.scale, 0, 0, dpr * v.scale, dpr * v.tx, dpr * v.ty);
  // once magnified past 4x, show the real pixels instead of a blurred interpolation
  ctx.imageSmoothingEnabled = v.scale < 4;
  ctx.drawImage(f.image, 0, 0, f.width, f.height);

  const markerStyle = {
    radius: state.settings.diameter / 2,
    pointColor: state.settings.pointColor,
    calibColor: state.settings.calibColor,
    showIndex: state.settings.showIndex,
    edge: state.settings.markerEdge,
    indexColor: indexColor(),
  };
  const points = state.framesRaw[state.frameIndex] || [];
  // markers keep a constant on-screen size at any zoom level
  if (state.mode === 'calib' && state.pendingCalib.img.length > 0) {
    // the calibration still in force is dimmed; the one being entered is solid
    ctx.globalAlpha = 0.3;
    drawMarkers(ctx, [], state.calibImg, markerStyle, v.scale);
    ctx.globalAlpha = 1;
    drawMarkers(ctx, points, state.pendingCalib.img, markerStyle, v.scale);
  } else {
    drawMarkers(ctx, points, state.calibImg, markerStyle, v.scale);
  }

  els.zoomLabel.textContent = `${Math.round(v.scale * 100)}%`;
}

function updateLabels() {
  const s = state.source;
  els.frameLabel.textContent = s ? `${state.frameIndex + 1} / ${s.frameCount}` : '- / -';
  if (s) {
    els.seek.max = String(Math.max(0, s.frameCount - 1));
    els.seek.value = String(state.frameIndex);
  }
  const time = state.frameTimes[state.frameIndex];
  els.frameTime.textContent = time === null || time === undefined ? '' : `t = ${time.toFixed(4)} s`;
  const here = (state.framesRaw[state.frameIndex] || []).length;
  els.pointCount.textContent = t('nav.pointCount', { here, total: totalPoints(state.framesRaw) });
  updateGuide();
}

// --- modes -------------------------------------------------------------------

/** @param {'none'|'calib'|'add'|'del'} mode */
function setMode(mode) {
  state.mode = mode;
  els.modeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
}

function enterCalibMode() {
  setMode('calib');
  state.awaitingCalibInput = 0;
  state.pendingCalib = { img: [], real: [] };
  const n = totalPoints(state.framesRaw);
  if (state.transform) {
    log(t('log.recalib', { n }));
  } else {
    log(t('log.calibStart'));
  }
  setStatus('status.calib1');
  redraw();
  updateGuide();
}

/** Drop a half-finished re-calibration and keep the one already in force. */
function discardPendingCalib() {
  if (state.pendingCalib.img.length === 0) return;
  state.pendingCalib = { img: [], real: [] };
  log(t(state.transform ? 'log.recalibAborted' : 'log.calibAborted'), 'warn');
}

function enterAddMode() {
  discardPendingCalib();
  setMode('add');
  setStatus('status.add');
  redraw();
  updateGuide();
}

function enterDelMode() {
  discardPendingCalib();
  setMode('del');
  setStatus('status.del');
  redraw();
  updateGuide();
}

// --- clicking ----------------------------------------------------------------

/**
 * @param {MouseEvent} event
 * @returns {Pt}
 */
function eventToImageCoords(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - state.view.tx) / state.view.scale,
    y: (event.clientY - rect.top - state.view.ty) / state.view.scale,
  };
}

/** @param {MouseEvent} event */
async function onCanvasClick(event) {
  if (!state.source || state.busy) return;
  if (document.querySelector('dialog[open]')) return;
  const f = state.currentFrame;
  const p = eventToImageCoords(event);
  if (!f || p.x < 0 || p.y < 0 || p.x >= f.width || p.y >= f.height) return;

  if (state.mode === 'calib') await handleCalibClick(p, event);
  else if (state.mode === 'add') handleAddClick(p);
  else if (state.mode === 'del') handleDelClick(p);
  else log(t('log.chooseMode'), 'warn');
}

/**
 * @param {Pt} p
 * @param {MouseEvent} [event] used to place the dialog away from the clicked point
 */
async function handleCalibClick(p, event) {
  state.pendingCalib.img.push(p);
  redraw();
  updateGuide();

  const n = state.pendingCalib.img.length;
  // block further canvas clicks until this point is fully resolved, so a fast second
  // click cannot slip in between the dialog closing and the value being recorded
  state.busy = true;
  state.awaitingCalibInput = n;
  updateGuide();
  setStatus('status.calibInput', { n });
  let real;
  try {
    real = await askCalibReal(n, p, event);
  } finally {
    state.busy = false;
    state.awaitingCalibInput = 0;
  }
  if (!real) {
    state.pendingCalib.img.pop();
    log(t('log.calibCancelled', { n }), 'warn');
    redraw();
    updateGuide();
    return;
  }
  state.pendingCalib.real.push(real);
  updateGuide();
  setStatus(state.pendingCalib.img.length >= 2 ? 'status.add' : 'status.calib2');
  log(t('log.calibPoint', { n, px: p.x.toFixed(1), py: p.y.toFixed(1), rx: real.x, ry: real.y }));

  if (state.pendingCalib.img.length >= 2) {
    const { transform, warnings } = computeTransform(
      /** @type {[Pt, Pt]} */ ([state.pendingCalib.img[0], state.pendingCalib.img[1]]),
      /** @type {[Pt, Pt]} */ ([state.pendingCalib.real[0], state.pendingCalib.real[1]]),
    );
    const replaced = state.transform !== null;
    // commit: from here on this is the calibration every real-world coordinate uses
    state.transform = transform;
    state.calibImg = state.pendingCalib.img.slice();
    state.calibReal = state.pendingCalib.real.slice();
    state.pendingCalib = { img: [], real: [] };
    // computeTransform returns message keys, not text (calib.js stays language-free)
    warnings.forEach((w) => log(t(w), 'warn'));
    log(t(replaced ? 'log.calibUpdated' : 'log.calibDone',
      { sx: transform.scaleX.toPrecision(6), sy: transform.scaleY.toPrecision(6) }));
    const n2 = totalPoints(state.framesRaw);
    if (n2 > 0) {
      // real-world coordinates are derived from the raw pixels on demand, so every
      // existing point simply follows the new transform
      log(t('log.recomputed', { n: n2 }));
    }
    state.dirty = true;
    setMode('add');
    setStatus('status.add');
    redraw();
    updateGuide();
  } else {
    setStatus('status.calib2');
  }
}

/** @param {Pt} p */
function handleAddClick(p) {
  const i = state.frameIndex;
  state.framesRaw[i] = addPoint(state.framesRaw[i], p);
  state.dirty = true;
  const real = pixelToReal(state.transform, p.x, p.y);
  const n = state.framesRaw[i].length;
  if (state.transform) {
    log(t('log.added', {
      f: i + 1, n, px: p.x.toFixed(1), py: p.y.toFixed(1), rx: real.x.toFixed(4), ry: real.y.toFixed(4),
    }));
  } else {
    log(t('log.addedNaN', { f: i + 1, n, px: p.x.toFixed(1), py: p.y.toFixed(1) }), 'warn');
  }
  redraw();
  updateLabels();
}

/** @param {Pt} p */
function handleDelClick(p) {
  const i = state.frameIndex;
  const res = deleteNearest(state.framesRaw[i], p.x, p.y);
  if (res.removedIndex < 0) {
    log(t('log.nothingToDelete'), 'warn');
    return;
  }
  state.framesRaw[i] = res.points;
  state.dirty = true;
  const r = /** @type {Pt} */ (res.removed);
  log(t('log.deleted', { f: i + 1, i: res.removedIndex, px: r.x.toFixed(1), py: r.y.toFixed(1) }));
  redraw();
  updateLabels();
}

// --- navigation --------------------------------------------------------------

/**
 * Frame steps the user can reach with the , and . keys. The number box accepts
 * anything, this is just a quick ladder.
 */
const STEP_LADDER = [1, 2, 5, 10, 20, 50, 100, 200, 500];

/**
 * @param {number} n
 */
function setFrameStep(n) {
  if (!isFinite(n)) return;
  const max = state.source ? Math.max(1, state.source.frameCount - 1) : 10000;
  state.frameStep = Math.max(1, Math.min(max, Math.round(n)));
  els.frameStep.value = String(state.frameStep);
  updateLabels();
}

/** Move to the next/previous rung of the ladder relative to the current step. */
function nudgeFrameStep(dir) {
  const cur = state.frameStep;
  if (dir > 0) {
    setFrameStep(STEP_LADDER.find((v) => v > cur) || cur * 2);
  } else {
    const smaller = STEP_LADDER.filter((v) => v < cur);
    setFrameStep(smaller.length ? smaller[smaller.length - 1] : 1);
  }
  log(t('log.step', { n: state.frameStep }));
}

/**
 * Go to a frame, coalescing requests: dragging the seek bar fires far faster than a
 * video can be decoded, so only the latest target is honoured while one seek is running.
 * @type {number|null}
 */
let pendingSeek = null;

/** @param {number} index */
async function requestSeek(index) {
  if (!state.source) return;
  const target = Math.max(0, Math.min(state.source.frameCount - 1, Math.round(index)));
  if (state.busy) {
    pendingSeek = target;
    return;
  }
  state.busy = true;
  try {
    let next = target;
    while (next !== null) {
      pendingSeek = null;
      await showFrame(next);
      next = pendingSeek;
    }
  } finally {
    pendingSeek = null;
    state.busy = false;
  }
}

/**
 * Move by the current frame step. Near an end it clamps instead of refusing to move,
 * so a large step still lands on the first/last frame.
 * @param {number} delta -1 or +1
 */
async function step(delta) {
  if (!state.source) return;
  const next = Math.max(0, Math.min(state.source.frameCount - 1,
    state.frameIndex + delta * state.frameStep));
  if (next === state.frameIndex) return;
  await requestSeek(next);
}

async function jumpDialog() {
  if (!state.source) return;
  const n = await askFrameNumber(state.source.frameCount, state.frameIndex + 1);
  if (n === null) return;
  await requestSeek(n - 1);
}

// --- export ------------------------------------------------------------------

/** @returns {any} */
function buildDataset() {
  const framesReal = state.framesRaw.map((pts) => pts.map((p) => pixelToReal(state.transform, p.x, p.y)));
  return {
    appVersion: APP_VERSION,
    exportedAt: localIso(),
    sourceKind: state.source.kind,
    sourceName: state.source.name,
    sourceFiles: state.source.files,
    width: state.source.width,
    height: state.source.height,
    fps: state.source.fps,
    fpsSource: state.source.fpsSource,
    frameCount: state.source.frameCount,
    frameTimes: state.frameTimes,
    transform: state.transform,
    calibImg: state.calibImg,
    calibReal: state.calibReal,
    framesRaw: state.framesRaw,
    framesReal,
  };
}

/**
 * Render the two PNGs for one frame.
 * @param {number} index
 * @param {any} dataset
 * @returns {Promise<{name: string, data: Blob}[]>}
 */
async function renderFrameImages(index, dataset) {
  const out = [];
  const frame = await state.source.getFrame(index);

  const plotCanvas = document.createElement('canvas');
  plotCanvas.width = 1200;
  plotCanvas.height = 900;
  drawCalibratedPlot(plotCanvas, dataset.framesReal[index], {
    title: `${dataset.sourceName} — frame_index ${index}`
      + (dataset.frameTimes[index] === null || dataset.frameTimes[index] === undefined
        ? '' : ` (t = ${Number(dataset.frameTimes[index]).toFixed(4)} s)`),
    smooth: state.settings.smooth,
    showIndex: state.settings.showIndex,
    pointColor: state.settings.pointColor,
    equalAspect: state.settings.equalAspect,
    indexColor: indexColor(),
  });
  out.push({ name: `plot_frame_${pad4(index)}.png`, data: await canvasToBlob(plotCanvas) });

  const overlayCanvas = document.createElement('canvas');
  drawOverlay(overlayCanvas, frame.image, frame.width, frame.height,
    state.framesRaw[index], state.calibImg, {
      radius: state.settings.diameter / 2,
      pointColor: state.settings.pointColor,
      calibColor: state.settings.calibColor,
      showIndex: state.settings.showIndex,
      edge: state.settings.markerEdge,
      indexColor: indexColor(),
    });
  out.push({ name: `overlay_frame_${pad4(index)}.png`, data: await canvasToBlob(overlayCanvas) });

  return out;
}

async function save() {
  if (!state.source || state.busy) return;
  if (!state.transform) {
    const go = await showConfirm(t('confirm.noCalibText'),
      { title: t('confirm.noCalibTitle'), okLabel: t('confirm.saveAnyway') });
    if (!go) return;
  }
  const total = totalPoints(state.framesRaw);
  if (total === 0) {
    const go = await showConfirm(t('confirm.noPointsText'),
      { title: t('confirm.noPointsTitle'), okLabel: t('confirm.saveAnyway') });
    if (!go) return;
  }

  if (state.settings.framePngs) {
    const n = state.framesRaw.filter((pts) => pts.length > 0).length;
    // rendering is a seek + two canvas encodes per frame, so a long video is a long wait
    if (n > 30 && !await showConfirm(
      t('confirm.manyPngsText', { n, m: n * 2 }),
      { title: t('confirm.manyPngsTitle'), okLabel: t('confirm.write'), cancelLabel: t('confirm.stop') })) {
      log(t('log.saveStopped'), 'warn');
      return;
    }
  }

  const anyWin = /** @type {any} */ (window);
  const hasDirPicker = typeof anyWin.showDirectoryPicker === 'function';
  /** @type {any} */
  let dir = null;
  if (hasDirPicker) {
    try {
      dir = await anyWin.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      if (/** @type {any} */ (e).name === 'AbortError') return;
      log(t('log.dirFailed', { msg: /** @type {Error} */ (e).message }), 'err');
      return;
    }
  } else {
    log(t('log.noDirPicker'), 'warn');
  }

  state.busy = true;
  const restoreIndex = state.frameIndex;
  try {
    const dataset = buildDataset();
    /** @type {{name: string, data: any}[]} */
    const files = [
      { name: 'coords.mat', data: new Blob([encodeMatV5(buildMatVars(dataset))], { type: 'application/octet-stream' }) },
      { name: 'coords.csv', data: new Blob([buildCsv(dataset)], { type: 'text/csv' }) },
      { name: 'session.json', data: new Blob([buildSessionJson(dataset)], { type: 'application/json' }) },
    ];

    const framesWithPoints = [];
    for (let i = 0; i < state.framesRaw.length; i++) {
      if (state.framesRaw[i].length > 0) framesWithPoints.push(i);
    }
    if (state.settings.framePngs) {
      for (let k = 0; k < framesWithPoints.length; k++) {
        const i = framesWithPoints[k];
        setStatus('status.rendering', { k: k + 1, n: framesWithPoints.length });
        files.push(...await renderFrameImages(i, dataset));
      }
    } else if (framesWithPoints.length > 0) {
      log(t('log.pngsSkipped', { n: framesWithPoints.length }));
    }

    files.push({
      name: 'README.md',
      data: new Blob([buildReadme(dataset, files.map((f) => f.name).concat(['README.md']).sort())], { type: 'text/markdown' }),
    });

    if (dir) {
      for (let k = 0; k < files.length; k++) {
        setStatus('status.writing', { k: k + 1, n: files.length, name: files[k].name });
        const handle = await dir.getFileHandle(files[k].name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(files[k].data);
        await writable.close();
      }
      log(t('log.saved', { n: files.length, f: framesWithPoints.length }));
    } else {
      for (const f of files) {
        const url = URL.createObjectURL(f.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 120));
      }
      log(t('log.downloaded', { n: files.length }));
    }
    state.dirty = false;
    setStatus('status.saved');
  } catch (err) {
    log(t('log.saveFailed', { msg: /** @type {Error} */ (err).message }), 'err');
    setStatus('status.saveFailed');
  } finally {
    await showFrame(restoreIndex);
    state.busy = false;
  }
}

// --- session reload ----------------------------------------------------------

async function loadSessionFile() {
  els.sessionInput.value = '';
  els.sessionInput.onchange = async () => {
    const file = (els.sessionInput.files || [])[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.format !== 'click-to-get-coord/session') {
        throw new Error(t('log.notSession'));
      }
      if (data.source && data.source.name !== state.source.name) {
        log(t('log.sessionNameDiff', { a: data.source.name, b: state.source.name }), 'warn');
      }
      const n = state.source.frameCount;
      if (data.framesRaw.length !== n) {
        log(t('log.sessionFramesDiff', { a: data.framesRaw.length, b: n }), 'warn');
      }
      state.framesRaw = Array.from({ length: n }, (_, i) => (data.framesRaw[i] || []).map(
        (/** @type {Pt} */ p) => ({ x: p.x, y: p.y }),
      ));
      if (data.calibration) {
        state.calibImg = data.calibration.imagePoints.map((/** @type {Pt} */ p) => ({ x: p.x, y: p.y }));
        state.calibReal = data.calibration.realPoints.map((/** @type {Pt} */ p) => ({ x: p.x, y: p.y }));
        state.transform = data.calibration.transform;
        enterAddMode();
      } else {
        enterCalibMode();
      }
      if (data.source && Array.isArray(data.source.frameTimes) && data.source.frameTimes.length === n) {
        state.frameTimes = data.source.frameTimes;
      }
      state.dirty = false;
      log(t('log.sessionRestored', { n: totalPoints(state.framesRaw) }));
      await showFrame(0);
    } catch (err) {
      log(t('log.sessionFailed', { msg: /** @type {Error} */ (err).message }), 'err');
    }
  };
  els.sessionInput.click();
}

// --- settings sheet ----------------------------------------------------------
// The common settings sheet of the yukmmz.github.io apps (see multitask-timer). Every
// control applies the moment it changes; there is no OK / Cancel.

/**
 * Settings remembered between visits. framePngs is left out on purpose: it is reset from
 * the source kind every time a file is opened (on for images, off for video).
 */
const PERSISTED_SETTINGS = ['diameter', 'pointColor', 'calibColor', 'markerEdge', 'smooth',
  'showIndex', 'indexColorAuto', 'indexColor', 'equalAspect'];

/** Restore saved settings over the defaults; a missing or broken entry keeps the default. */
function loadSettings() {
  let saved = null;
  try { saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { saved = null; }
  if (!saved || typeof saved !== 'object') return;
  const s = /** @type {Record<string, any>} */ (state.settings);
  PERSISTED_SETTINGS.forEach((k) => {
    const v = saved[k];
    if (typeof v !== typeof s[k]) return;
    if (typeof v === 'number' && !isFinite(v)) return;
    if (typeof v === 'string' && !/^#[0-9a-f]{6}$/i.test(v)) return;
    s[k] = v;
  });
  s.diameter = Math.max(1, Math.min(40, Math.round(s.diameter)));
}

function saveSettings() {
  const s = /** @type {Record<string, any>} */ (state.settings);
  /** @type {Record<string, any>} */ const out = {};
  PERSISTED_SETTINGS.forEach((k) => { out[k] = s[k]; });
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(out)); } catch (e) { /* ignore */ }
}

/** Delete everything this app keeps in the browser and start over (after asking). */
async function clearSavedData() {
  closeOverlays();
  const ok = await showConfirm(t('c.clearConfirm'), { title: t('c.clearData'), okLabel: t('c.clearData') });
  if (!ok) return;
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch (e) { /* ignore */ }
  location.reload();
}

/** Write the current settings into the sheet's controls. */
function syncSettingsSheet() {
  els.setDiameter.value = String(state.settings.diameter);
  els.setPointColor.value = state.settings.pointColor;
  els.setCalibColor.value = state.settings.calibColor;
  els.setSmooth.checked = state.settings.smooth;
  els.setShowIndex.checked = state.settings.showIndex;
  els.setEqualAspect.checked = state.settings.equalAspect;
  els.setMarkerEdge.checked = state.settings.markerEdge;
  els.setFramePngs.checked = state.settings.framePngs;
  els.setIndexAuto.checked = state.settings.indexColorAuto;
  els.setIndexColor.value = state.settings.indexColor;
  els.setIndexColor.disabled = state.settings.indexColorAuto;
}

/** Read every sheet control except the diameter (see setDiameter) and apply it now. */
function applySettingsFromSheet() {
  state.settings.pointColor = els.setPointColor.value;
  state.settings.calibColor = els.setCalibColor.value;
  state.settings.smooth = els.setSmooth.checked;
  state.settings.showIndex = els.setShowIndex.checked;
  state.settings.equalAspect = els.setEqualAspect.checked;
  state.settings.markerEdge = els.setMarkerEdge.checked;
  state.settings.framePngs = els.setFramePngs.checked;
  state.settings.indexColorAuto = els.setIndexAuto.checked;
  state.settings.indexColor = els.setIndexColor.value;
  els.setIndexColor.disabled = state.settings.indexColorAuto;
  saveSettings();
  redraw();
}

/**
 * Marker diameter, shared by the toolbar box, the settings sheet and the [ ] keys.
 * @param {number} d
 */
function setDiameter(d) {
  if (!isFinite(d)) return;
  state.settings.diameter = Math.max(1, Math.min(40, Math.round(d)));
  els.markerSize.value = String(state.settings.diameter);
  els.setDiameter.value = String(state.settings.diameter);
  saveSettings();
  redraw();
}

/** @param {boolean} open */
function setSettingsOpen(open) {
  if (open) syncSettingsSheet();
  els.settingsPanel.hidden = !open;
  els.backdrop.hidden = !open;
  els.settingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function openSettings() {
  setSettingsOpen(true);
}

/** Close the settings sheet and the QR / changelog / help / feedback overlays. @returns {boolean} whether any was open */
function closeOverlays() {
  const wasOpen = anyOverlayOpen();
  setSettingsOpen(false);
  els.qrOverlay.hidden = true;
  els.changelogOverlay.hidden = true;
  els.helpOverlay.hidden = true;
  els.feedbackOverlay.hidden = true;
  return wasOpen;
}

function anyOverlayOpen() {
  return !els.settingsPanel.hidden || !els.qrOverlay.hidden || !els.changelogOverlay.hidden
    || !els.helpOverlay.hidden || !els.feedbackOverlay.hidden;
}

/** The "How to use" window, opened by the header ? button or the ? / h keys. */
function openHelp() {
  closeOverlays();
  els.helpOverlay.hidden = false;
  const body = els.helpOverlay.querySelector('.help-body');
  if (body) body.scrollTop = 0;
}

// --- feedback (header FB button) ---------------------------------------------

/** The feedback window, opened by the header FB button. */
function openFeedback() {
  closeOverlays();
  els.feedbackStatus.textContent = '';
  els.feedbackStatus.className = 'feedback-status';
  els.feedbackOverlay.hidden = false;
  els.feedbackMessage.focus();
}

/** @param {string} key @param {string} kind '' | 'ok' | 'err' */
function setFeedbackStatus(key, kind) {
  els.feedbackStatus.textContent = t(key);
  els.feedbackStatus.className = 'feedback-status' + (kind ? ' ' + kind : '');
}

/** Post the message to the shared GAS endpoint. Sent as text/plain so the
 * browser makes a "simple" request: GAS cannot answer a CORS preflight.
 * @param {Event} event */
function sendFeedback(event) {
  event.preventDefault();
  const message = els.feedbackMessage.value.trim();
  if (!message) { setFeedbackStatus('c.feedbackEmpty', 'err'); return; }
  els.feedbackSend.disabled = true;
  setFeedbackStatus('c.feedbackSending', '');
  fetch(FEEDBACK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      app: FEEDBACK_APP_ID, version: APP_VERSION, lang: /** @type {any} */ (window).I18N.lang(), message,
      contact: els.feedbackContact.value.trim(), website: els.feedbackWebsite.value,
    }),
  }).then((res) => res.json()).then((res) => {
    if (!res || !res.ok) throw new Error(res && res.error);
    els.feedbackMessage.value = '';
    els.feedbackContact.value = '';
    setFeedbackStatus('c.feedbackThanks', 'ok');
  }).catch(() => {
    setFeedbackStatus('c.feedbackError', 'err');
  }).then(() => {
    els.feedbackSend.disabled = false;
  });
}

// --- changelog ---------------------------------------------------------------

function readSeenVersion() {
  try { return window.localStorage.getItem(SEEN_VERSION_KEY); } catch (e) { return null; }
}

function writeSeenVersion() {
  try { window.localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION); } catch (e) { /* ignore */ }
}

/**
 * First visit ever: nothing is "new", so record the version quietly. Before 1.1.0 this
 * app stored nothing in the browser, so only a visitor who already has something saved
 * under `click-to-get-coord/` (the language) counts as returning and gets the mark.
 */
function initSeenVersion() {
  if (readSeenVersion() !== null) return;
  let hadData = false;
  try { hadData = window.localStorage.getItem(LANG_KEY) !== null; } catch (e) { /* ignore */ }
  if (!hadData) writeSeenVersion();
}

function syncNewsMark() {
  const hasNews = readSeenVersion() !== APP_VERSION;
  els.settingsBtn.classList.toggle('has-news', hasNews);
  els.changelogBtn.classList.toggle('has-news', hasNews);
}

function buildChangelog() {
  els.changelogList.textContent = '';
  const lang = /** @type {any} */ (window).I18N.lang();
  for (const entry of CHANGELOG) {
    const section = document.createElement('section');
    section.className = 'changelog-entry';
    const head = document.createElement('h3');
    head.className = 'changelog-version';
    head.textContent = `v${entry.version} (${entry.date})`;
    section.appendChild(head);
    const list = document.createElement('ul');
    for (const item of entry.items) {
      const li = document.createElement('li');
      li.textContent = /** @type {any} */ (item)[lang] || item.ja;
      list.appendChild(li);
    }
    section.appendChild(list);
    els.changelogList.appendChild(section);
  }
}

function openChangelog() {
  setSettingsOpen(false);
  els.changelogOverlay.hidden = false;
  els.changelogList.scrollTop = 0;
  writeSeenVersion();
  syncNewsMark();
}

// --- full screen -------------------------------------------------------------

/** ⛶ toggles full screen. Hidden where the browser cannot do it (iPhone). */
function fullscreenElement() {
  const doc = /** @type {any} */ (document);
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

function toggleFullscreen() {
  const doc = /** @type {any} */ (document);
  const root = /** @type {any} */ (document.documentElement);
  if (fullscreenElement()) {
    (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
  } else {
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (req) {
      const p = req.call(root);
      if (p && typeof p.catch === 'function') p.catch(() => { /* ignore */ });
    }
  }
}

/**
 * Swap the icon and label so the button shows what a press will do (expand
 * when windowed, shrink while full screen). Also runs when the user leaves full
 * screen with Esc, which never touches the button.
 */
function syncFullscreenBtn() {
  const on = !!fullscreenElement();
  const label = t(on ? 'c.exitFullscreen' : 'c.fullscreen');
  els.fullscreenBtn.classList.toggle('is-fullscreen', on);
  els.fullscreenBtn.title = label;
  els.fullscreenBtn.setAttribute('aria-label', label);
}

function initFullscreen() {
  const root = /** @type {any} */ (document.documentElement);
  els.fullscreenBtn.hidden = !(root.requestFullscreen || root.webkitRequestFullscreen);
  els.fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', syncFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', syncFullscreenBtn);
  syncFullscreenBtn();
}

// --- language ----------------------------------------------------------------

/** Redraw the text that is built in JS rather than marked up with data-i18n. */
function applyLanguage() {
  const i18n = /** @type {any} */ (window).I18N;
  els.langSelect.value = i18n.lang();
  els.status.textContent = t(statusMsg.key, statusMsg.params);
  updateFpsUi();
  updateLabels();   // point count, and the guide bar through updateGuide()
  syncFullscreenBtn();
  buildChangelog();
}

// --- wiring ------------------------------------------------------------------

els.open.addEventListener('click', async () => {
  const files = await pickFiles();
  if (files) await loadFiles(files);
});
els.loadSession.addEventListener('click', loadSessionFile);
els.save.addEventListener('click', save);
els.prev.addEventListener('click', () => step(-1));
els.next.addEventListener('click', () => step(1));
els.jump.addEventListener('click', jumpDialog);
els.canvas.addEventListener('click', onCanvasClick);

// settings sheet: ⚙ toggles it; ✕, a click on the backdrop and Esc close it
els.settingsBtn.addEventListener('click', () => setSettingsOpen(els.settingsPanel.hidden));
els.settingsClose.addEventListener('click', () => setSettingsOpen(false));
els.backdrop.addEventListener('click', () => setSettingsOpen(false));
els.langSelect.addEventListener('change', () => /** @type {any} */ (window).I18N.set(els.langSelect.value));
els.setDiameter.addEventListener('change', () => setDiameter(Number(els.setDiameter.value)));
// colours follow the picker live; checkboxes apply on change
[els.setPointColor, els.setCalibColor, els.setIndexColor].forEach((el) => {
  el.addEventListener('input', applySettingsFromSheet);
});
[els.setFramePngs, els.setIndexAuto, els.setMarkerEdge, els.setSmooth, els.setShowIndex,
  els.setEqualAspect].forEach((el) => el.addEventListener('change', applySettingsFromSheet));
els.clearDataBtn.addEventListener('click', clearSavedData);

// QR codes, changelog and help: close with the button, a click outside the card, or Esc
els.qrBtn.addEventListener('click', () => {
  setSettingsOpen(false);
  els.qrOverlay.hidden = false;
});
els.qrClose.addEventListener('click', () => { els.qrOverlay.hidden = true; });
els.qrOverlay.addEventListener('click', (e) => {
  if (e.target === els.qrOverlay) els.qrOverlay.hidden = true;
});
els.changelogBtn.addEventListener('click', openChangelog);
els.appVersion.addEventListener('click', openChangelog);
els.changelogClose.addEventListener('click', () => { els.changelogOverlay.hidden = true; });
els.changelogOverlay.addEventListener('click', (e) => {
  if (e.target === els.changelogOverlay) els.changelogOverlay.hidden = true;
});
// How to use: the same closing rules as the changelog
els.helpBtn.addEventListener('click', openHelp);
els.helpClose.addEventListener('click', () => { els.helpOverlay.hidden = true; });
els.helpOverlay.addEventListener('click', (e) => {
  if (e.target === els.helpOverlay) els.helpOverlay.hidden = true;
});
// Feedback: the same closing rules; Esc inside its fields is handled by the global
// keydown handler, which runs closeOverlays() before it ignores keys typed into fields.
els.feedbackBtn.addEventListener('click', openFeedback);
els.feedbackForm.addEventListener('submit', sendFeedback);
els.feedbackClose.addEventListener('click', () => { els.feedbackOverlay.hidden = true; });
els.feedbackOverlay.addEventListener('click', (e) => {
  if (e.target === els.feedbackOverlay) els.feedbackOverlay.hidden = true;
});

// Cancel buttons are type="button" on purpose: that leaves OK as the only submit button
// in each form, so pressing Enter in a field confirms instead of cancelling.
els.calibCancel.addEventListener('click', () => els.dlgCalib.close('cancel'));
els.jumpCancel.addEventListener('click', () => els.dlgJump.close('cancel'));
els.confirmCancel.addEventListener('click', () => els.dlgConfirm.close('cancel'));

els.markerSize.addEventListener('change', () => setDiameter(Number(els.markerSize.value)));
els.frameStep.addEventListener('change', () => setFrameStep(Number(els.frameStep.value)));
els.seek.addEventListener('input', () => requestSeek(Number(els.seek.value)));
els.zoomIn.addEventListener('click', () => zoomByButton(1.25));
els.zoomOut.addEventListener('click', () => zoomByButton(1 / 1.25));
els.zoomReset.addEventListener('click', () => { fitView(); redraw(); });

// Trackpad pinch arrives as a wheel event with ctrlKey set; two-finger scroll arrives as
// a plain wheel event. Three-finger gestures never reach the page — macOS keeps them.
els.stage.addEventListener('wheel', (e) => {
  if (!state.currentFrame) return;
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  if (e.ctrlKey || e.metaKey) {
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * unit * 0.01));
  } else {
    let dx = e.deltaX * unit;
    let dy = e.deltaY * unit;
    if (e.shiftKey && dx === 0) { dx = dy; dy = 0; } // mouse wheel: shift pans sideways
    state.view.tx -= dx;
    state.view.ty -= dy;
    clampView();
  }
  redraw();
}, { passive: false });

els.modeButtons.forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.mode === 'calib') enterCalibMode();
  else if (b.dataset.mode === 'add') enterAddMode();
  else enterDelMode();
}));

els.fpsInput.addEventListener('change', async () => {
  const v = Number(els.fpsInput.value);
  if (!state.source || !isFinite(v) || v <= 0) return;
  const hadPoints = totalPoints(state.framesRaw) > 0;
  if (hadPoints && !await showConfirm(t('confirm.fpsText'),
    { title: t('confirm.fpsTitle'), okLabel: t('confirm.fpsOk') })) {
    updateFpsUi();
    return;
  }
  state.source.setFps(v);
  resetAnnotations();
  updateFpsUi();
  log(t('log.fpsChanged', { v, n: state.source.frameCount }), 'warn');
  enterCalibMode();
  await showFrame(0);
});

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer ? e.dataTransfer.files : []);
  await loadFiles(files);
});

document.addEventListener('keydown', (e) => {
  // Esc first: it must also work while a control inside the settings sheet has focus
  if (e.key === 'Escape' && !document.querySelector('dialog[open]') && closeOverlays()) {
    e.preventDefault();
    return;
  }
  const target = /** @type {HTMLElement} */ (e.target);
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  if (document.querySelector('dialog[open]')) return;
  // the sheet and the overlays cover the page: no shortcuts reach it behind them
  if (anyOverlayOpen()) return;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    els.open.click();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    save();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key) {
    case 'ArrowRight': case 'x': step(1); break;
    case 'ArrowLeft': case 'z': step(-1); break;
    case '[': setDiameter(state.settings.diameter - 1); break;
    case ']': setDiameter(state.settings.diameter + 1); break;
    case ',': nudgeFrameStep(-1); break;
    case '.': nudgeFrameStep(1); break;
    case '+': case ';': case '=': zoomByButton(1.25); break;
    case '-': zoomByButton(1 / 1.25); break;
    case '0': fitView(); redraw(); break;
    case 'c': if (state.source) enterCalibMode(); break;
    case 'a': if (state.source) enterAddMode(); break;
    case 'd': if (state.source) enterDelMode(); break;
    case 'j': if (state.source) jumpDialog(); break;
    case 'e': openSettings(); break;
    case 'h': case '?': openHelp(); break;
    default: return;
  }
  e.preventDefault();
});

window.addEventListener('resize', () => { clampView(); redraw(); });

window.addEventListener('beforeunload', (e) => {
  if (!state.dirty) return;
  e.preventDefault();
  e.returnValue = '';
});

// --- startup -----------------------------------------------------------------

// Before any text is produced: fills every data-i18n* element in the document.
/** @type {any} */ (window).I18N.init(LANG_KEY, STRINGS);
/** @type {any} */ (window).I18N.onChange(applyLanguage);
els.langSelect.value = /** @type {any} */ (window).I18N.lang();

els.appVersion.textContent = `v${APP_VERSION}`;
// the QR images encode the same URLs; print the constants so the two cannot drift apart
els.qrUrl.textContent = APP_URL;
els.qrSrcUrl.textContent = SOURCE_URL;
initSeenVersion();
buildChangelog();
syncNewsMark();
initFullscreen();

log(t('log.welcome', { v: APP_VERSION }));
setStatus('status.ready');
updateGuide();
loadSettings();
els.markerSize.value = String(state.settings.diameter);

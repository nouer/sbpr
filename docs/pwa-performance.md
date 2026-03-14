# PWA 起動速度最適化ガイド

ビルドシステムなしの軽量PWAにおける起動速度最適化パターン集。sbprでの実践を基にまとめたもの。

---

## 1. レンダーブロッキングスクリプトの排除

`<head>` 内の `<script>` はHTMLパーサーをブロックし、ダウンロード＋実行が完了するまで画面が描画されない。

### 対策

**defer属性:** パース完了後に実行。DOMContentLoadedの前に実行される。

```html
<!-- NG: パーサーブロッキング -->
<script src="app.js"></script>

<!-- OK: パース完了後に実行 -->
<script src="app.js" defer></script>
```

**遅延読み込み（グラフタブでのみ必要なChart.jsなど）:**

初期表示に不要な大きなライブラリは、実際に必要になるまで読み込まない。

```javascript
let _libLoaded = false;
let _libLoading = null;

async function ensureLibLoaded() {
    if (_libLoaded) return;
    if (_libLoading) return _libLoading;
    _libLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.example.com/lib.min.js';
        s.onload = () => { _libLoaded = true; resolve(); };
        s.onerror = reject;
        document.head.appendChild(s);
    });
    return _libLoading;
}
```

ポイント:
- `_libLoading` で二重読み込みを防止
- 利用する関数の先頭で `await ensureLibLoaded()` を呼ぶ
- Service Workerでもキャッシュしてオフライン対応を維持する（下記参照）

> **重要: 外部CDNリソースのSWキャッシュ方針**
>
> `cache.addAll()` は配列中の1件でも取得失敗すると全体がrejectされ、SWインストール自体が失敗する。外部CDN URLを `addAll()` に含めると、CDN障害時にローカルリソースまで巻き添えになる。
>
> **標準方針:** 外部CDNリソースは `addAll()` とは分離し、個別に `cache.add()` を `try/catch` で囲んで取得する。失敗してもSWインストールは成功させ、次回オンライン時に再取得する。

---

## 2. 重複I/Oの排除（1回読み出し→共有パターン）

同じデータを複数箇所で読み出していないか確認する。

### パターン: オプショナルパラメータによる共有

```javascript
// 呼び出し元が records を持っていれば渡す。なければ自分で取得。
async function renderList(records) {
    if (!records) records = await getAllRecords();
    // ...
}

// 初期化時: 1回だけ読み出して共有
const allRecords = await getAllRecords();
await Promise.all([
    renderList(allRecords),
    updateBadge(allRecords),
    prefillForm(allRecords)
]);
```

既存の引数なし呼び出しとの互換性を維持しつつ、初期化パスでは重複を排除できる。

---

## 3. クリティカルパスの監査

`initApp()` の各 `await` を「これは後続処理の前提か？」で分類する。

| 分類 | 例 | 対策 |
|------|-----|------|
| 前提あり | DB読み出し → 表示更新 | `await` を維持 |
| 前提なし | Service Worker登録 | fire-and-forget |
| 独立 | AI初期化とDB読み出し | `Promise.all` |

### fire-and-forgetパターン

```javascript
// NG: 起動パスをブロック
await registerServiceWorker();

// OK: バックグラウンドで完了すればよい
registerServiceWorker();
```

Service Worker登録はネットワーク要求を伴い50〜500msかかるが、後続処理は依存しない。

---

## 4. Promise.allによる並列化

依存関係のない非同期処理は `Promise.all()` で並列実行する。

```javascript
// NG: 直列実行
await taskA();
await taskB();
await taskC();

// OK: 並列実行（taskA,B,Cが互いに独立なら）
await Promise.all([taskA(), taskB(), taskC()]);
```

### initApp()の3フェーズ設計

```
Phase 1: データ取得 + 独立した初期化（並列）
    ↓
Phase 2: データを消費する処理（並列）
    ↓
Phase 3: 非クリティカル処理（fire-and-forget）
```

---

## 5. Service Worker登録のfire-and-forgetパターン

SW登録は以下の理由でfire-and-forgetが安全:
- 登録結果に依存するUI処理がない
- 失敗してもアプリの基本機能に影響しない
- 再訪問時にブラウザが自動でリトライする

ただし、更新検知やキャッシュクリア処理はSW登録関数内部で完結させること。

---

## 6. ビルドシステムなしでの遅延読み込み

bundlerがない環境での外部ライブラリ遅延読み込みパターン:

1. `<head>` からスクリプトタグを除去
2. 動的に `<script>` 要素を生成して `document.head` に追加
3. `onload` / `onerror` でPromiseを解決
4. 依存関係がある場合はチェーン（Chart.js → adapter）
5. Service Workerでもキャッシュする（ただし `addAll()` とは分離し、個別 `try/catch` で取得）

---

## 7. 計測方法

### performance.mark / performance.measure

```javascript
performance.mark('app-init-start');
// ... 初期化処理
performance.mark('app-init-end');
performance.measure('app-init', 'app-init-start', 'app-init-end');
console.log(performance.getEntriesByName('app-init')[0].duration);
```

### DevToolsでの確認

- Performance タブ → Record → リロード
- Network タブでスクリプトの読み込み順序を確認
- Lighthouse → Performance スコア

### 効果の確認ポイント

| 指標 | 確認方法 |
|------|---------|
| FCP (First Contentful Paint) | Lighthouse / DevTools Performance |
| TTI (Time to Interactive) | `document.body.dataset.appReady` の設定タイミング |
| スクリプト読み込み | Network タブのウォーターフォール |
| IndexedDB呼び出し回数 | `getAllRecords` にログを仕込んで確認 |

---

## 8. iOSスプラッシュ画面対応

iOSではPWAスタンドアロンモードで `apple-touch-startup-image` メタタグがないとスプラッシュ画面が表示されず黒画面になる。

### 仕組み

- `<link rel="apple-touch-startup-image">` にmedia queryを付けてデバイスごとの画像を指定
- media queryは `device-width`, `device-height`, `-webkit-device-pixel-ratio` の組み合わせ

### media queryの必須要素

iOSがスプラッシュ画像を認識するには、media queryに以下の要素が**すべて**必要:

```html
<link rel="apple-touch-startup-image" href="/icons/splash/splash-1179x2556.png"
      media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)">
```

| 要素 | 必須 | 備考 |
|------|------|------|
| `screen and` | Yes | メディアタイプの明示 |
| `device-width` | Yes | CSSピクセル幅（=画像幅÷pixel ratio） |
| `device-height` | Yes | CSSピクセル高（=画像高÷pixel ratio） |
| `-webkit-device-pixel-ratio` | Yes | 2x or 3x |
| `orientation: portrait` | Yes | **欠落するとスプラッシュが表示されない** |

> **過去の不具合（2026/3/9〜3/14）:** `screen and` プレフィックスと `(orientation: portrait)` が欠落しており、スプラッシュ画面が表示されなかった。参考実装: [Evan Bacon gist](https://gist.github.com/EvanBacon/7fd4dc3be3d00096579bb0b134c56ec7)、[pwa-asset-generator](https://github.com/elegantapp/pwa-asset-generator)

### 対応デバイス一覧（17種）

| デバイス | 画像サイズ | CSS幅×高 | Ratio |
|---------|----------|---------|-------|
| iPhone SE1/5 | 640×1136 | 320×568 | 2x |
| iPhone 6/7/8/SE2/SE3 | 750×1334 | 375×667 | 2x |
| iPhone 6+/7+/8+ | 1242×2208 | 414×736 | 3x |
| iPhone X/XS/11Pro/12mini | 1125×2436 | 375×812 | 3x |
| iPhone XR/11/12/13/14 | 828×1792 | 414×896 | 2x |
| iPhone XS Max/11 Pro Max | 1242×2688 | 414×896 | 3x |
| iPhone 12Pro/13/14 | 1170×2532 | 390×844 | 3x |
| iPhone 14Pro/15/16 | 1179×2556 | 393×852 | 3x |
| iPhone 13 Pro Max/14 Plus | 1284×2778 | 428×926 | 3x |
| iPhone 16 Pro | 1206×2622 | 402×874 | 3x |
| iPhone 14ProMax/15Plus/16Plus | 1290×2796 | 430×932 | 3x |
| iPhone 16ProMax | 1320×2868 | 440×956 | 3x |
| iPad Mini 6th | 1488×2266 | 744×1133 | 2x |
| iPad | 1536×2048 | 768×1024 | 2x |
| iPad 10th/Air | 1640×2360 | 820×1180 | 2x |
| iPad Pro 11" | 1668×2388 | 834×1194 | 2x |
| iPad Pro 12.9" | 2048×2732 | 1024×1366 | 2x |

デバイスサイズの確認: [ios-resolution.com](https://www.ios-resolution.com/)

### 画像生成

`scripts/generate_splash.py` で `local_app/icons/icon-512.png` をベースにスプラッシュ画像を自動生成。

```bash
python3 scripts/generate_splash.py
```

### 新デバイス追加手順

1. `scripts/generate_splash.py` の `SPLASH_SIZES` に新サイズを追加
2. `python3 scripts/generate_splash.py` を実行
3. `local_app/index.html` に `<link rel="apple-touch-startup-image">` タグを追加（`screen and` + `orientation: portrait` を忘れないこと）
4. `local_app/sw.js` の `PRECACHE_ASSETS` に新画像パスを追加
5. ビルド実行

---

## 9. インラインクリティカルCSS

外部CSS読み込み前にabove-the-foldのUIを即座に描画するため、`index.html` の `<head>` 内にインラインCSSを挿入。

### 対象
- `body` 背景色・フォント
- `.app-header` ヘッダーバー
- `.tab-nav` タブナビゲーション
- `.tab-content` タブ表示制御
- `.card` カードコンテナ
- `.loading-spinner` ローディングスピナー

### 注意点
- `style.css` の対応スタイルを変更した場合、インラインCSSも同期すること
- `body[data-app-ready="true"] .loading-spinner { display: none }` でアプリ準備完了後にスピナーを非表示

# シンプル血圧記録 (sbpr)

日常の血圧測定データを簡単に記録・確認できるWebアプリケーションです。  
ブラウザ内（IndexedDB）にデータを保存するため、サーバーへのデータ送信は一切行いません。

**デモ**: [https://sbpr-three.vercel.app/](https://sbpr-three.vercel.app/)

## 主な機能

- **血圧記録**: 最高血圧・最低血圧・脈拍数・メモを入力して保存
- **血圧分類**: JSH2019 家庭血圧基準に基づく自動分類（正常血圧〜III度高血圧）
- **グラフ表示**: Chart.js による血圧推移の折れ線グラフ（7日/30日/90日/全期間）
- **基準線表示**: 最高血圧 135mmHg / 最低血圧 85mmHg の基準ライン
- **記録管理**: 一覧表示、編集、削除、日付フィルタ
- **エクスポート/インポート**: JSON形式でデータのバックアップ・復元
- **PWA対応**: ホーム画面インストール、完全オフライン動作、バッジ表示
- **オフライン動作**: Service Worker + IndexedDB による完全オフライン対応
- **レスポンシブ対応**: PC・タブレット・スマートフォン対応

## 技術スタック

| 項目 | 技術 |
|------|------|
| フロントエンド | HTML + vanilla JavaScript (SPA) |
| スタイル | CSS（ビルドツール不使用） |
| データストア | IndexedDB |
| グラフ描画 | [Chart.js](https://www.chartjs.org/) v4 |
| PWA | Web App Manifest + Service Worker |
| テスト | Jest + Puppeteer |
| コンテナ | Docker (nginx:alpine / node:alpine) |
| デプロイ | Vercel |

## ディレクトリ構成

```
sbpr/
├── local_app/              # アプリ本体（HTML + vanilla JS）
│   ├── index.html          # SPA エントリポイント
│   ├── style.css           # スタイルシート
│   ├── script.js           # メインロジック（IndexedDB・UI・グラフ・PWA）
│   ├── bp.calc.js          # 計算ロジック（純粋関数）
│   ├── bp.calc.test.js     # 単体テスト
│   ├── e2e.test.js         # E2Eテスト（Puppeteer）
│   ├── version.js          # ビルド時自動生成
│   ├── manifest.json       # PWA Web App Manifest
│   ├── sw.js               # PWA Service Worker
│   └── icons/              # PWA アイコン
│       ├── icon-192.svg    # 192x192 アイコン
│       ├── icon-512.svg    # 512x512 アイコン
│       └── icon-maskable.svg # マスカブルアイコン
├── api/                    # Vercel Serverless Functions
│   ├── openai.js           # OpenAI reverse proxy (query param方式)
│   └── openai/[...path].js # OpenAI reverse proxy (catch-all, fallback)
├── docs/                   # ドキュメント駆動開発用
│   ├── requirements_definition.md
│   ├── basic_design.md
│   ├── detailed_design.md
│   ├── algorithm_logic.md
│   ├── test_specification.md
│   └── test_expected.md
├── scripts/
│   ├── build.sh            # ビルド＆起動
│   ├── rebuild.sh          # クリーンビルド＆起動
│   └── generate_version.sh # バージョン情報生成
├── nginx/
│   └── default.conf        # ローカル開発用nginx設定
├── docker-compose.yml      # 3サービス構成
├── Dockerfile              # nginx:alpine（アプリ配信）
├── Dockerfile.test         # node:alpine + Chromium（テスト実行）
├── package.json            # Jest + Puppeteer
└── vercel.json             # Vercelデプロイ設定
```

## セットアップ

### 前提条件

- Docker / Docker Compose

### ビルド＆起動

```bash
./scripts/build.sh
```

ブラウザで `http://localhost:8082` にアクセスしてください。

### クリーンビルド

```bash
./scripts/rebuild.sh
```

## テスト

Docker コンテナ上でテストを実行します。

```bash
docker compose run --rm sbpr-test npm test
```

- **単体テスト**: `bp.calc.test.js` — 血圧分類・統計計算・バリデーション
- **E2Eテスト**: `e2e.test.js` — ページ表示・記録操作・タブ切替・pageerror検知

## Docker構成（3サービス体制）

| サービス | 用途 | ポート |
|----------|------|--------|
| `sbpr-app` | テスト/E2E用（内部ネットワークのみ） | 非公開 |
| `sbpr-app-public` | ブラウザ確認用 | 8082 (変更可) |
| `sbpr-test` | テスト実行（Node.js + Chromium） | — |

## PWA（Progressive Web App）

本アプリはPWA対応しており、スマートフォンにネイティブアプリのようにインストールできます。

### インストール方法

**Android (Chrome)**:
1. ブラウザでアプリを開く
2. メニュー（⋮）→「ホーム画面に追加」をタップ
3. ホーム画面のアイコンからフルスクリーンで起動

**iOS (Safari)**:
1. Safari でアプリを開く
2. 共有ボタン（□↑）→「ホーム画面に追加」をタップ
3. ホーム画面のアイコンからフルスクリーンで起動

### PWA機能一覧

| 機能 | 説明 |
|------|------|
| ホーム画面インストール | ネイティブアプリのようにアイコンから起動 |
| 完全オフライン動作 | Service Worker によりネットワーク不要で動作 |
| テーマカラー / スプラッシュ | 起動時にブランドカラーのスプラッシュ表示 |
| バッジ表示 | 当日未記録時にアイコンにバッジ表示（Chrome/Edge） |

## ライセンス

Private

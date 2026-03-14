# SBPR - 血圧管理PWA

## コマンド

```bash
# テスト
npm test                          # Jest ユニットテスト + Puppeteer E2E（カバレッジ付き）
npm run test:pw                   # Playwright E2Eテスト
npm run screenshots               # スクリーンショット撮影

# ビルド・デプロイ
scripts/build.sh                  # Docker イメージビルド
scripts/rebuild.sh                # フルリビルド（ポート自動選択）
scripts/generate_version.sh       # version.js 生成 + sw.js CACHE_NAME 更新
scripts/build-docs.sh             # Markdown → HTML ドキュメント変換

# Docker Compose
docker compose up sbpr-app        # アプリ起動（内部のみ）
docker compose up sbpr-app-public # ブラウザアクセス用（ポート 8082）
docker compose run sbpr-test      # Jest + Puppeteer テスト実行
docker compose run sbpr-playwright # Playwright テスト実行
```

---

## プロジェクト構造

デプロイ先: Docker（nginx:alpine セルフホスト）/ Vercel（サーバーレス）の二系統。

sbpr/
├── local_app/              # フロントエンド（HTML/CSS/JS）
│   ├── index.html          # メインHTML
│   ├── script.js           # メインロジック（106KB）
│   ├── style.css           # スタイル
│   ├── bp.calc.js          # 血圧計算（純粋関数）
│   ├── bp.calc.test.js     # Jest ユニットテスト
│   ├── e2e.test.js         # E2Eテスト（Jest + Puppeteer、レガシー）
│   ├── sw.js               # Service Worker
│   ├── version.js          # ビルド時自動生成（手動編集不可）
│   ├── manifest.json       # PWA マニフェスト
│   ├── manual.html         # マニュアルページ
│   ├── notify.html         # 通知ページ
│   ├── promotion.html      # プロモーションページ
│   ├── usecases_showcase.html # ユースケースショーケースページ
│   ├── api/openai.js       # OpenAI APIクライアント
│   └── icons/              # PWAアイコン・スプラッシュ画像
├── tests/e2e/              # Playwright E2Eテスト（8 spec files）
├── tools/                  # ユーティリティ（スクリーンショット撮影等）
├── api/                    # Vercel Serverless Functions
├── scripts/                # ビルド・生成スクリプト
│   ├── build.sh            # Docker ビルド
│   ├── rebuild.sh          # フルリビルド
│   ├── generate_version.sh # version.js + sw.js CACHE_NAME 生成
│   ├── build-docs.sh       # ドキュメントビルド
│   ├── md-to-html.py       # Markdown → HTML 変換
│   └── generate_splash.py  # iOS PWA スプラッシュ画像生成
├── docs/                   # ドキュメント（設計書・マニュアル等）
├── nginx/                  # Nginx設定
├── Dockerfile              # 本番用（nginx:alpine）
├── Dockerfile.test         # テスト用（node + Puppeteer）
├── Dockerfile.playwright   # Playwright テスト用（node:18-bookworm）
├── docker-compose.yml      # Docker Compose（5サービス）
├── playwright.config.js    # Playwright設定（モバイルビューポート 390×844）
└── vercel.json             # Vercelデプロイ設定

---

## ワークフロー

- **[ドキュメント更新](docs/workflow-doc-update.md)** — UI変更時は manual / promotion / usecases_showcase の3ファイル更新 → スクショ再撮影 → HTML再生成

---

## 注意点・非自明なパターン

- **version.js / sw.js CACHE_NAME は自動生成** — `scripts/generate_version.sh` が `package.json` のバージョンとビルドハッシュから生成する。手動編集不可。
- **Docker Compose はワークツリー対応** — 環境変数（`COMPOSE_PROJECT_NAME`, `SBPR_SUBNET`, `SBPR_PORT`）でプロジェクト名・サブネットを分離。ワークツリー間の衝突を回避。
- **テストフレームワークが2系統** — `local_app/e2e.test.js`（Jest + Puppeteer、レガシー）と `tests/e2e/`（Playwright、現行）が共存。新規テストは Playwright で書く。
- **nginx が `/openai/` をプロキシ** — CORS 回避のため、同一オリジンの `/openai/*` を `api.openai.com` に転送。SSE ストリーミング対応（300秒タイムアウト）。

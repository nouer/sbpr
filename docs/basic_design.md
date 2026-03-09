# 基本設計書

## 1. アーキテクチャ概要

### 1.1 システム構成
* **フロントエンド**: HTML + vanilla JavaScript (SPA, ビルドツール不使用)
* **データストア**: ブラウザ IndexedDB
* **グラフ描画**: Chart.js (CDN)
* **デプロイ**: Docker (ローカル開発), Vercel (テスト配布)

### 1.2 ディレクトリ構成
```
sbpr/
├── local_app/           # アプリ本体
│   ├── index.html       # SPA エントリポイント
│   ├── style.css        # スタイルシート
│   ├── script.js        # メインロジック（UI制御・IndexedDB操作）
│   ├── bp.calc.js       # 血圧関連の計算ロジック（純粋関数）
│   ├── bp.calc.test.js  # 単体テスト
│   ├── e2e.test.js      # E2Eテスト
│   ├── sw.js            # Service Worker
│   ├── version.js       # ビルド時自動生成
│   ├── manifest.json    # PWA Web App Manifest
│   ├── api/
│   │   └── openai.js    # Vercel Serverless Function（OpenAI proxy）
│   └── icons/           # PWAアイコン（SVG）
├── api/                 # Vercel Functions（ルートレベル）
├── docs/                # ドキュメント
├── scripts/             # ビルドスクリプト
├── nginx/               # nginx設定
└── docker-compose.yml
```

## 2. データモデル

### 2.1 IndexedDB構成
* **データベース名**: `sbpr_db`
* **オブジェクトストア**: `bp_records`
* **キー**: `id` (UUID v4, auto-generated)

### 2.2 レコード構造
```json
{
  "id": "uuid-v4-string",
  "measuredAt": "2026-01-15T08:30:00.000Z",
  "systolic": 125,
  "diastolic": 82,
  "pulse": 72,
  "mood": 2,
  "condition": 2,
  "weight": 65.5,
  "memo": "朝食前に測定",
  "createdAt": "2026-01-15T08:31:00.000Z",
  "updatedAt": "2026-01-15T08:31:00.000Z"
}
```

* **noMedication**: （オプション）`true` のとき「服薬しなかった日」として扱う。この場合 systolic/diastolic は null。
* **mood**: 気分（1=悪い, 2=普通, 3=良い, null=未選択）
* **condition**: 体調（1=悪い, 2=普通, 3=良い, null=未選択）
* **weight**: 体重（kg, 20.0〜300.0, 小数点1桁まで, null=未選択）

## 3. 画面設計

### 3.1 画面一覧（タブ構成）
1. **記録タブ**: 血圧入力フォーム + 直近の記録一覧
2. **グラフタブ**: 血圧推移グラフ + 期間選択 + 表示モード切替
3. **履歴タブ**: 全記録一覧 + フィルタ・検索
4. **AI診断タブ**: AI健康アドバイス（API Key設定時のみ表示）
5. **設定タブ**: データ管理（エクスポート/インポート）+ プロフィール + AI設定 + エクスポートリマインダー

### 3.2 固定UI要素
* **左上: ページ先頭へ戻るボタン** (`position: fixed`): 上矢印SVGアイコン、クリックでスムーズスクロールによりページ先頭へ移動
* **右上: バージョン情報表示** (`position: fixed`): `Ver: X.X.X` と `Build: YYYY-MM-DD HH:MM:SS JST` を2行で表示（`version.js` から取得）
* 両要素とも `no-print` クラスにより印刷時は非表示

### 3.2 レスポンシブ対応
* モバイルファースト設計
* ブレークポイント: 768px (タブレット), 480px (スマートフォン)

## 4. 外部ライブラリ
* **Chart.js** (v4.x): グラフ描画 (CDN経由)
* **Chart.js date-fns adapter**: 日付軸対応

## 5. PWA構成

### 5.1 ファイル構成
* `manifest.json` - Web App Manifest（アプリ名、テーマカラー、アイコン定義）
* `sw.js` - Service Worker（アセットキャッシュ、オフライン対応）
* `icons/icon-192.svg` - アプリアイコン 192x192
* `icons/icon-512.svg` - アプリアイコン 512x512
* `icons/icon-maskable.svg` - マスカブルアイコン（セーフゾーン考慮）

### 5.2 Service Worker キャッシュ戦略
* **戦略**: Cache First + Network Fallback
* **プリキャッシュ対象**: index.html, style.css, script.js, bp.calc.js, version.js, manifest.json, アイコン(PNG), Chart.js CDN, chartjs-adapter-date-fns CDN
* **除外**: OpenAI API リクエスト（/openai/）
* **更新**: `CACHE_NAME` のバージョンを変更することでキャッシュを刷新

### 5.3 Badge API
* アプリ起動時、記録保存時、記録削除時にバッジ状態を更新
* 当日（ローカル日付）の記録が0件の場合、バッジに「1」を表示
* 記録が存在する場合、バッジをクリア
* Badge API非対応ブラウザでは何もしない

## 6. エクスポート/インポート

### 6.1 エクスポートデータ構造
* レコードデータ + メタ情報（バージョン、日時）
* プロフィール情報（生年月日、性別、身長）
* AI関連設定（備考、利用モデル）
* グラフ設定（日中/夜間の開始時刻）

### 6.2 インポート
* IDベースの重複排除によるマージ
* プロフィール・AI設定の復元

## 7. AI診断機能

### 7.1 概要
* OpenAI API を利用した健康アドバイス機能
* ユーザー自身のAPI Keyで利用（設定タブで入力）
* 複数モデル対応（gpt-4o-mini〜gpt-5.2）
* ストリーミング表示（SSE）
* 会話継続（チャット形式）+ 提案質問（サジェスト）

### 7.2 API通信
* 同一オリジンのリバースプロキシ経由で通信（CORS対策）
* ローカル: nginx、Vercel: rewrite + Serverless Function

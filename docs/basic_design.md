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
│   └── version.js       # ビルド時自動生成
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

* **mood**: 気分（1=悪い, 2=普通, 3=良い, null=未選択）
* **condition**: 体調（1=悪い, 2=普通, 3=良い, null=未選択）
* **weight**: 体重（kg, 20.0〜300.0, 小数点1桁まで, null=未選択）

## 3. 画面設計

### 3.1 画面一覧（タブ構成）
1. **記録タブ**: 血圧入力フォーム + 直近の記録一覧
2. **グラフタブ**: 血圧推移グラフ + 期間選択
3. **履歴タブ**: 全記録一覧 + フィルタ・検索
4. **設定タブ**: データ管理（エクスポート/インポート）+ バージョン情報

### 3.2 レスポンシブ対応
* モバイルファースト設計
* ブレークポイント: 768px (タブレット), 480px (スマートフォン)

## 4. 外部ライブラリ
* **Chart.js** (v4.x): グラフ描画 (CDN経由)
* **Chart.js date-fns adapter**: 日付軸対応

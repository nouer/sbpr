# 詳細設計書

## 1. IndexedDB操作

### 1.1 データベース初期化
```javascript
// DB名: sbpr_db, バージョン: 1
// オブジェクトストア: bp_records
//   keyPath: "id"
//   インデックス: measuredAt (unique: false)
```

### 1.2 CRUD操作
* **Create**: `addRecord(record)` - 新規レコード追加
* **Read**: `getAllRecords()` - 全件取得（measuredAt降順）
* **Read**: `getRecordsByDateRange(from, to)` - 期間指定取得
* **Update**: `updateRecord(record)` - 既存レコード更新
* **Delete**: `deleteRecord(id)` - 個別削除
* **Delete**: `deleteAllRecords()` - 全件削除

## 2. レコード構造とバリデーション

### 2.1 レコード構造の詳細
* **id**: UUID v4文字列（自動生成）
* **measuredAt**: ISO 8601形式の日時文字列
* **systolic**: 最高血圧（整数, 50〜300）
* **diastolic**: 最低血圧（整数, 30〜200）
* **pulse**: 脈拍数（整数, 30〜250, null可）
* **mood**: 気分（整数, 1=悪い, 2=普通, 3=良い, null=未選択）
* **condition**: 体調（整数, 1=悪い, 2=普通, 3=良い, null=未選択）
* **weight**: 体重（浮動小数点数, 20.0〜300.0, 小数点1桁まで, null=未選択）
* **memo**: メモ（文字列, null可）
* **createdAt**: 作成日時（ISO 8601形式）
* **updatedAt**: 更新日時（ISO 8601形式）

### 2.2 バリデーション仕様
* **systolic**: 50〜300の整数、かつ systolic > diastolic
* **diastolic**: 30〜200の整数
* **pulse**: 30〜250の整数（入力時のみ検証、null可）
* **weight**: 20.0〜300.0の浮動小数点数、小数点1桁まで（入力時のみ検証、null可）
* **mood**: 1, 2, 3, または null
* **condition**: 1, 2, 3, または null

## 3. 計算ロジック (bp.calc.js)

### 3.1 血圧分類
WHO/ISH基準に基づく血圧分類:
* 正常: 収縮期 < 120 かつ 拡張期 < 80
* 正常高値: 収縮期 120-129 かつ 拡張期 < 80
* 高値血圧: 収縮期 130-139 または 拡張期 80-89
* I度高血圧: 収縮期 140-159 または 拡張期 90-99
* II度高血圧: 収縮期 160-179 または 拡張期 100-109
* III度高血圧: 収縮期 >= 180 または 拡張期 >= 110

### 3.2 統計計算
* `calcAverage(records)` - 平均値算出
* `calcMinMax(records)` - 最大/最小値算出
* `classifyBP(systolic, diastolic)` - 血圧分類判定

## 4. エクスポート/インポート

### 4.1 エクスポート形式
```json
{
  "version": "1.0.0",
  "appName": "sbpr",
  "exportedAt": "2026-01-15T12:00:00.000Z",
  "recordCount": 100,
  "records": [ ... ],
  "profile": {
    "birthday": "1980-01-15",
    "gender": "male",
    "height": "170"
  },
  "aiMemo": "高血圧の家族歴あり。降圧剤を服用中。"
}
```

#### フィールド説明
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| version | string | 必須 | アプリバージョン |
| appName | string | 必須 | 固定値 "sbpr" |
| exportedAt | string | 必須 | エクスポート日時（ISO 8601） |
| recordCount | number | 必須 | レコード件数 |
| records | array | 必須 | 血圧記録の配列 |
| profile | object | 任意 | プロフィール情報（後方互換のため任意） |
| profile.birthday | string | 任意 | 生年月日（YYYY-MM-DD形式） |
| profile.gender | string | 任意 | 性別（"male" / "female" / "other" / ""） |
| profile.height | string | 任意 | 身長（cm） |
| aiMemo | string | 任意 | AIに伝えたい備考（後方互換のため任意） |

#### 後方互換性
* `profile` と `aiMemo` はオプショナルフィールド
* 旧バージョンのエクスポートファイル（`profile`/`aiMemo`なし）もインポート可能
* 旧バージョンのアプリでインポートしても `profile`/`aiMemo` は無視されるだけで動作に影響なし

### 4.2 インポート処理
1. ファイル読み込み (FileReader API)
2. JSON パース
3. バリデーション（形式チェック）
4. 既存データとのマージ（IDベースで重複排除）
5. IndexedDBに一括書き込み
6. `profile` が存在すればlocalStorageのプロフィール情報を上書き復元
7. `aiMemo` が存在すればlocalStorageのAI備考を上書き復元
8. 復元後、UIの入力フィールドに反映

## 5. グラフ描画

### 4.1 Chart.js設定
* タイプ: line
* データセット: 最高血圧(赤系), 最低血圧(青系), 脈拍(緑系)
* 基準線: annotation pluginで描画
* X軸: 時系列（date adapter使用）
* Y軸: mmHg / bpm

## 6. AI診断機能

### 6.1 API通信（OpenAI reverse proxy）

ブラウザから `api.openai.com` を直接呼び出すとCORSでブロックされるため、
同一オリジンのプロキシ経由で中継する。

#### 経路
| 環境 | クライアント → | → upstream |
|------|---------------|------------|
| ローカル (nginx) | `/openai/*` | `api.openai.com/*` |
| Vercel (rewrite + catch-all) | `/openai/:path*` → `/api/openai/:path*` | `api.openai.com/:path*` |

#### プロキシ実装
* **Vercel**: `api/openai/[...path].js`（catch-all API route）
  * Vercelのrewrite `/openai/:path*` → `/api/openai/:path*` で受け、パスセグメントを `req.query.path`（配列）から取得
* **ローカル参照**: `local_app/api/openai.js`（nginx環境では未使用。nginxが直接OpenAIへプロキシ）
* **OPTIONS preflight**: 204を返却（同一オリジンなら通常不要だが環境差を吸収）
* **バリデーション**: パスセグメントと `Authorization` ヘッダの欠落時は 400 を返却
* **リクエスト転送**: `req`（IncomingMessage）をそのまま `body` に渡し、`duplex: 'half'` で
  ストリームとして転送（`JSON.stringify` による再シリアライズは行わない）
* **ヘッダ転送**: クライアントの `authorization`, `content-type`, `accept` のみ上流へ転送
* **レスポンス転送**: `Readable.fromWeb(upstreamRes.body).pipe(res)` で
  Web ReadableStream → Node stream 変換し効率的にストリーミング転送
* **ステータス透過**: upstream の HTTP ステータスコードをそのまま返却
* **エラー処理**: upstream 接続失敗時は 502 (Bad Gateway) を返却

#### モデル
* gpt-4o-mini（コスト効率重視）

#### ストリーミング
* SSE（Server-Sent Events）でリアルタイム表示

### 5.2 プロンプト構築
```
システムプロンプト:
あなたは血圧管理の健康アドバイザーです。
ユーザーの血圧測定データに基づいて、わかりやすいアドバイスを提供してください。
医療行為ではなく、一般的な健康アドバイスとして回答してください。

ユーザープロンプト:
【血圧測定データ】
{記録データを日時順にフォーマット（日時、最高/最低血圧、脈拍、気分、体調、体重、メモ）}

【統計情報】
{平均値、最大/最小値、記録件数}

【ユーザー備考】
{設定の備考欄の内容}

上記のデータに基づいて、血圧の傾向分析と健康アドバイスをお願いします。
```

### 5.3 会話継続
* messages配列にassistant/userのロールで会話を蓄積
* 追加質問時は全履歴をコンテキストとして送信
* UIはチャット形式で表示

### 5.4 提案質問（サジェスト）機能
* AIレスポンスの末尾に `{{SUGGEST:質問テキスト}}` 形式で質問候補を3つ含める
* `parseSuggestions(content)` で本文と質問候補を分離
  * 戻り値: `{ mainContent: string, suggestions: string[] }`
* ストリーミング中は候補マーカーを非表示にし、完了後にボタンとして描画
* ボタンクリック時は `sendSuggestion(text)` で該当テキストをフォローアップ送信
* 会話復元時は最後のアシスタントメッセージから候補を再描画
* 新しいAI応答が生成されると前回の候補ボタンは消える

### 5.5 設定データ保存（localStorage）
* `sbpr_openai_api_key`: APIキー
* `sbpr_ai_memo`: AI向け備考

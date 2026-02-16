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

## 2. 計算ロジック (bp.calc.js)

### 2.1 血圧分類
WHO/ISH基準に基づく血圧分類:
* 正常: 収縮期 < 120 かつ 拡張期 < 80
* 正常高値: 収縮期 120-129 かつ 拡張期 < 80
* 高値血圧: 収縮期 130-139 または 拡張期 80-89
* I度高血圧: 収縮期 140-159 または 拡張期 90-99
* II度高血圧: 収縮期 160-179 または 拡張期 100-109
* III度高血圧: 収縮期 >= 180 または 拡張期 >= 110

### 2.2 統計計算
* `calcAverage(records)` - 平均値算出
* `calcMinMax(records)` - 最大/最小値算出
* `classifyBP(systolic, diastolic)` - 血圧分類判定

## 3. エクスポート/インポート

### 3.1 エクスポート形式
```json
{
  "version": "1.0.0",
  "appName": "sbpr",
  "exportedAt": "2026-01-15T12:00:00.000Z",
  "recordCount": 100,
  "records": [ ... ]
}
```

### 3.2 インポート処理
1. ファイル読み込み (FileReader API)
2. JSON パース
3. バリデーション（形式チェック）
4. 既存データとのマージ（IDベースで重複排除）
5. IndexedDBに一括書き込み

## 4. グラフ描画

### 4.1 Chart.js設定
* タイプ: line
* データセット: 最高血圧(赤系), 最低血圧(青系), 脈拍(緑系)
* 基準線: annotation pluginで描画
* X軸: 時系列（date adapter使用）
* Y軸: mmHg / bpm

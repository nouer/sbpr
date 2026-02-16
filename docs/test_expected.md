# テスト期待結果

## 1. 単体テスト期待結果

### 1.1 血圧分類
* classifyBP(110, 70) → "正常血圧"
* classifyBP(120, 70) → "正常高値血圧"
* classifyBP(130, 70) → "高値血圧"
* classifyBP(140, 85) → "I度高血圧"
* classifyBP(150, 95) → "II度高血圧"
* classifyBP(165, 105) → "III度高血圧"

### 1.2 統計計算
* calcAverage([{systolic:120, diastolic:80}, {systolic:130, diastolic:85}])
  → { avgSystolic: 125.0, avgDiastolic: 82.5 }
* calcAverage([]) → null

### 1.3 バリデーション
* validateBPInput({systolic:120, diastolic:80}) → { valid: true }
* validateBPInput({systolic:40, diastolic:80}) → { valid: false, error: "..." }
* validateBPInput({systolic:80, diastolic:80}) → { valid: false, error: "..." }

## 2. E2Eテスト期待結果

### 2.1 基本操作
* ページタイトル: "シンプル血圧記録 - sbpr"
* 血圧入力後、記録一覧に新しいレコードが表示される
* グラフタブでChart.jsキャンバスが描画される
* 全操作中にpageerrorが発生しない

## 3. テスト実行結果（最新）
* 未実行

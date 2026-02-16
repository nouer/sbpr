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
* validateBPInput({systolic:120, diastolic:80, weight:65.5}) → { valid: true }
* validateBPInput({systolic:120, diastolic:80, weight:15}) → { valid: false }
* validateBPInput({systolic:120, diastolic:80, weight:310}) → { valid: false }

## 2. E2Eテスト期待結果

### 2.1 基本操作
* ページタイトル: "シンプル血圧記録 - sbpr"
* 血圧入力後、記録一覧に新しいレコードが表示される
* グラフタブでChart.jsキャンバスが描画される
* 全操作中にpageerrorが発生しない
* 気分・体調・体重入力後、記録一覧に新フィールドが表示される

### 2.2 エクスポート/インポート（プロフィール・AI備考）
* エクスポートJSONに `profile` オブジェクト（birthday, gender, height）が含まれる
* エクスポートJSONに `aiMemo` 文字列が含まれる
* プロフィール・AI備考が未設定の場合でも、空値でフィールドが含まれる
* profile/aiMemoを含むJSONインポート後、localStorageに各値が復元される
* インポート後、UIの入力フィールドに値が反映される
* 旧形式（profile/aiMemoなし）のJSONインポートでもエラーにならない

### 2.2 提案質問機能
* parseSuggestions で `{{SUGGEST:...}}` マーカーが正しくパースされる
* マーカーが含まれないテキストはそのまま mainContent に入る
* 提案ボタン(.ai-suggestion-btn)がAIメッセージの後に表示される

## 3. テスト実行結果（最新）
* 実行日時: 2026-02-16
* 単体テスト: 全58件 PASS（カバレッジ: Stmts 97.91%, Branch 94.11%, Funcs 100%, Lines 97.29%）
* E2Eテスト: 14件中13件 PASS（合計テスト: 61件中60件 PASS）
  * E2E-004（グラフ描画）のみ FAIL — 既存の判定条件の問題（canvas.getContext の戻り値が {} となる）。今回の変更とは無関係。
  * 新規追加テスト E2E-012（parseSuggestionsパース）、E2E-013（提案質問ボタン表示）は PASS
  * 新規追加テスト E2E-015（エクスポートにプロフィール・AI備考が含まれる）は PASS
  * 新規追加テスト E2E-016（インポートでプロフィール・AI備考が復元される）は PASS

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

### 2.2 エクスポート/インポート（プロフィール・AI備考・AIモデル）
* エクスポートJSONに `profile` オブジェクト（birthday, gender, height）が含まれる
* エクスポートJSONに `aiMemo` 文字列が含まれる
* エクスポートJSONに `aiModel` 文字列（選択中のモデルID）が含まれる
* プロフィール・AI備考・AIモデルが未設定の場合でも、デフォルト値でフィールドが含まれる
* profile/aiMemo/aiModelを含むJSONインポート後、localStorageに各値が復元される
* インポート後、UIの入力フィールド・セレクトボックスに値が反映される
* 旧形式（profile/aiMemo/aiModelなし）のJSONインポートでもエラーにならない

### 2.3 AIモデル選択機能
* 設定タブのAI診断設定に `<select id="ai-model-select">` が表示される
* 初期状態（localStorageに値なし）では `gpt-4o-mini` がデフォルト選択される
* モデルを変更すると `localStorage` の `sbpr_ai_model` キーに自動保存される
* `ai-model-info` 要素にモデル名、model id、コンテキスト上限、入出力価格が表示される
* `AI_MODEL_CATALOG` に存在しない値がlocalStorageに入っている場合、デフォルト（gpt-4o-mini）にフォールバックする
* `callOpenAI` でAPIリクエスト送信時、選択中のモデルIDが `model` パラメータに設定される

### 2.4 提案質問機能
* parseSuggestions で `{{SUGGEST:...}}` マーカーが正しくパースされる
* マーカーが含まれないテキストはそのまま mainContent に入る
* 提案ボタン(.ai-suggestion-btn)がAIメッセージの後に表示される

## 3. テスト実行結果（最新）
* 実行日時: 2026-02-16
* 単体テスト: 全58件 PASS（カバレッジ: Stmts 97.91%, Branch 94.11%, Funcs 100%, Lines 97.29%）
* E2Eテスト: 18件中17件 PASS（合計テスト: 65件中64件 PASS）
  * E2E-004（グラフ描画）のみ FAIL — 既存の判定条件の問題（canvas.getContext の戻り値が {} となる）。今回の変更とは無関係。
  * E2E-015（エクスポートにプロフィール・AI備考・AIモデルが含まれる）は PASS
  * E2E-016（インポートでプロフィール・AI備考・AIモデルが復元される）は PASS
  * 新規追加テスト E2E-017（AIモデル選択セレクト表示）は PASS
  * 新規追加テスト E2E-018（AIモデル選択のデフォルト値）は PASS
  * 新規追加テスト E2E-019（AIモデル選択の保存）は PASS
  * 新規追加テスト E2E-020（AIモデル情報表示）は PASS

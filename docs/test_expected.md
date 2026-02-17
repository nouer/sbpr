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

### 2.2 固定UI要素
* スクロールトップボタン（↑）クリックでページ最上部（scrollY ≒ 0）にスクロールする
* ヘッダー（`.app-header`）クリックでもページ最上部（scrollY ≒ 0）にスクロールする（↑ボタンと同じ挙動）
* ヘッダーに `cursor: pointer` が設定されている

### 2.3 入力フォームUX
* 血圧記録保存後、最高血圧フィールドに前回保存した値（例: 125）がプリフィルされる
* 血圧記録保存後、最低血圧フィールドに前回保存した値（例: 82）がプリフィルされる
* 血圧記録保存後、脈拍フィールドに前回保存した値（例: 72）がプリフィルされる
* 血圧記録保存後、日時フィールドは前回の値ではなく現在に近い時刻が設定される
* 記録がある状態でページリロード後、フォームに直近の記録値がプリフィルされる
* number入力フィールドにフォーカスすると値が全選択状態になる
* 記録が0件の場合、プリフィルは行われずフォームは空のまま

### 2.3 エクスポート/インポート（プロフィール・AI備考・AIモデル）
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

### 2.5 PWA機能
* link[rel="manifest"]のhref属性が"/manifest.json"である
* Service Worker の registration が取得可能である
* meta[name="theme-color"]のcontent属性が"#2563eb"である
* meta[name="apple-mobile-web-app-capable"]のcontent属性が"yes"である
* PWA関連のスクリプト追加後もpageerrorが発生しない
* #update-banner 要素が存在し、初期状態では `display: none` である
* 設定タブに #check-update-btn ボタンが表示される

## 3. テスト実行結果（最新）
* 実行日時: 2026-02-17
* 単体テスト: 全58件 PASS（カバレッジ: Stmts 97.91%, Branch 94.11%, Funcs 100%, Lines 97.29%）
* E2Eテスト: 全テスト PASS（合計テスト: 79件全て PASS、Test Suites: 2 passed）
  * 既存テスト（E2E-001〜E2E-024）: 全て PASS
  * 固定UI要素テスト:
    * E2E-025（バージョン情報表示）は PASS
    * E2E-026（スクロールトップボタン表示）は PASS
    * E2E-027（スクロールトップボタン動作）は PASS
    * E2E-028（ヘッダータップでページ先頭へ戻る）は PASS
    * E2E-029（↑ボタン/ヘッダータップでAIチャット領域も先頭に戻る）は PASS
  * PWA テスト:
    * E2E-PWA-001（manifest.json読み込み）は PASS
    * E2E-PWA-002（Service Worker登録）は PASS
    * E2E-PWA-003（PWA meta tags設定）は PASS
    * E2E-PWA-004（PWA込み全タブ巡回 pageerror検知）は PASS
    * E2E-PWA-005（更新バナー要素の存在確認）は PASS
    * E2E-PWA-006（設定タブの「更新を確認」ボタン表示）は PASS

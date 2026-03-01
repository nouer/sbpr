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
* isBPRecord({systolic:120, diastolic:80}) → true
* isBPRecord({noMedication:true, systolic:null, diastolic:null}) → false
* isNoMedicationRecord({noMedication:true}) → true
* validateNoMedicationDate('2026-02-15') → { valid: true }
* validateNoMedicationDate('') → { valid: false }
* validateBPInput({systolic:40, diastolic:80}) → { valid: false, error: "..." }
* validateBPInput({systolic:80, diastolic:80}) → { valid: false, error: "..." }
* validateBPInput({systolic:120, diastolic:80, weight:65.5}) → { valid: true }
* validateBPInput({systolic:120, diastolic:80, weight:15}) → { valid: false }
* validateBPInput({systolic:120, diastolic:80, weight:310}) → { valid: false }

## 2. E2Eテスト期待結果

### 2.1 基本操作
* ページタイトル: "シンプル血圧記録 - sbpr"
* 血圧入力後、記録一覧に新しいレコードが表示される
* 記録保存成功時、「記録を保存」ボタン直下に「記録を保存しました」が表示され、ボタンが一時「保存しました」に変わる
* 服薬なしで保存成功時、「服薬なしで保存」ボタン直下に「服薬なしの記録を保存しました」が表示され、ボタンが一時「保存しました」に変わる
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

### 2.6 グラフ操作
* 連続モード・日中/夜間モード両方のChart.jsインスタンスに `onClick` ハンドラが設定されている
* キャンバス内の空白部分をタップするとツールチップが閉じる
* キャンバス外（他のUI要素）をタップするとツールチップが閉じる
* 日中・夜間モードに切り替えると `#chart-linestyle-toggle` が表示される
* 連続モードに切り替えると `#chart-linestyle-toggle` が非表示になる
* 線種トグルをクリックするとグラフが再描画され、JSエラーが発生しない
* トグルON時に `#linestyle-swapped` に `.active` クラスが付与される

### 2.7 AI診断期間選択
* AI診断タブに `#ai-period-controls` 内の4つのボタン（7日/30日/90日/全期間）が表示される
* デフォルトで7日ボタンに `.active` クラスが付与されている
* 30日ボタンをクリックすると、30日ボタンが `.active` になり7日ボタンの `.active` が外れる

## 3. テスト実行結果（最新）
* 実行日時: 2026-03-01
* 単体テスト: 全58件 PASS（カバレッジ: Stmts 98.13%, Branch 94.73%, Funcs 100%, Lines 97.64%）
* E2Eテスト: 95 passed, 1 failed（合計テスト: 96件、Test Suites: 1 failed, 1 passed）
  * 既存テスト（E2E-001〜E2E-029）: 全て PASS
  * グラフ操作テスト:
    * E2E-030（ツールチップの再タップ閉じ onClick定義確認）は PASS
    * E2E-031（日中/夜間モードで線種トグル表示）は PASS
    * E2E-032（連続モードで線種トグル非表示）は PASS
    * E2E-033（線種トグルでグラフ再描画 エラーなし）は PASS
  * AI診断期間選択テスト:
    * E2E-034（AI診断タブに期間選択ボタン表示）は PASS
    * E2E-035（AI診断の期間選択ボタン切替）は PASS
  * PWA テスト:
    * E2E-PWA-001（manifest.json読み込み）は PASS
    * E2E-PWA-002（Service Worker登録）は PASS
    * E2E-PWA-003（PWA meta tags設定）は FAIL（既存の不具合: apple-touch-iconのhref期待値が `.svg` だが実際は `.png`）
    * E2E-PWA-004（PWA込み全タブ巡回 pageerror検知）は PASS
    * E2E-PWA-005（更新バナー要素の存在確認）は PASS
    * E2E-PWA-006（設定タブの「更新を確認」ボタン表示）は PASS
    * E2E-PWA-007（設定タブの「強制更新」ボタン表示）は PASS

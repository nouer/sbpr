# ドキュメント更新ワークフロー

UI変更を伴う機能追加・変更時に実施する。

## 対象ファイル

| Markdown | 生成先HTML | 内容 |
|----------|-----------|------|
| `docs/manual.md` | `local_app/manual.html` | ユーザーマニュアル |
| `docs/promotion.md` | `local_app/promotion.html` | プロモーションページ |
| `docs/usecases_showcase.md` | `local_app/usecases_showcase.html` | ユースケースショーケース |

## 手順

### 1. Markdown 更新

3ファイル全てを確認し、変更に関連する記述を更新する。

### 2. スクリーンショット更新

画面項目が変わった場合は `tools/take_screenshots.js` でスクリーンショットを再撮影する。

```bash
docker compose run --rm sbpr-screenshots
```

- 出力先: `docs/images/` と `local_app/docs-images/`
- 撮影対象の追加・変更は `tools/take_screenshots.js` を編集

### 3. HTML 再生成

```bash
scripts/build-docs.sh
```

3ファイル全てのHTMLが再生成される。

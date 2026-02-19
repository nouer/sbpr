<p align="center">
  <img src="local_app/icons/icon-192.svg" alt="シンプル血圧記録" width="96">
</p>

<h1 align="center">シンプル血圧記録</h1>

<p align="center">
  <strong>毎日の血圧管理を、もっとシンプルに。</strong><br>
  アカウント不要。広告なし。データはあなたの端末だけに。
</p>

<p align="center">
  <a href="https://sbpr.nouer.net/">
    <img src="https://img.shields.io/badge/%E2%96%B6_%E4%BB%8A%E3%81%99%E3%81%90%E4%BD%BF%E3%81%A3%E3%81%A6%E3%81%BF%E3%82%8B-FF4081?style=for-the-badge&logoColor=white" alt="今すぐ使ってみる">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/費用-完全無料-00C853?style=flat-square" alt="完全無料">
  <img src="https://img.shields.io/badge/登録-不要-2196F3?style=flat-square" alt="登録不要">
  <img src="https://img.shields.io/badge/広告-なし-FF9800?style=flat-square" alt="広告なし">
  <img src="https://img.shields.io/badge/通信-なし-9C27B0?style=flat-square" alt="データ送信なし">
  <img src="https://img.shields.io/badge/対応-PWA_オフライン-607D8B?style=flat-square" alt="PWA対応">
</p>

<br>

<p align="center">
  <img src="docs/images/01_record_form.png" alt="記録画面" width="240">
  &nbsp;
  <img src="docs/images/03_chart_continuous.png" alt="グラフ画面" width="240">
  &nbsp;
  <img src="docs/images/04_chart_daynight.png" alt="日中・夜間グラフ" width="240">
  &nbsp;
  <img src="docs/images/06_history_tab.png" alt="履歴画面" width="240">
</p>

---

## 血圧管理、こんなお悩みありませんか？

> *「血圧手帳を忘れてしまう」「アプリは広告が邪魔」「個人の健康データをクラウドに預けるのが不安」*

**シンプル血圧記録**は、そんな悩みをすべて解決するために生まれた血圧管理Webアプリです。

ブラウザでURLを開くだけ。ダウンロードもアカウント登録も不要。あなたの血圧データは端末の中だけに保存され、外部に一切送信されません。

<p align="center">
  <a href="https://sbpr.nouer.net/"><strong>▶ https://sbpr.nouer.net/</strong></a>
</p>

---

## 選ばれる4つの理由

<table>
  <tr>
    <td width="25%" align="center"><h3>🔓</h3><strong>プライバシー最優先</strong><br><br>データは端末内（IndexedDB）にのみ保存。サーバーへの送信・トラッキングは一切なし。あなたの健康情報を安心して記録できます。</td>
    <td width="25%" align="center"><h3>⚡</h3><strong>3秒で記録開始</strong><br><br>URLを開けば即利用可能。アカウント登録・メール認証・アプリダウンロードすべて不要。前回値が自動入力されるので、変わった項目だけ修正するだけ。</td>
    <td width="25%" align="center"><h3>📊</h3><strong>一目でわかるグラフ</strong><br><br>血圧の推移を美しいグラフで可視化。日中・夜間の比較表示にも対応し、JSH2019基準線で自分の位置を直感的に把握できます。</td>
    <td width="25%" align="center"><h3>📱</h3><strong>どこでも使える</strong><br><br>スマホ・タブレット・PCすべてに対応。PWA対応でホーム画面に追加すれば、オフラインでもネイティブアプリのように動作します。</td>
  </tr>
</table>

---

## 主な機能

### 📝 かんたん血圧記録

血圧値を入力して保存するだけのシンプル操作。

- **最高血圧・最低血圧**（必須）+ **脈拍・体重・気分・体調・メモ**（任意）
- 前回の値が自動プリフィル — 変化した項目だけ修正すればOK
- 測定日時の変更も可能
- **JSH2019 家庭血圧基準**に基づき、血圧分類（正常血圧〜III度高血圧）を自動表示

<p align="center">
  <img src="docs/images/02_record_recent.png" alt="直近の記録" width="300">
</p>

---

### 📊 見やすいグラフ & 統計

血圧の推移を折れ線グラフで確認。**7日・30日・90日・全期間**で切り替えられます。

<p align="center">
  <img src="docs/images/03_chart_continuous.png" alt="連続グラフ" width="280">
  &nbsp;&nbsp;
  <img src="docs/images/04_chart_daynight.png" alt="日中・夜間グラフ" width="280">
  &nbsp;&nbsp;
  <img src="docs/images/05_chart_stats.png" alt="統計情報" width="280">
</p>

| モード | 特徴 |
|--------|------|
| **連続表示** | 全データを1本の線で時系列表示 |
| **日中・夜間** | 時間帯ごとに色分け表示。区切り時間はカスタマイズ可能 |

家庭血圧の基準線（135/85 mmHg）が常にグラフ上に表示されるので、自分の血圧レベルを直感的に把握できます。選択期間の**平均血圧・平均脈拍・記録数**も自動計算されます。

---

### 🤖 AI健康アドバイス（オプション）

OpenAI APIキーを設定すると、あなたの血圧データに基づいた**パーソナライズされた健康アドバイス**を受けられます。

- 血圧の傾向分析と生活改善のヒント
- チャット形式で気になることを追加質問
- 服薬情報などのメモを加味した分析

<p align="center">
  <img src="docs/images/10_settings_ai.png" alt="AI設定" width="300">
</p>

> ※ AI診断は医療行為ではありません。参考情報としてご活用ください。

---

### 📱 PWA対応 — ネイティブアプリのように使える

ホーム画面に追加すれば、まるでインストールしたアプリのように使えます。

| 機能 | 説明 |
|------|------|
| **完全オフライン動作** | インターネット接続なしでも記録・閲覧可能 |
| **ホーム画面アイコン** | ワンタップで起動 |
| **バッジ通知** | 当日未記録の場合にアイコンにバッジ表示（Chrome/Edge） |
| **自動更新通知** | 新バージョンが利用可能になると自動でお知らせ |

---

### 💾 データバックアップ & 移行

JSON形式でエクスポート/インポートに対応。端末の買い替え時もデータを簡単に引き継げます。

<p align="center">
  <img src="docs/images/07_settings_data.png" alt="データ管理" width="300">
</p>

---

### ✏️ 記録の編集・削除

過去の記録はいつでも修正・削除可能。履歴タブでは日付フィルタで期間を絞り込めます。

<p align="center">
  <img src="docs/images/11_edit_dialog.png" alt="編集画面" width="300">
</p>

---

## 使い方 — たった3ステップ

<table>
  <tr>
    <td align="center" width="33%">
      <h3>Step 1</h3>
      <strong>アクセス</strong><br><br>
      ブラウザで<a href="https://sbpr.nouer.net/">sbpr.nouer.net</a>を開く。<br>アカウント登録は不要です。
    </td>
    <td align="center" width="33%">
      <h3>Step 2</h3>
      <strong>記録する</strong><br><br>
      血圧値を入力して<br>「記録を保存」をタップ。
    </td>
    <td align="center" width="33%">
      <h3>Step 3</h3>
      <strong>振り返る</strong><br><br>
      グラフで推移を確認。<br>統計情報で平均値をチェック。
    </td>
  </tr>
</table>

<br>

> **ホーム画面に追加するには:**
> - **iPhone** — Safari → 共有ボタン → 「ホーム画面に追加」
> - **Android** — Chrome → メニュー → 「ホーム画面に追加」

---

## プライバシーポリシー

| 項目 | 内容 |
|------|------|
| **データ保存先** | 端末内のブラウザ（IndexedDB） |
| **サーバーへの送信** | 一切なし *（AI機能利用時のみOpenAI APIへ送信）* |
| **アカウント** | 不要 |
| **トラッキング・解析** | なし |
| **広告** | なし |
| **Cookie** | 使用しません |

**あなたの健康データは、あなたの端末だけにあります。**

---

## 対応環境

| ブラウザ | 対応状況 |
|----------|----------|
| Chrome（Android / PC） | ✅ 全機能対応 |
| Safari（iPhone / iPad） | ✅ 全機能対応 |
| Edge（PC） | ✅ 全機能対応 |
| Firefox | ✅ 対応（一部PWA機能を除く） |

---

## 技術仕様

軽量・高速を追求した、フレームワーク不使用のピュアWeb技術スタック。

| レイヤー | 技術 |
|----------|------|
| フロントエンド | HTML + Vanilla JavaScript（SPA） |
| スタイル | Pure CSS（ビルドツール不使用） |
| データストア | IndexedDB |
| グラフ描画 | [Chart.js](https://www.chartjs.org/) v4 |
| PWA | Web App Manifest + Service Worker |
| テスト | Jest + Puppeteer（E2E） |
| コンテナ | Docker（nginx:alpine） |
| デプロイ | Vercel |

<details>
<summary><strong>開発者向け: ローカル環境構築</strong></summary>

```bash
# Docker でビルド & 起動
./scripts/build.sh

# ブラウザで http://localhost:8082 にアクセス
```

```bash
# テスト実行
docker compose run --rm sbpr-test npm test
```

</details>

---

## ドキュメント

- [ユーザーマニュアル](docs/manual.md) — 全機能の操作ガイド（スクリーンショット付き）
- [要件定義書](docs/requirements_definition.md)
- [基本設計書](docs/basic_design.md)
- [詳細設計書](docs/detailed_design.md)
- [テスト仕様書](docs/test_specification.md)

---

<p align="center">
  <br>
  <a href="https://sbpr.nouer.net/">
    <img src="https://img.shields.io/badge/%F0%9F%92%93_%E3%82%B7%E3%83%B3%E3%83%97%E3%83%AB%E8%A1%80%E5%9C%A7%E8%A8%98%E9%8C%B2%E3%82%92%E4%BD%BF%E3%81%A3%E3%81%A6%E3%81%BF%E3%82%8B-FF4081?style=for-the-badge&logoColor=white" alt="シンプル血圧記録を使ってみる">
  </a>
  <br><br>
  <strong>毎日の血圧管理を、もっとシンプルに。</strong><br>
  <sub>完全無料 / 登録不要 / プライバシー重視</sub>
</p>

# アルゴリズム・ロジック仕様

## 1. 血圧分類アルゴリズム

### 1.1 分類基準（家庭血圧基準: JSH2019準拠）
| 分類 | 収縮期血圧 (mmHg) | 拡張期血圧 (mmHg) |
|------|-------------------|-------------------|
| 正常血圧 | < 115 | かつ < 75 |
| 正常高値血圧 | 115-124 | かつ < 75 |
| 高値血圧 | 125-134 | または 75-84 |
| I度高血圧 | 135-144 | または 85-89 |
| II度高血圧 | 145-159 | または 90-99 |
| III度高血圧 | ≥ 160 | または ≥ 100 |

※ 家庭血圧基準を採用（診察室血圧より5mmHg低い基準）

### 1.2 判定ロジック
```
function classifyBP(systolic, diastolic):
    if systolic >= 160 or diastolic >= 100: return "III度高血圧"
    if systolic >= 145 or diastolic >= 90:  return "II度高血圧"
    if systolic >= 135 or diastolic >= 85:  return "I度高血圧"
    if systolic >= 125 or diastolic >= 75:  return "高値血圧"
    if systolic >= 115:                      return "正常高値血圧"
    return "正常血圧"
```

### 1.3 CSSクラスマッピング
`classifyBPClass(classification)` により、分類名に対応するCSSクラス名を返す。

| 分類 | CSSクラス |
|------|-----------|
| 正常血圧 | `bp-normal` |
| 正常高値血圧 | `bp-elevated` |
| 高値血圧 | `bp-high-normal` |
| I度高血圧 | `bp-grade1` |
| II度高血圧 | `bp-grade2` |
| III度高血圧 | `bp-grade3` |

未知の分類の場合は `bp-normal` にフォールバック。

## 2. 統計計算アルゴリズム

### 2.1 平均値計算（`calcAverage`）
* 収縮期・拡張期・脈拍の算術平均を計算
* 小数点第1位で四捨五入（`Math.round(value * 10) / 10`）
* 脈拍は `pulse != null` のレコードのみで平均を算出（脈拍未入力のレコードは除外）
* レコードが0件の場合は `null` を返す
* 戻り値: `{ avgSystolic, avgDiastolic, avgPulse }`（`avgPulse` は脈拍データがない場合 `null`）

### 2.2 最大/最小値計算（`calcMinMax`）
* 収縮期・拡張期・脈拍の最大値・最小値を計算
* 脈拍は `pulse != null` のレコードのみを対象
* レコードが0件の場合は `null` を返す
* 戻り値: `{ maxSystolic, minSystolic, maxDiastolic, minDiastolic, maxPulse, minPulse }`（脈拍データがない場合 `maxPulse`/`minPulse` は `null`）

### 2.3 脈圧（参考情報）
* 脈圧 = 収縮期血圧 - 拡張期血圧
* 正常範囲: 40〜60 mmHg

※ 現在の実装では脈圧を計算する独立した関数は存在しない。医学的な参考情報として記載。

## 3. バリデーション

### 3.1 血圧入力バリデーション（`validateBPInput`）
入力オブジェクト `{ systolic, diastolic, pulse?, weight? }` を検証し、`{ valid: boolean, errors: string[] }` を返す。

#### バリデーションルール
| フィールド | 必須 | 型 | 範囲 | エラーメッセージ |
|-----------|------|-----|------|-----------------|
| systolic（最高血圧） | 必須 | 整数 | 50〜300 | 「最高血圧は50〜300の整数で入力してください」 |
| diastolic（最低血圧） | 必須 | 整数 | 30〜200 | 「最低血圧は30〜200の整数で入力してください」 |
| pulse（脈拍） | 任意 | 整数 | 30〜250 | 「脈拍は30〜250の整数で入力してください」 |
| weight（体重） | 任意 | 数値 | 20〜300 | 「体重は20〜300kgの範囲で入力してください」 |

#### 相関チェック
* 個別フィールドのエラーがない場合のみ実行
* `systolic <= diastolic` の場合エラー: 「最高血圧は最低血圧より大きい値にしてください」

### 3.2 服薬なし記録の日付バリデーション（`validateNoMedicationDate`）
* 日付文字列が空または未指定の場合エラー
* `new Date(dateStr)` で無効な日付の場合エラー
* 戻り値: `{ valid: boolean, errors: string[] }`

## 4. レコード種別判定

### 4.1 血圧記録判定（`isBPRecord`）
グラフ・統計の対象となる血圧記録かどうかを判定する。

```
function isBPRecord(r):
    return r != null
       AND r.noMedication != true
       AND r.systolic != null
       AND r.diastolic != null
```

### 4.2 服薬なし記録判定（`isNoMedicationRecord`）
服薬しなかった日の記録かどうかを判定する。

```
function isNoMedicationRecord(r):
    return r != null AND r.noMedication === true
```

## 5. 日中/夜間判定

### 5.1 時間帯設定
* `getDayStartHour()`: 日中の開始時刻。localStorage に保存。デフォルト: **6時**。範囲: 0〜23。
* `getNightStartHour()`: 夜間の開始時刻。localStorage に保存。デフォルト: **18時**。範囲: 0〜23。

### 5.2 判定ロジック（`isDaytime`）
```
function isDaytime(dateStr):
    hour = dateStr の時刻（0〜23）
    dayStart = getDayStartHour()
    nightStart = getNightStartHour()

    if dayStart < nightStart:
        return hour >= dayStart AND hour < nightStart
    else:
        // dayStart >= nightStart（日付をまたぐケース）
        return hour >= dayStart OR hour < nightStart
```

`dayStart < nightStart` の通常ケース（例: 6時〜18時）と、`dayStart >= nightStart` の日付またぎケース（例: 22時〜6時）の両方に対応。

## 6. ユーティリティ

### 6.1 UUID生成（`generateId`）
* `crypto.randomUUID()` を使用（対応ブラウザ）
* フォールバック: `Math.random()` ベースのUUID v4生成

### 6.2 日時フォーマット
* `formatDateTime(dateStr)`: `YYYY/MM/DD HH:MM` 形式に変換。無効な日時は `'---'` を返す。
* `formatDateTimeLocal(date)`: `YYYY-MM-DDTHH:MM` 形式に変換（`input[type=datetime-local]` 用）。

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

## 2. 統計計算アルゴリズム

### 2.1 平均値計算
* 算術平均を使用
* 小数点第1位で四捨五入

### 2.2 脈圧計算
* 脈圧 = 収縮期血圧 - 拡張期血圧
* 正常範囲: 40〜60 mmHg

## 3. UUID生成
* crypto.randomUUID() を使用（対応ブラウザ）
* フォールバック: Math.random() ベースのUUID v4生成

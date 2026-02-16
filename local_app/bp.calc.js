/**
 * bp.calc.js - 血圧関連の計算ロジック（純粋関数）
 * テスト可能な純粋関数として分離
 */

/**
 * 血圧分類（家庭血圧基準: JSH2019準拠）
 * @param {number} systolic - 収縮期血圧 (mmHg)
 * @param {number} diastolic - 拡張期血圧 (mmHg)
 * @returns {string} 血圧分類名
 */
function classifyBP(systolic, diastolic) {
    if (systolic >= 160 || diastolic >= 100) return 'III度高血圧';
    if (systolic >= 145 || diastolic >= 90) return 'II度高血圧';
    if (systolic >= 135 || diastolic >= 85) return 'I度高血圧';
    if (systolic >= 125 || diastolic >= 75) return '高値血圧';
    if (systolic >= 115) return '正常高値血圧';
    return '正常血圧';
}

/**
 * 血圧分類に対応するCSSクラス名を返す
 * @param {string} classification - classifyBP の戻り値
 * @returns {string} CSSクラス名
 */
function classifyBPClass(classification) {
    const map = {
        '正常血圧': 'bp-normal',
        '正常高値血圧': 'bp-elevated',
        '高値血圧': 'bp-high-normal',
        'I度高血圧': 'bp-grade1',
        'II度高血圧': 'bp-grade2',
        'III度高血圧': 'bp-grade3'
    };
    return map[classification] || 'bp-normal';
}

/**
 * 血圧入力のバリデーション
 * @param {object} input - { systolic, diastolic, pulse? }
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateBPInput(input) {
    const errors = [];
    const { systolic, diastolic, pulse } = input;

    if (systolic == null || systolic === '') {
        errors.push('最高血圧を入力してください');
    } else {
        const sys = Number(systolic);
        if (!Number.isInteger(sys) || sys < 50 || sys > 300) {
            errors.push('最高血圧は50〜300の整数で入力してください');
        }
    }

    if (diastolic == null || diastolic === '') {
        errors.push('最低血圧を入力してください');
    } else {
        const dia = Number(diastolic);
        if (!Number.isInteger(dia) || dia < 30 || dia > 200) {
            errors.push('最低血圧は30〜200の整数で入力してください');
        }
    }

    if (pulse != null && pulse !== '') {
        const p = Number(pulse);
        if (!Number.isInteger(p) || p < 30 || p > 250) {
            errors.push('脈拍は30〜250の整数で入力してください');
        }
    }

    const weight = input.weight;
    if (weight != null && weight !== '') {
        const w = Number(weight);
        if (isNaN(w) || w < 20 || w > 300) {
            errors.push('体重は20〜300kgの範囲で入力してください');
        }
    }

    if (errors.length === 0) {
        const sys = Number(systolic);
        const dia = Number(diastolic);
        if (sys <= dia) {
            errors.push('最高血圧は最低血圧より大きい値にしてください');
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * レコード配列から平均値を計算
 * @param {Array} records - { systolic, diastolic, pulse? } の配列
 * @returns {object|null} { avgSystolic, avgDiastolic, avgPulse } or null
 */
function calcAverage(records) {
    if (!records || records.length === 0) return null;

    let sumSys = 0, sumDia = 0, sumPulse = 0, pulseCount = 0;
    for (const r of records) {
        sumSys += r.systolic;
        sumDia += r.diastolic;
        if (r.pulse != null) {
            sumPulse += r.pulse;
            pulseCount++;
        }
    }
    const n = records.length;
    return {
        avgSystolic: Math.round(sumSys / n * 10) / 10,
        avgDiastolic: Math.round(sumDia / n * 10) / 10,
        avgPulse: pulseCount > 0 ? Math.round(sumPulse / pulseCount * 10) / 10 : null
    };
}

/**
 * レコード配列から最大/最小値を計算
 * @param {Array} records - { systolic, diastolic, pulse? } の配列
 * @returns {object|null}
 */
function calcMinMax(records) {
    if (!records || records.length === 0) return null;

    let maxSys = -Infinity, minSys = Infinity;
    let maxDia = -Infinity, minDia = Infinity;
    let maxPulse = -Infinity, minPulse = Infinity;
    let hasPulse = false;

    for (const r of records) {
        if (r.systolic > maxSys) maxSys = r.systolic;
        if (r.systolic < minSys) minSys = r.systolic;
        if (r.diastolic > maxDia) maxDia = r.diastolic;
        if (r.diastolic < minDia) minDia = r.diastolic;
        if (r.pulse != null) {
            hasPulse = true;
            if (r.pulse > maxPulse) maxPulse = r.pulse;
            if (r.pulse < minPulse) minPulse = r.pulse;
        }
    }

    return {
        maxSystolic: maxSys,
        minSystolic: minSys,
        maxDiastolic: maxDia,
        minDiastolic: minDia,
        maxPulse: hasPulse ? maxPulse : null,
        minPulse: hasPulse ? minPulse : null
    };
}

/**
 * UUID v4 生成
 * @returns {string}
 */
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 日時を "YYYY/MM/DD HH:MM" 形式にフォーマット
 * @param {string|Date} dateStr
 * @returns {string}
 */
function formatDateTime(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '---';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 日時を "YYYY-MM-DDTHH:MM" 形式にフォーマット（input[type=datetime-local]用）
 * @param {Date} date
 * @returns {string}
 */
function formatDateTimeLocal(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Node.js 環境（テスト用）でのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        classifyBP,
        classifyBPClass,
        validateBPInput,
        calcAverage,
        calcMinMax,
        generateId,
        formatDateTime,
        formatDateTimeLocal
    };
}

/**
 * bp.calc.test.js - 血圧計算ロジックの単体テスト
 */
const {
    classifyBP,
    classifyBPClass,
    validateBPInput,
    calcAverage,
    calcMinMax,
    generateId,
    formatDateTime,
    formatDateTimeLocal
} = require('./bp.calc.js');

describe('classifyBP - 血圧分類', () => {
    test('UT-001: 正常血圧の判定 (sys=110, dia=70)', () => {
        expect(classifyBP(110, 70)).toBe('正常血圧');
    });

    test('UT-002: 正常高値血圧の判定 (sys=120, dia=70)', () => {
        expect(classifyBP(120, 70)).toBe('正常高値血圧');
    });

    test('UT-003: 高値血圧の判定 - 収縮期 (sys=130, dia=70)', () => {
        expect(classifyBP(130, 70)).toBe('高値血圧');
    });

    test('UT-004: 高値血圧の判定 - 拡張期 (sys=110, dia=80)', () => {
        expect(classifyBP(110, 80)).toBe('高値血圧');
    });

    test('UT-005: I度高血圧の判定 (sys=140, dia=85)', () => {
        expect(classifyBP(140, 85)).toBe('I度高血圧');
    });

    test('UT-006: II度高血圧の判定 (sys=150, dia=95)', () => {
        expect(classifyBP(150, 95)).toBe('II度高血圧');
    });

    test('UT-007: III度高血圧の判定 (sys=165, dia=105)', () => {
        expect(classifyBP(165, 105)).toBe('III度高血圧');
    });

    test('境界値: 収縮期115の場合は正常高値血圧', () => {
        expect(classifyBP(115, 70)).toBe('正常高値血圧');
    });

    test('境界値: 収縮期114, 拡張期74は正常血圧', () => {
        expect(classifyBP(114, 74)).toBe('正常血圧');
    });

    test('境界値: 拡張期75は高値血圧', () => {
        expect(classifyBP(110, 75)).toBe('高値血圧');
    });

    test('境界値: 収縮期135はI度高血圧', () => {
        expect(classifyBP(135, 70)).toBe('I度高血圧');
    });

    test('境界値: 収縮期160はIII度高血圧', () => {
        expect(classifyBP(160, 70)).toBe('III度高血圧');
    });
});

describe('classifyBPClass - CSSクラス名', () => {
    test('正常血圧のクラス名', () => {
        expect(classifyBPClass('正常血圧')).toBe('bp-normal');
    });

    test('III度高血圧のクラス名', () => {
        expect(classifyBPClass('III度高血圧')).toBe('bp-grade3');
    });

    test('不明な分類はbp-normalを返す', () => {
        expect(classifyBPClass('不明')).toBe('bp-normal');
    });
});

describe('validateBPInput - バリデーション', () => {
    test('UT-020: 正常な入力', () => {
        const result = validateBPInput({ systolic: 120, diastolic: 80 });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('UT-020b: 脈拍付きの正常な入力', () => {
        const result = validateBPInput({ systolic: 120, diastolic: 80, pulse: 72 });
        expect(result.valid).toBe(true);
    });

    test('UT-021: 収縮期が範囲外（低）', () => {
        const result = validateBPInput({ systolic: 40, diastolic: 80 });
        expect(result.valid).toBe(false);
    });

    test('UT-022: 収縮期が範囲外（高）', () => {
        const result = validateBPInput({ systolic: 310, diastolic: 80 });
        expect(result.valid).toBe(false);
    });

    test('UT-023: 収縮期 <= 拡張期', () => {
        const result = validateBPInput({ systolic: 80, diastolic: 80 });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('最高血圧は最低血圧より'))).toBe(true);
    });

    test('UT-024: 脈拍が範囲外（低）', () => {
        const result = validateBPInput({ systolic: 120, diastolic: 80, pulse: 20 });
        expect(result.valid).toBe(false);
    });

    test('脈拍が範囲外（高）', () => {
        const result = validateBPInput({ systolic: 120, diastolic: 80, pulse: 260 });
        expect(result.valid).toBe(false);
    });

    test('収縮期が未入力', () => {
        const result = validateBPInput({ systolic: null, diastolic: 80 });
        expect(result.valid).toBe(false);
    });

    test('拡張期が未入力', () => {
        const result = validateBPInput({ systolic: 120, diastolic: '' });
        expect(result.valid).toBe(false);
    });

    test('脈拍が未入力（任意なのでvalid）', () => {
        const result = validateBPInput({ systolic: 120, diastolic: 80, pulse: null });
        expect(result.valid).toBe(true);
    });
});

describe('calcAverage - 平均値計算', () => {
    test('UT-010: 2件の平均値', () => {
        const records = [
            { systolic: 120, diastolic: 80 },
            { systolic: 130, diastolic: 85 }
        ];
        const result = calcAverage(records);
        expect(result.avgSystolic).toBe(125);
        expect(result.avgDiastolic).toBe(82.5);
    });

    test('UT-012: 空配列の場合はnull', () => {
        expect(calcAverage([])).toBeNull();
    });

    test('nullの場合もnull', () => {
        expect(calcAverage(null)).toBeNull();
    });

    test('脈拍ありの平均値', () => {
        const records = [
            { systolic: 120, diastolic: 80, pulse: 70 },
            { systolic: 130, diastolic: 85, pulse: 80 }
        ];
        const result = calcAverage(records);
        expect(result.avgPulse).toBe(75);
    });

    test('脈拍が一部nullの場合', () => {
        const records = [
            { systolic: 120, diastolic: 80, pulse: 70 },
            { systolic: 130, diastolic: 85, pulse: null }
        ];
        const result = calcAverage(records);
        expect(result.avgPulse).toBe(70);
    });

    test('脈拍が全てnullの場合', () => {
        const records = [
            { systolic: 120, diastolic: 80 },
            { systolic: 130, diastolic: 85 }
        ];
        const result = calcAverage(records);
        expect(result.avgPulse).toBeNull();
    });
});

describe('calcMinMax - 最大/最小値', () => {
    test('UT-011: 2件の最大/最小値', () => {
        const records = [
            { systolic: 120, diastolic: 80 },
            { systolic: 140, diastolic: 90 }
        ];
        const result = calcMinMax(records);
        expect(result.maxSystolic).toBe(140);
        expect(result.minSystolic).toBe(120);
        expect(result.maxDiastolic).toBe(90);
        expect(result.minDiastolic).toBe(80);
    });

    test('空配列の場合はnull', () => {
        expect(calcMinMax([])).toBeNull();
    });

    test('脈拍付きの最大/最小値', () => {
        const records = [
            { systolic: 120, diastolic: 80, pulse: 70 },
            { systolic: 140, diastolic: 90, pulse: 85 }
        ];
        const result = calcMinMax(records);
        expect(result.maxPulse).toBe(85);
        expect(result.minPulse).toBe(70);
    });

    test('脈拍なしの場合はnull', () => {
        const records = [
            { systolic: 120, diastolic: 80 },
            { systolic: 140, diastolic: 90 }
        ];
        const result = calcMinMax(records);
        expect(result.maxPulse).toBeNull();
        expect(result.minPulse).toBeNull();
    });
});

describe('generateId - UUID生成', () => {
    test('UUIDが生成される', () => {
        const id = generateId();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    test('2回生成したIDは異なる', () => {
        const id1 = generateId();
        const id2 = generateId();
        expect(id1).not.toBe(id2);
    });
});

describe('formatDateTime - 日時フォーマット', () => {
    test('正常な日時をフォーマット', () => {
        const result = formatDateTime('2026-01-15T08:05:00');
        expect(result).toBe('2026/01/15 08:05');
    });

    test('不正な日時は---を返す', () => {
        expect(formatDateTime('invalid')).toBe('---');
    });
});

describe('formatDateTimeLocal - input用日時フォーマット', () => {
    test('Dateオブジェクトをフォーマット', () => {
        const d = new Date(2026, 0, 15, 8, 5);
        const result = formatDateTimeLocal(d);
        expect(result).toBe('2026-01-15T08:05');
    });
});

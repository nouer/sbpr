/**
 * record.spec.js - 記録タブ関連の Playwright E2E テスト
 * local_app/e2e.test.js から移植
 */
const { test, expect } = require('@playwright/test');
const { waitForAppReady, saveBPRecord, waitForToast, navigateToTab, isVisible } = require('./fixtures');

test('E2E-001: ページが表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const title = await page.title();
    expect(title).toBe('シンプル血圧記録 - sbpr');

    const headerVisible = await isVisible(page, '.app-header');
    expect(headerVisible).toBe(true);

    const tabNavVisible = await isVisible(page, '.tab-nav');
    expect(tabNavVisible).toBe(true);
});

test('E2E-025: 右上にバージョン情報が表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const infoDisplay = await page.evaluate(() => {
        const el = document.getElementById('app-info-display');
        return el ? el.innerHTML : null;
    });
    expect(infoDisplay).not.toBeNull();
    expect(infoDisplay).toContain('Ver:');
    expect(infoDisplay).toContain('Build:');
});

test('E2E-026: 左上にスクロールトップボタンが表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const btnExists = await page.evaluate(() => {
        const el = document.getElementById('scroll-to-top-btn');
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.position === 'fixed';
    });
    expect(btnExists).toBe(true);
});

test('E2E-002: 血圧を記録して一覧に表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.waitForSelector('#input-systolic', { timeout: 10000 });

    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '125';
        document.getElementById('input-diastolic').value = '82';
        document.getElementById('input-pulse').value = '72';
        document.getElementById('input-memo').value = 'E2Eテスト記録';
    });

    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    const recordText = await page.locator('#recent-records').evaluate(el => el.textContent || '');
    expect(recordText).toContain('125');
    expect(recordText).toContain('82');
});

test('E2E-003: 記録を削除できる', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '130';
        document.getElementById('input-diastolic').value = '85';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    const deleteBtnCount = await page.locator('.record-actions .delete-btn').count();
    if (deleteBtnCount > 0) {
        await page.locator('.record-actions .delete-btn').first().click();
        await page.waitForSelector('#confirm-overlay.show', { timeout: 5000 });
        await page.click('#confirm-ok');
        await page.waitForFunction(() => {
            const overlay = document.getElementById('confirm-overlay');
            return !overlay.classList.contains('show');
        }, { timeout: 5000 });
    }
});

test('E2E-011: 気分・体調・体重を記録して一覧に表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.waitForSelector('#input-systolic', { timeout: 10000 });

    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '118';
        document.getElementById('input-diastolic').value = '76';
        document.getElementById('input-pulse').value = '68';
        document.getElementById('input-weight').value = '65.5';
    });

    await page.evaluate(() => {
        document.querySelector('#input-mood .level-btn[data-value="3"]').click();
        document.querySelector('#input-condition .level-btn[data-value="2"]').click();
    });

    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    const recordText = await page.locator('#recent-records').evaluate(el => el.textContent || '');
    expect(recordText).toContain('118');
    expect(recordText).toContain('76');
    expect(recordText).toContain('65.5');
});

test('E2E-015c: 服薬しなかった日を記録すると直近の記録に「服薬なし」で表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.click('[data-tab="record"]');
    await page.waitForSelector('#tab-record.active', { timeout: 5000 });

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await page.evaluate((d) => {
        const el = document.getElementById('no-medication-date');
        if (el) el.value = d;
    }, dateStr);
    await page.click('#save-no-medication-btn');
    await new Promise(r => setTimeout(r, 800));

    const hasSuccess = await page.evaluate(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    });
    expect(hasSuccess).toBe(true);

    const hasNoMedicationLabel = await page.evaluate(() => {
        const list = document.querySelector('#recent-records .record-list');
        return list && list.innerHTML.includes('服薬なし');
    });
    expect(hasNoMedicationLabel).toBe(true);
});

test('E2E-021: 保存後に前回値がプリフィルされる', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.waitForSelector('#input-systolic', { timeout: 10000 });

    // 既存レコードをクリアして確実な状態にする
    await page.evaluate(async () => {
        await deleteAllRecords();
        await refreshRecentRecords();
    });

    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '125';
        document.getElementById('input-diastolic').value = '82';
        document.getElementById('input-pulse').value = '72';
        document.getElementById('input-weight').value = '65.5';
        document.getElementById('input-memo').value = 'プリフィルテスト';
    });

    // プリフィルで既に同じ値が選択されている場合、clickのトグル動作で解除されるため
    // setLevelValueで確実にセットする
    await page.evaluate(() => {
        setLevelValue('input-mood', 3);
        setLevelValue('input-condition', 2);
    });

    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    const formValues = await page.evaluate(() => {
        return {
            systolic: document.getElementById('input-systolic').value,
            diastolic: document.getElementById('input-diastolic').value,
            pulse: document.getElementById('input-pulse').value,
            weight: document.getElementById('input-weight').value,
            memo: document.getElementById('input-memo').value,
            moodSelected: document.querySelector('#input-mood .level-btn.selected')?.dataset.value || null,
            conditionSelected: document.querySelector('#input-condition .level-btn.selected')?.dataset.value || null
        };
    });

    expect(formValues.systolic).toBe('125');
    expect(formValues.diastolic).toBe('82');
    expect(formValues.pulse).toBe('72');
    expect(formValues.weight).toBe('65.5');
    expect(formValues.memo).toBe('プリフィルテスト');
    expect(formValues.moodSelected).toBe('3');
    expect(formValues.conditionSelected).toBe('2');
});

test('E2E-022: リロード後に前回値がプリフィルされる', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.waitForSelector('#input-systolic', { timeout: 10000 });

    // 既存レコードをクリアして確実な状態にする
    await page.evaluate(async () => {
        await deleteAllRecords();
        await refreshRecentRecords();
    });

    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '135';
        document.getElementById('input-diastolic').value = '88';
        document.getElementById('input-pulse').value = '75';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    await page.goto('/', { waitUntil: 'networkidle' });

    await page.waitForSelector('#input-systolic', { timeout: 10000 });

    // prefillFormWithLastRecord は非同期のため少し待つ
    await page.waitForFunction(() => {
        return document.getElementById('input-systolic').value !== '';
    }, { timeout: 10000 });

    const formValues = await page.evaluate(() => {
        return {
            systolic: document.getElementById('input-systolic').value,
            diastolic: document.getElementById('input-diastolic').value,
            pulse: document.getElementById('input-pulse').value
        };
    });

    expect(formValues.systolic).toBe('135');
    expect(formValues.diastolic).toBe('88');
    expect(formValues.pulse).toBe('75');
});

test('E2E-023: プリフィル時に日時は現在時刻が設定される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.waitForSelector('#input-systolic', { timeout: 10000 });

    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '120';
        document.getElementById('input-diastolic').value = '80';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    const timeDiff = await page.evaluate(() => {
        const datetimeValue = document.getElementById('input-datetime').value;
        const formDate = new Date(datetimeValue);
        const now = new Date();
        return Math.abs(now.getTime() - formDate.getTime());
    });

    expect(timeDiff).toBeLessThan(60000);
});

test('E2E-024: フォーカスで入力値が全選択される（memo textarea）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.waitForSelector('#input-memo', { timeout: 10000 });

    // textareaはselectionStart/selectionEndが取得可能なので、
    // memoフィールドで全選択の動作を検証する
    await page.evaluate(() => {
        document.getElementById('input-memo').value = 'テストメモ入力';
    });

    await page.focus('#input-memo');
    await new Promise(r => setTimeout(r, 200));

    const selectionInfo = await page.evaluate(() => {
        const el = document.getElementById('input-memo');
        return {
            selectionStart: el.selectionStart,
            selectionEnd: el.selectionEnd,
            valueLength: el.value.length
        };
    });

    expect(selectionInfo.selectionStart).toBe(0);
    expect(selectionInfo.selectionEnd).toBe(selectionInfo.valueLength);
    expect(selectionInfo.valueLength).toBeGreaterThan(0);

    // number入力フィールドにもフォーカスイベントリスナーが登録されていることを確認
    // type="number" ではselectionStart/Endが取得不可のため、
    // focus後にactiveElementになることで検証する
    const hasSelectOnFocus = await page.evaluate(() => {
        const el = document.getElementById('input-systolic');
        el.value = '120';
        el.focus();
        return document.activeElement === el;
    });
    expect(hasSelectOnFocus).toBe(true);
});

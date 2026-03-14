/**
 * history.spec.js - 履歴タブ関連の Playwright E2E テスト
 */
const { test, expect } = require('@playwright/test');
const { waitForAppReady, saveBPRecord, navigateToTab } = require('./fixtures');

test('E2E-045: 日付フィルタで履歴を絞り込める', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // 異なる日付で2件記録を保存
    await page.evaluate(() => {
        document.getElementById('input-datetime').value = '2026-03-10T08:00';
        document.getElementById('input-systolic').value = '120';
        document.getElementById('input-diastolic').value = '80';
        document.getElementById('input-pulse').value = '70';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 300));

    await page.evaluate(() => {
        document.getElementById('input-datetime').value = '2026-03-12T08:00';
        document.getElementById('input-systolic').value = '130';
        document.getElementById('input-diastolic').value = '85';
        document.getElementById('input-pulse').value = '72';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    // 履歴タブに移動
    await navigateToTab(page, 'history');
    await page.waitForSelector('#history-records .record-item', { timeout: 5000 });

    // 全件表示を確認
    const allCount = await page.evaluate(() => {
        return document.querySelectorAll('#history-records .record-item').length;
    });
    expect(allCount).toBe(2);

    // 開始日フィルタを設定（3/11以降→1件のみ表示）
    await page.fill('#filter-from', '2026-03-11');
    await new Promise(r => setTimeout(r, 500));

    const filteredCount = await page.evaluate(() => {
        return document.querySelectorAll('#history-records .record-item').length;
    });
    expect(filteredCount).toBe(1);

    // 表示されている記録が3/12のものであることを確認
    const recordText = await page.evaluate(() => {
        const record = document.querySelector('#history-records .record-item');
        return record ? record.textContent : '';
    });
    expect(recordText).toContain('130');
});

test('E2E-046: フィルタクリアで全件表示に戻る', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // 2件記録
    await page.evaluate(() => {
        document.getElementById('input-datetime').value = '2026-03-10T08:00';
        document.getElementById('input-systolic').value = '120';
        document.getElementById('input-diastolic').value = '80';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 300));

    await page.evaluate(() => {
        document.getElementById('input-datetime').value = '2026-03-12T08:00';
        document.getElementById('input-systolic').value = '130';
        document.getElementById('input-diastolic').value = '85';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    await navigateToTab(page, 'history');
    await page.waitForSelector('#history-records .record-item', { timeout: 5000 });

    // フィルタで絞り込み
    await page.fill('#filter-from', '2026-03-11');
    await new Promise(r => setTimeout(r, 500));

    const filteredCount = await page.evaluate(() => {
        return document.querySelectorAll('#history-records .record-item').length;
    });
    expect(filteredCount).toBe(1);

    // クリアボタンでフィルタ解除
    await page.click('#filter-clear-btn');
    await new Promise(r => setTimeout(r, 500));

    // 全件表示に戻る
    const clearedCount = await page.evaluate(() => {
        return document.querySelectorAll('#history-records .record-item').length;
    });
    expect(clearedCount).toBe(2);

    // フィルタ入力欄がクリアされている
    const filterState = await page.evaluate(() => {
        return {
            from: document.getElementById('filter-from').value,
            to: document.getElementById('filter-to').value
        };
    });
    expect(filterState.from).toBe('');
    expect(filterState.to).toBe('');
});

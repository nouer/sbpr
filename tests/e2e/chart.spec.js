/**
 * chart.spec.js - グラフタブ関連の Playwright E2E テスト
 * local_app/e2e.test.js から移植
 */
const { test, expect } = require('@playwright/test');
const { waitForAppReady, saveBPRecord, waitForToast, navigateToTab, isVisible } = require('./fixtures');

test('E2E-004: グラフタブでグラフが描画される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '120';
        document.getElementById('input-diastolic').value = '78';
        document.getElementById('input-pulse').value = '68';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    await page.click('[data-tab="chart"]');
    await page.waitForSelector('#tab-chart.active', { timeout: 5000 });

    const canvasExists = await page.evaluate(() => {
        const canvas = document.getElementById('bp-chart');
        return !!(canvas && typeof canvas.getContext === 'function');
    });
    expect(canvasExists).toBe(true);
});

test('E2E-030: ツールチップの再タップ閉じ（onClick定義の確認）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '130';
        document.getElementById('input-diastolic').value = '85';
        document.getElementById('input-pulse').value = '70';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    await page.click('[data-tab="chart"]');
    await page.waitForSelector('#tab-chart.active', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 500));

    const hasOnClick = await page.evaluate(() => {
        const canvas = document.getElementById('bp-chart');
        const chart = Chart.getChart(canvas);
        return chart && typeof chart.options.onClick === 'function';
    });
    expect(hasOnClick).toBe(true);
});

test('E2E-031: 日中/夜間モードで線種トグルが表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.click('[data-tab="chart"]');
    await page.waitForSelector('#tab-chart.active', { timeout: 5000 });

    const toggleHiddenInContinuous = await page.evaluate(() => {
        const toggle = document.getElementById('chart-linestyle-toggle');
        return toggle.style.display === 'none';
    });
    expect(toggleHiddenInContinuous).toBe(true);

    await page.click('#chart-mode-controls button[data-mode="daynight"]');
    await new Promise(r => setTimeout(r, 500));

    const toggleVisibleInDaynight = await page.evaluate(() => {
        const toggle = document.getElementById('chart-linestyle-toggle');
        return toggle.style.display !== 'none';
    });
    expect(toggleVisibleInDaynight).toBe(true);
});

test('E2E-032: 連続モードに戻すと線種トグルが非表示になる', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.click('[data-tab="chart"]');
    await page.waitForSelector('#tab-chart.active', { timeout: 5000 });

    await page.click('#chart-mode-controls button[data-mode="daynight"]');
    await new Promise(r => setTimeout(r, 300));

    await page.click('#chart-mode-controls button[data-mode="continuous"]');
    await new Promise(r => setTimeout(r, 300));

    const toggleHidden = await page.evaluate(() => {
        const toggle = document.getElementById('chart-linestyle-toggle');
        return toggle.style.display === 'none';
    });
    expect(toggleHidden).toBe(true);
});

test('E2E-033: 線種トグルでグラフが再描画される（エラーなし）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '120';
        document.getElementById('input-diastolic').value = '78';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    await page.click('[data-tab="chart"]');
    await page.waitForSelector('#tab-chart.active', { timeout: 5000 });

    await page.click('#chart-mode-controls button[data-mode="daynight"]');
    await new Promise(r => setTimeout(r, 500));

    await page.click('#linestyle-swap');
    await new Promise(r => setTimeout(r, 500));

    const chartExists = await page.evaluate(() => {
        const canvas = document.getElementById('bp-chart');
        const chart = Chart.getChart(canvas);
        return chart !== undefined && chart !== null;
    });
    expect(chartExists).toBe(true);

    const swappedActive = await page.evaluate(() => {
        return document.getElementById('linestyle-swapped').classList.contains('active');
    });
    expect(swappedActive).toBe(true);
});

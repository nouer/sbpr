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

test('E2E-040: 14日ボタンが存在し、クリックで期間が切り替わる', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // データを1件保存
    await saveBPRecord(page, { systolic: 120, diastolic: 78, pulse: 68 });

    await navigateToTab(page, 'chart');

    // 14日ボタンが存在する
    const btn14 = page.locator('#chart-period-controls button[data-period="14"]');
    await expect(btn14).toBeVisible();
    await expect(btn14).toHaveText('14日');

    // ボタンの並び順を確認（7日→14日→30日→90日→全期間）
    const periods = await page.evaluate(() => {
        const buttons = document.querySelectorAll('#chart-period-controls button');
        return Array.from(buttons).map(b => b.dataset.period);
    });
    expect(periods).toEqual(['7', '14', '30', '90', 'all']);

    // デフォルトでは7日がアクティブ
    const btn7 = page.locator('#chart-period-controls button[data-period="7"]');
    await expect(btn7).toHaveClass(/active/);
    await expect(btn14).not.toHaveClass(/active/);

    // 14日ボタンをクリック
    await btn14.click();
    await new Promise(r => setTimeout(r, 500));

    // 14日がアクティブになり、7日は非アクティブ
    await expect(btn14).toHaveClass(/active/);
    await expect(btn7).not.toHaveClass(/active/);

    // グラフが再描画される（Chartインスタンスが存在）
    const chartExists = await page.evaluate(() => {
        const canvas = document.getElementById('bp-chart');
        const chart = Chart.getChart(canvas);
        return chart !== undefined && chart !== null;
    });
    expect(chartExists).toBe(true);

    // currentPeriodが14に設定されている
    const period = await page.evaluate(() => currentPeriod);
    expect(period).toBe(14);
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

test('E2E-041: カスタム期間入力でグラフが更新される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await saveBPRecord(page, { systolic: 120, diastolic: 78, pulse: 68 });
    await navigateToTab(page, 'chart');

    // カスタム入力欄が存在する
    const input = page.locator('#chart-custom-period');
    await expect(input).toBeVisible();

    // 45日を入力してEnter
    await input.fill('45');
    await input.press('Enter');
    await new Promise(r => setTimeout(r, 500));

    // currentPeriodが45に設定される
    const period = await page.evaluate(() => currentPeriod);
    expect(period).toBe(45);

    // カスタム入力にactiveクラスが付く
    const inputActive = await page.evaluate(() => {
        return document.getElementById('chart-custom-period').classList.contains('active');
    });
    expect(inputActive).toBe(true);

    // プリセットボタンのactiveが全て外れる
    const anyPresetActive = await page.evaluate(() => {
        const btns = document.querySelectorAll('#chart-period-controls button');
        return Array.from(btns).some(b => b.classList.contains('active'));
    });
    expect(anyPresetActive).toBe(false);
});

test('E2E-042: カスタム入力とプリセットボタンのactive状態が排他的', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await saveBPRecord(page, { systolic: 120, diastolic: 78, pulse: 68 });
    await navigateToTab(page, 'chart');

    const input = page.locator('#chart-custom-period');

    // カスタム入力で45日を設定
    await input.fill('45');
    await input.press('Enter');
    await new Promise(r => setTimeout(r, 300));

    // プリセットボタン（30日）をクリック
    await page.click('#chart-period-controls button[data-period="30"]');
    await new Promise(r => setTimeout(r, 300));

    // カスタム入力のactiveが外れ、値がクリアされる
    const inputState = await page.evaluate(() => {
        const inp = document.getElementById('chart-custom-period');
        return { active: inp.classList.contains('active'), value: inp.value };
    });
    expect(inputState.active).toBe(false);
    expect(inputState.value).toBe('');

    // 30日ボタンがactive
    const btn30Active = await page.evaluate(() => {
        return document.querySelector('#chart-period-controls button[data-period="30"]').classList.contains('active');
    });
    expect(btn30Active).toBe(true);

    // カスタム入力にプリセット値（7）を入力→対応ボタンがactive化
    await input.fill('7');
    await input.press('Enter');
    await new Promise(r => setTimeout(r, 300));

    const btn7State = await page.evaluate(() => {
        const btn = document.querySelector('#chart-period-controls button[data-period="7"]');
        const inp = document.getElementById('chart-custom-period');
        return { btnActive: btn.classList.contains('active'), inputActive: inp.classList.contains('active') };
    });
    expect(btn7State.btnActive).toBe(true);
    expect(btn7State.inputActive).toBe(false);
});

test('E2E-043: カスタム入力の不正値でグラフが壊れない', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await saveBPRecord(page, { systolic: 120, diastolic: 78, pulse: 68 });
    await navigateToTab(page, 'chart');

    const input = page.locator('#chart-custom-period');

    // 空欄でEnter → 無視される（currentPeriodは変わらない）
    await input.fill('');
    await input.press('Enter');
    await new Promise(r => setTimeout(r, 300));

    const periodAfterEmpty = await page.evaluate(() => currentPeriod);
    expect(periodAfterEmpty).toBe(7); // デフォルトのまま

    // 0を入力 → 無視される
    await input.fill('0');
    await input.press('Enter');
    await new Promise(r => setTimeout(r, 300));

    const periodAfterZero = await page.evaluate(() => currentPeriod);
    expect(periodAfterZero).toBe(7);

    // グラフが壊れていないことを確認
    const chartExists = await page.evaluate(() => {
        const canvas = document.getElementById('bp-chart');
        const chart = Chart.getChart(canvas);
        return chart !== undefined && chart !== null;
    });
    expect(chartExists).toBe(true);
});

test('E2E-047: 体重データありで体重グラフが描画される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // 体重付きでデータを保存
    await saveBPRecord(page, { systolic: 120, diastolic: 78, pulse: 68, weight: 65.5 });
    await new Promise(r => setTimeout(r, 300));
    await saveBPRecord(page, { systolic: 125, diastolic: 80, pulse: 70, weight: 65.8 });

    await navigateToTab(page, 'chart');
    await new Promise(r => setTimeout(r, 1000));

    // 体重グラフカードが表示される
    const weightCardVisible = await page.evaluate(() => {
        const card = document.getElementById('weight-chart-card');
        return card && card.style.display !== 'none';
    });
    expect(weightCardVisible).toBe(true);

    // Chartインスタンスが存在する
    const weightChartExists = await page.evaluate(() => {
        const canvas = document.getElementById('weight-chart');
        if (!canvas) return false;
        const chart = Chart.getChart(canvas);
        return chart !== undefined && chart !== null;
    });
    expect(weightChartExists).toBe(true);
});

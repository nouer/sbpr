/**
 * workflows.spec.js - ユースケースベースの結合 Playwright E2E テスト
 * local_app/e2e.test.js から移植
 */
const { test, expect } = require('@playwright/test');
const { waitForAppReady, saveBPRecord, waitForToast, navigateToTab, isVisible } = require('./fixtures');

test('E2E-UC1: 記録保存→分類バッジ確認（UC1: 初期セットアップ）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // 血圧を記録
    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '145';
        document.getElementById('input-diastolic').value = '92';
        document.getElementById('input-pulse').value = '78';
        document.getElementById('input-weight').value = '72.5';
        document.getElementById('input-memo').value = 'UC1テスト記録';
    });

    // 気分「普通」をタップ
    const moodBtns = await page.locator('#mood-buttons button').all();
    if (moodBtns.length >= 2) await moodBtns[1].click();

    // 体調「普通」をタップ
    const condBtns = await page.locator('#condition-buttons button').all();
    if (condBtns.length >= 2) await condBtns[1].click();

    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    // 少し待ってレンダリング完了を待つ
    await page.waitForTimeout(500);

    // 直近の記録に145/92が表示され、分類バッジ「I度高血圧」が表示される
    const recordInfo = await page.evaluate(() => {
        const container = document.getElementById('recent-records');
        if (!container) return { found: false, hasBadge: false };
        const items = container.querySelectorAll('.record-item');
        for (const item of items) {
            const text = item.textContent || '';
            if (text.includes('145') && text.includes('92')) {
                const badge = item.querySelector('.classification');
                return {
                    found: true,
                    hasBadge: !!badge,
                    badgeText: badge ? badge.textContent.trim() : ''
                };
            }
        }
        return { found: false, hasBadge: false, badgeText: '' };
    });
    expect(recordInfo.found).toBe(true);
    expect(recordInfo.hasBadge).toBe(true);
    expect(recordInfo.badgeText).toContain('I度高血圧');
});

test('E2E-UC2: プリフィル確認→服薬なし記録（UC2: 日々の記録ルーティン）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // Playwright では各テストが独立したコンテキストなので、先にレコードを保存してプリフィルを設定する
    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '145';
        document.getElementById('input-diastolic').value = '92';
        document.getElementById('input-pulse').value = '78';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    // ページをリロードしてプリフィルを反映
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // プリフィルが機能していること（値が空ではない）を確認
    const prefilled = await page.evaluate(() => {
        return {
            systolic: document.getElementById('input-systolic').value,
            diastolic: document.getElementById('input-diastolic').value,
            pulse: document.getElementById('input-pulse').value
        };
    });
    // プリフィルが動作している（空でない値がセットされている）
    expect(prefilled.systolic).not.toBe('');
    expect(prefilled.diastolic).not.toBe('');

    // 服薬なしの記録を保存
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 200); // 重複しない日付
    const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    await page.evaluate((d) => {
        const el = document.getElementById('no-medication-date');
        if (el) el.value = d;
    }, dateStr);
    await page.click('#save-no-medication-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('服薬なし');
    }, { timeout: 10000 });

    // 少し待ってリスト更新を待つ
    await page.waitForTimeout(500);

    // 直近の記録に「服薬なし」が表示される
    const hasNoMed = await page.evaluate(() => {
        const container = document.getElementById('recent-records');
        return container && container.innerHTML.includes('服薬なし');
    });
    expect(hasNoMed).toBe(true);
});

test('E2E-UC3: 4モード切替→期間切替→統計表示（UC3: グラフ分析）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // グラフタブに切り替え
    await page.click('[data-tab="chart"]');
    await page.waitForSelector('#tab-chart.active', { timeout: 5000 });

    // 連続モードが初期選択されている
    const initialMode = await page.evaluate(() => {
        const btn = document.querySelector('#chart-mode-controls button.active');
        return btn ? btn.dataset.mode : null;
    });
    expect(initialMode).toBe('continuous');

    // 日中・夜間モードに切り替え
    await page.click('#chart-mode-controls button[data-mode="daynight"]');
    await page.waitForTimeout(500);
    const daynightActive = await page.evaluate(() => {
        const btn = document.querySelector('#chart-mode-controls button[data-mode="daynight"]');
        return btn && btn.classList.contains('active');
    });
    expect(daynightActive).toBe(true);

    // 線種トグルが表示される
    const toggleVisible = await isVisible(page, '#chart-linestyle-toggle');
    expect(toggleVisible).toBe(true);

    // 日中のみモードに切り替え
    await page.click('#chart-mode-controls button[data-mode="day"]');
    await page.waitForTimeout(500);
    const dayOnlyActive = await page.evaluate(() => {
        const btn = document.querySelector('#chart-mode-controls button[data-mode="day"]');
        return btn && btn.classList.contains('active');
    });
    expect(dayOnlyActive).toBe(true);

    // 夜間のみモードに切り替え
    await page.click('#chart-mode-controls button[data-mode="night"]');
    await page.waitForTimeout(500);
    const nightOnlyActive = await page.evaluate(() => {
        const btn = document.querySelector('#chart-mode-controls button[data-mode="night"]');
        return btn && btn.classList.contains('active');
    });
    expect(nightOnlyActive).toBe(true);

    // 連続モードに戻す
    await page.click('#chart-mode-controls button[data-mode="continuous"]');
    await page.waitForTimeout(500);

    // 線種トグルが非表示になる
    const toggleHidden = await page.evaluate(() => {
        const el = document.getElementById('chart-linestyle-toggle');
        if (!el) return true;
        const style = window.getComputedStyle(el);
        return style.display === 'none';
    });
    expect(toggleHidden).toBe(true);

    // 期間切り替え: 30日
    await page.click('#chart-period-controls button[data-period="30"]');
    await page.waitForTimeout(500);
    const period30Active = await page.evaluate(() => {
        const btn = document.querySelector('#chart-period-controls button[data-period="30"]');
        return btn && btn.classList.contains('active');
    });
    expect(period30Active).toBe(true);

    // 統計情報が表示されている
    const statsVisible = await isVisible(page, '#stats-area');
    expect(statsVisible).toBe(true);
});

test('E2E-UC4: 日付フィルタ→編集→削除（UC4: 履歴管理）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // テスト用の記録を保存
    await page.evaluate(() => {
        document.getElementById('input-systolic').value = '155';
        document.getElementById('input-diastolic').value = '95';
        document.getElementById('input-pulse').value = '80';
        document.getElementById('input-memo').value = 'UC4テスト記録';
    });
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });

    // 履歴タブに切り替え
    await page.click('[data-tab="history"]');
    await page.waitForSelector('#tab-history.active', { timeout: 5000 });

    // 記録が表示されている
    await page.waitForTimeout(500);
    const hasRecords = await page.evaluate(() => {
        const container = document.getElementById('history-records');
        if (!container) return false;
        return container.querySelectorAll('.record-item').length > 0;
    });
    expect(hasRecords).toBe(true);

    // 日付フィルタのUI要素が存在する
    const hasFilter = await page.evaluate(() => {
        return !!(document.getElementById('filter-from') && document.getElementById('filter-to'));
    });
    expect(hasFilter).toBe(true);

    // 血圧記録（服薬なしでない）の編集ボタンをクリック
    const editBtn = await page.evaluate(() => {
        const container = document.getElementById('history-records');
        const items = container.querySelectorAll('.record-item:not(.record-item-no-medication)');
        if (items.length === 0) return false;
        const btn = items[0].querySelector('.edit-btn');
        if (btn) { btn.click(); return true; }
        return false;
    });

    if (editBtn) {
        await page.waitForSelector('#edit-overlay.show', { timeout: 5000 });

        // 編集ダイアログが表示されている
        const editDialogVisible = await isVisible(page, '#edit-overlay');
        expect(editDialogVisible).toBe(true);

        // 最高血圧を変更して保存
        await page.evaluate(() => {
            document.getElementById('edit-systolic').value = '150';
        });
        await page.click('#edit-save');
        await page.waitForFunction(() => {
            const overlay = document.getElementById('edit-overlay');
            return !overlay.classList.contains('show');
        }, { timeout: 5000 });
    }

    // 削除: 血圧記録（服薬なしでない）の×ボタンをクリック
    const deleteClicked = await page.evaluate(() => {
        const container = document.getElementById('history-records');
        const items = container.querySelectorAll('.record-item:not(.record-item-no-medication)');
        if (items.length === 0) return false;
        const btn = items[0].querySelector('.delete-btn');
        if (btn) { btn.click(); return true; }
        return false;
    });

    if (deleteClicked) {
        await page.waitForSelector('#confirm-overlay.show', { timeout: 5000 });
        await page.click('#confirm-ok');
        await page.waitForFunction(() => {
            const overlay = document.getElementById('confirm-overlay');
            return !overlay.classList.contains('show');
        }, { timeout: 5000 });
    }
});

test('E2E-UC6: エクスポート→全削除→インポート→復元確認（UC6: データバックアップ）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // テスト用記録を2件保存
    for (const bp of [{s: '130', d: '85'}, {s: '125', d: '80'}]) {
        await page.evaluate((v) => {
            document.getElementById('input-systolic').value = v.s;
            document.getElementById('input-diastolic').value = v.d;
        }, bp);
        await page.click('#save-btn');
        await page.waitForFunction(() => {
            const t = document.getElementById('toast');
            const txt = document.getElementById('toast-text');
            return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
        }, { timeout: 10000 });
        await page.waitForTimeout(300);
    }

    // エクスポートデータを取得（ファイルダウンロードの代わりにJS経由）
    const exportData = await page.evaluate(async () => {
        const records = await getAllRecords();
        const profile = getProfile();
        const aiMemo = getAIMemo();
        const aiModel = getSelectedAiModel();
        return JSON.stringify({
            version: '0.1.0',
            appName: 'sbpr',
            exportedAt: new Date().toISOString(),
            recordCount: records.length,
            records: records,
            profile: profile,
            aiMemo: aiMemo,
            aiModel: aiModel
        });
    });

    const parsedExport = JSON.parse(exportData);
    expect(parsedExport.appName).toBe('sbpr');
    expect(parsedExport.recordCount).toBeGreaterThanOrEqual(2);

    // 全データ削除
    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });
    await page.click('#delete-all-btn');
    await page.waitForSelector('#confirm-overlay.show', { timeout: 5000 });
    await page.click('#confirm-ok');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('削除しました');
    }, { timeout: 10000 });

    // 記録が空になったことを確認
    await page.click('[data-tab="record"]');
    await page.waitForSelector('#tab-record.active', { timeout: 5000 });
    const emptyRecords = await page.evaluate(() => {
        const list = document.querySelector('#recent-records .record-list');
        return list ? list.children.length : 0;
    });
    expect(emptyRecords).toBe(0);

    // インポートで復元
    await page.evaluate((json) => {
        const blob = new Blob([json], { type: 'application/json' });
        const file = new File([blob], 'backup.json', { type: 'application/json' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        const input = document.getElementById('import-file');
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, exportData);

    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('インポートしました');
    }, { timeout: 10000 });

    // 復元された記録があることを確認
    await page.click('[data-tab="record"]');
    await page.waitForSelector('#tab-record.active', { timeout: 5000 });
    await page.waitForTimeout(500);
    const restoredRecords = await page.evaluate(() => {
        const list = document.querySelector('#recent-records .record-list');
        return list ? list.children.length : 0;
    });
    expect(restoredRecords).toBeGreaterThanOrEqual(2);
});

test('E2E-UC8: お知らせ設定→更新確認ボタン→バージョン情報（UC8: メンテナンスと通知）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // 設定タブに切り替え
    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

    // お知らせ設定チェックボックスを確認
    const notifyCheckboxCount = await page.locator('#setting-notify-enabled').count();
    expect(notifyCheckboxCount).toBeGreaterThan(0);

    // チェックボックスをトグル
    const initialState = await page.locator('#setting-notify-enabled').evaluate(el => el.checked);
    await page.click('#setting-notify-enabled');
    const toggledState = await page.locator('#setting-notify-enabled').evaluate(el => el.checked);
    expect(toggledState).toBe(!initialState);

    // 元に戻す
    await page.click('#setting-notify-enabled');

    // 「お知らせを見る」ボタンが存在する
    const notifyBtnCount = await page.locator('#btn-open-notification').count();
    expect(notifyBtnCount).toBeGreaterThan(0);

    // 「更新を確認」ボタンが存在する
    const updateBtnCount = await page.locator('#check-update-btn').count();
    expect(updateBtnCount).toBeGreaterThan(0);

    // 「強制更新」ボタンが存在する
    const forceUpdateBtnCount = await page.locator('#force-update-btn').count();
    expect(forceUpdateBtnCount).toBeGreaterThan(0);

    // バージョン情報が表示されている
    const versionInfo = await page.evaluate(() => {
        const el = document.getElementById('app-version-info');
        return el ? el.textContent : '';
    });
    expect(versionInfo).toContain('バージョン');
});

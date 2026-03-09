/**
 * navigation.spec.js - ナビゲーション・UI操作関連の Playwright E2E テスト
 * local_app/e2e.test.js から移植
 */
const { test, expect } = require('@playwright/test');
const { waitForAppReady, saveBPRecord, waitForToast, navigateToTab, isVisible } = require('./fixtures');

test('E2E-005: タブ切り替えが正しく動作する', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const tabs = ['record', 'chart', 'history', 'settings'];
    for (const tab of tabs) {
        await page.click(`[data-tab="${tab}"]`);
        const isActive = await page.evaluate((t) => {
            return document.getElementById(`tab-${t}`).classList.contains('active');
        }, tab);
        expect(isActive).toBe(true);
    }
});

test('E2E-007: pageerrorが発生しないこと（全タブ巡回）', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'networkidle' });

    const tabs = ['record', 'chart', 'history', 'settings'];
    for (const tab of tabs) {
        await page.click(`[data-tab="${tab}"]`);
        await page.waitForTimeout(500);
    }

    expect(pageErrors.length).toBe(0);
});

test('E2E-028: ヘッダータップでページ先頭へ戻る', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // ヘッダーにcursor:pointerが設定されていることを確認
    const headerCursor = await page.evaluate(() => {
        const header = document.querySelector('.app-header');
        return window.getComputedStyle(header).cursor;
    });
    expect(headerCursor).toBe('pointer');

    // ページ最下部までスクロール
    await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(500);

    const scrollYAfterScrollDown = await page.evaluate(() => window.scrollY);
    expect(scrollYAfterScrollDown).toBeGreaterThan(0);

    // ヘッダーをクリック
    await page.click('.app-header');
    await page.waitForTimeout(2000);

    // ページが最上部に戻っていることを確認
    const scrollYAfterHeaderClick = await page.evaluate(() => window.scrollY);
    expect(scrollYAfterHeaderClick).toBeLessThanOrEqual(10);

    // ヘッダーが見えていることを確認
    const headerVisible = await isVisible(page, '.app-header');
    expect(headerVisible).toBe(true);
});

test('E2E-029: ↑ボタン/ヘッダータップでAIチャット領域も先頭に戻る', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // APIキーをセットしてAIタブを有効化
    await page.evaluate(() => {
        localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // AIタブに切り替え
    await page.click('[data-tab="ai"]');
    await page.waitForSelector('#tab-ai.active', { timeout: 5000 });

    // AIチャット領域に長いコンテンツを挿入してスクロール可能にする
    await page.evaluate(() => {
        const msgs = [];
        for (let i = 0; i < 20; i++) {
            msgs.push(
                { role: 'user', content: `質問${i + 1}`, displayContent: `質問${i + 1}` },
                { role: 'assistant', content: `回答${i + 1}です。血圧に関するアドバイスをお伝えします。適度な運動と食事管理が重要です。` }
            );
        }
        aiConversation = msgs;
        renderAIChatMessages(false);
    });
    await page.waitForTimeout(300);

    // AIチャット領域がスクロール可能であることを確認
    const chatScrollInfo = await page.evaluate(() => {
        const container = document.getElementById('ai-chat-messages');
        return {
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            isScrollable: container.scrollHeight > container.clientHeight
        };
    });
    expect(chatScrollInfo.isScrollable).toBe(true);

    // renderAIChatMessages で末尾にスクロールされているはずなので scrollTop > 0 を確認
    expect(chatScrollInfo.scrollTop).toBeGreaterThan(0);

    // ↑ボタンをクリック
    await page.click('#scroll-to-top-btn');
    await page.waitForTimeout(2000);

    // AIチャット領域のスクロール位置が先頭付近に戻っていることを確認
    const chatScrollAfter = await page.evaluate(() => {
        return document.getElementById('ai-chat-messages').scrollTop;
    });
    expect(chatScrollAfter).toBeLessThanOrEqual(10);

    // クリーンアップ
    await page.evaluate(() => {
        localStorage.removeItem('sbpr_openai_api_key');
    });

    expect(pageErrors.length).toBe(0);
});

test('E2E-036: お知らせ設定チェックボックスの表示・トグル確認', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // 設定タブに切り替え
    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

    // チェックボックスが存在し、デフォルトでチェックされている
    const checkboxCount = await page.locator('#setting-notify-enabled').count();
    expect(checkboxCount).toBeGreaterThan(0);
    const isChecked = await page.locator('#setting-notify-enabled').evaluate(el => el.checked);
    expect(isChecked).toBe(true);

    // チェックを外す → localStorageに '0' が保存される
    await page.click('#setting-notify-enabled');
    const stored = await page.evaluate(() => localStorage.getItem('sbpr_notification_enabled'));
    expect(stored).toBe('0');

    // チェックを戻す → localStorageに '1' が保存される
    await page.click('#setting-notify-enabled');
    const stored2 = await page.evaluate(() => localStorage.getItem('sbpr_notification_enabled'));
    expect(stored2).toBe('1');
});

test('E2E-037: 「お知らせを見る」ボタンが設定タブに表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    // 設定タブに切り替え
    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

    // 「お知らせを見る」ボタンが存在する
    const btnCount = await page.locator('#btn-open-notification').count();
    expect(btnCount).toBeGreaterThan(0);
    const text = await page.locator('#btn-open-notification').evaluate(el => el.textContent);
    expect(text).toContain('お知らせを見る');
});

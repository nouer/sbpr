/**
 * pwa.spec.js - PWA機能関連の Playwright E2E テスト
 * local_app/e2e.test.js から移植
 */
const { test, expect } = require('@playwright/test');
const { waitForAppReady, saveBPRecord, waitForToast, navigateToTab, isVisible } = require('./fixtures');

test('E2E-PWA-001: manifest.jsonが正しく読み込まれる', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const manifestHref = await page.evaluate(() => {
        const link = document.querySelector('link[rel="manifest"]');
        return link ? link.getAttribute('href') : null;
    });
    expect(manifestHref).toBe('/manifest.json');
});

test('E2E-PWA-002: Service Workerが登録される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    const swRegistered = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return 'not-supported';
        try {
            const registration = await navigator.serviceWorker.getRegistration('/');
            return registration ? 'registered' : 'not-registered';
        } catch (e) {
            return 'error: ' + e.message;
        }
    });

    expect(['registered', 'not-supported']).toContain(swRegistered);
});

test('E2E-PWA-003: PWA meta tagsが設定されている', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const metaTags = await page.evaluate(() => {
        const themeColor = document.querySelector('meta[name="theme-color"]');
        const webAppCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
        const webAppTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        const touchIcon = document.querySelector('link[rel="apple-touch-icon"]');
        return {
            themeColor: themeColor ? themeColor.getAttribute('content') : null,
            webAppCapable: webAppCapable ? webAppCapable.getAttribute('content') : null,
            webAppTitle: webAppTitle ? webAppTitle.getAttribute('content') : null,
            touchIcon: touchIcon ? touchIcon.getAttribute('href') : null
        };
    });

    expect(metaTags.themeColor).toBe('#2563eb');
    expect(metaTags.webAppCapable).toBe('yes');
    expect(metaTags.webAppTitle).toBe('血圧記録');
    expect(metaTags.touchIcon).toBe('/icons/icon-192.png');
});

test('E2E-PWA-004: pageerrorが発生しない（PWA込み全タブ巡回）', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    const tabs = ['record', 'chart', 'history', 'settings'];
    for (const tab of tabs) {
        await page.click(`[data-tab="${tab}"]`);
        await page.waitForTimeout(500);
    }

    expect(pageErrors.length).toBe(0);
});

test('E2E-PWA-005: 更新バナー要素が存在し初期状態では非表示', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    const bannerInfo = await page.evaluate(() => {
        const banner = document.getElementById('update-banner');
        if (!banner) return { exists: false };
        const style = window.getComputedStyle(banner);
        return {
            exists: true,
            display: banner.style.display || style.display,
            hasUpdateBtn: !!document.getElementById('update-banner-btn'),
            hasCloseBtn: !!document.getElementById('update-banner-close')
        };
    });

    expect(bannerInfo.exists).toBe(true);
    expect(bannerInfo.display).toBe('none');
    expect(bannerInfo.hasUpdateBtn).toBe(true);
    expect(bannerInfo.hasCloseBtn).toBe(true);
});

test('E2E-PWA-006: 設定タブに「更新を確認」ボタンが表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

    const btnInfo = await page.evaluate(() => {
        const btn = document.getElementById('check-update-btn');
        if (!btn) return { exists: false };
        const style = window.getComputedStyle(btn);
        return {
            exists: true,
            visible: style.display !== 'none' && style.visibility !== 'hidden',
            text: btn.textContent.trim()
        };
    });

    expect(btnInfo.exists).toBe(true);
    expect(btnInfo.visible).toBe(true);
    expect(btnInfo.text).toBe('更新を確認');

    const statusEl = await page.evaluate(() => {
        return document.getElementById('update-check-status') !== null;
    });
    expect(statusEl).toBe(true);
});

test('E2E-PWA-007: 設定タブに「強制更新」ボタンが表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

    const btnInfo = await page.evaluate(() => {
        const btn = document.getElementById('force-update-btn');
        if (!btn) return { exists: false };
        const style = window.getComputedStyle(btn);
        return {
            exists: true,
            visible: style.display !== 'none' && style.visibility !== 'hidden',
            text: btn.textContent.trim(),
            disabled: btn.disabled
        };
    });

    expect(btnInfo.exists).toBe(true);
    expect(btnInfo.visible).toBe(true);
    expect(btnInfo.text).toBe('強制更新');
    expect(btnInfo.disabled).toBe(false);

    const statusEl = await page.evaluate(() => {
        return document.getElementById('force-update-status') !== null;
    });
    expect(statusEl).toBe(true);
});

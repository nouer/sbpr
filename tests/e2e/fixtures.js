/**
 * fixtures.js - Playwright E2E共通ヘルパー
 */

/**
 * Wait for app to be fully initialized (data-app-ready="true")
 */
async function waitForAppReady(page) {
    await page.waitForFunction(() => {
        return document.body.dataset.appReady === 'true';
    }, { timeout: 30000 });
}

/**
 * Save a blood pressure record via form
 */
async function saveBPRecord(page, { systolic, diastolic, pulse, weight, memo } = {}) {
    if (systolic) await page.evaluate((v) => { document.getElementById('input-systolic').value = v; }, String(systolic));
    if (diastolic) await page.evaluate((v) => { document.getElementById('input-diastolic').value = v; }, String(diastolic));
    if (pulse) await page.evaluate((v) => { document.getElementById('input-pulse').value = v; }, String(pulse));
    if (weight) await page.evaluate((v) => { document.getElementById('input-weight').value = v; }, String(weight));
    if (memo !== undefined) await page.evaluate((v) => { document.getElementById('input-memo').value = v; }, memo);
    await page.click('#save-btn');
    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
    }, { timeout: 10000 });
}

/**
 * Wait for toast message containing specific text
 */
async function waitForToast(page, text) {
    await page.waitForFunction((expectedText) => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes(expectedText);
    }, text, { timeout: 10000 });
}

/**
 * Navigate to a specific tab
 */
async function navigateToTab(page, tabName) {
    await page.click(`[data-tab="${tabName}"]`);
    await page.waitForSelector(`#tab-${tabName}.active`, { timeout: 5000 });
}

/**
 * Check if element is visible
 */
async function isVisible(page, selector) {
    return await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
    }, selector);
}

module.exports = { waitForAppReady, saveBPRecord, waitForToast, navigateToTab, isVisible };

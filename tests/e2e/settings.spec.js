/**
 * settings.spec.js - 設定タブ関連の Playwright E2E テスト
 * local_app/e2e.test.js から移植
 */
const { test, expect } = require('@playwright/test');
const { waitForAppReady, saveBPRecord, waitForToast, navigateToTab, isVisible } = require('./fixtures');

test('E2E-006: 設定タブのエクスポート/インポートボタンが表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

    const exportVisible = await isVisible(page, '#export-btn');
    expect(exportVisible).toBe(true);

    const importVisible = await isVisible(page, '#import-btn');
    expect(importVisible).toBe(true);
});

test('E2E-010: AI設定の備考保存が動作する', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

    await page.evaluate(() => {
        document.getElementById('input-ai-memo').value = '高血圧で通院中';
    });
    await page.click('#save-ai-memo-btn');

    const savedMemo = await page.evaluate(() => {
        return localStorage.getItem('sbpr_ai_memo');
    });
    expect(savedMemo).toBe('高血圧で通院中');

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_ai_memo');
    });
});

test('E2E-015: エクスポートJSONにプロフィールとAI備考とAIモデルが含まれる', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
        localStorage.setItem('sbpr_birthday', '1980-05-15');
        localStorage.setItem('sbpr_gender', 'male');
        localStorage.setItem('sbpr_height', '170');
        localStorage.setItem('sbpr_ai_memo', '降圧剤を服用中');
        localStorage.setItem('sbpr_ai_model', 'gpt-4.1');
    });

    const exportData = await page.evaluate(async () => {
        const records = await getAllRecords();
        const profile = getProfile();
        const aiMemo = getAIMemo();
        const aiModel = getSelectedAiModel();
        return {
            hasProfile: profile !== undefined && profile !== null,
            profile: profile,
            aiMemo: aiMemo,
            aiModel: aiModel,
            recordCount: records.length
        };
    });

    expect(exportData.hasProfile).toBe(true);
    expect(exportData.profile.birthday).toBe('1980-05-15');
    expect(exportData.profile.gender).toBe('male');
    expect(exportData.profile.height).toBe('170');
    expect(exportData.aiMemo).toBe('降圧剤を服用中');
    expect(exportData.aiModel).toBe('gpt-4.1');

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_birthday');
        localStorage.removeItem('sbpr_gender');
        localStorage.removeItem('sbpr_height');
        localStorage.removeItem('sbpr_ai_memo');
        localStorage.removeItem('sbpr_ai_model');
    });
});

test('E2E-015b: エクスポート実行後に最終エクスポート日時がlocalStorageに保存される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => localStorage.removeItem('sbpr_last_export_at'));

    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });
    await page.click('#export-btn');
    await page.waitForTimeout(500);

    const lastExportAt = await page.evaluate(() => localStorage.getItem('sbpr_last_export_at'));
    expect(lastExportAt).not.toBeNull();
    expect(() => new Date(lastExportAt).toISOString()).not.toThrow();

    const exportTime = new Date(lastExportAt).getTime();
    const now = Date.now();
    expect(exportTime).toBeLessThanOrEqual(now + 1000);
    expect(exportTime).toBeGreaterThanOrEqual(now - 60000);
});

test('E2E-016: インポートでプロフィールとAI備考とAIモデルが復元される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_birthday');
        localStorage.removeItem('sbpr_gender');
        localStorage.removeItem('sbpr_height');
        localStorage.removeItem('sbpr_ai_memo');
        localStorage.removeItem('sbpr_ai_model');
    });

    const importJson = JSON.stringify({
        version: '0.1.0',
        appName: 'sbpr',
        exportedAt: new Date().toISOString(),
        recordCount: 0,
        records: [],
        profile: {
            birthday: '1990-12-25',
            gender: 'female',
            height: '160'
        },
        aiMemo: '高血圧の家族歴あり',
        aiModel: 'gpt-4.1'
    });

    await page.evaluate((json) => {
        const blob = new Blob([json], { type: 'application/json' });
        const file = new File([blob], 'test_import.json', { type: 'application/json' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        const input = document.getElementById('import-file');
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, importJson);

    await page.waitForFunction(() => {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-text');
        return t && t.style.display !== 'none' && txt && txt.textContent.includes('インポートしました');
    }, { timeout: 10000 });

    const restored = await page.evaluate(() => {
        return {
            birthday: localStorage.getItem('sbpr_birthday'),
            gender: localStorage.getItem('sbpr_gender'),
            height: localStorage.getItem('sbpr_height'),
            aiMemo: localStorage.getItem('sbpr_ai_memo'),
            aiModel: localStorage.getItem('sbpr_ai_model'),
            birthdayUI: document.getElementById('input-birthday').value,
            genderUI: document.getElementById('input-gender').value,
            heightUI: document.getElementById('input-height').value,
            aiMemoUI: document.getElementById('input-ai-memo').value,
            aiModelUI: document.getElementById('ai-model-select').value
        };
    });

    expect(restored.birthday).toBe('1990-12-25');
    expect(restored.gender).toBe('female');
    expect(restored.height).toBe('160');
    expect(restored.aiMemo).toBe('高血圧の家族歴あり');
    expect(restored.aiModel).toBe('gpt-4.1');
    expect(restored.birthdayUI).toBe('1990-12-25');
    expect(restored.genderUI).toBe('female');
    expect(restored.heightUI).toBe('160');
    expect(restored.aiMemoUI).toBe('高血圧の家族歴あり');
    expect(restored.aiModelUI).toBe('gpt-4.1');

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_birthday');
        localStorage.removeItem('sbpr_gender');
        localStorage.removeItem('sbpr_height');
        localStorage.removeItem('sbpr_ai_memo');
        localStorage.removeItem('sbpr_ai_model');
    });
});

test('E2E-017: AIモデル選択セレクトが設定タブに表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

    const selectExists = await page.evaluate(() => {
        const el = document.getElementById('ai-model-select');
        return el !== null && el.tagName === 'SELECT';
    });
    expect(selectExists).toBe(true);
});

test('E2E-018: AIモデル選択のデフォルト値がgpt-4o-miniである', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_ai_model');
    });
    await page.goto('/', { waitUntil: 'networkidle' });

    const defaultModel = await page.evaluate(() => {
        return document.getElementById('ai-model-select').value;
    });
    expect(defaultModel).toBe('gpt-4o-mini');

    const modelFromFunc = await page.evaluate(() => {
        return getSelectedAiModel();
    });
    expect(modelFromFunc).toBe('gpt-4o-mini');
});

test('E2E-019: AIモデル選択の変更がlocalStorageに保存される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

    await page.selectOption('#ai-model-select', 'gpt-4.1');

    const savedModel = await page.evaluate(() => {
        return localStorage.getItem('sbpr_ai_model');
    });
    expect(savedModel).toBe('gpt-4.1');

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_ai_model');
    });
});

test('E2E-020: AIモデル情報が正しく表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

    await page.selectOption('#ai-model-select', 'gpt-4.1');

    const infoText = await page.evaluate(() => {
        return document.getElementById('ai-model-info').textContent;
    });
    expect(infoText).toContain('GPT-4.1');
    expect(infoText).toContain('gpt-4.1');
    expect(infoText).toContain('1,047,576');

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_ai_model');
    });
});

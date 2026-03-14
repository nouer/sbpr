/**
 * ai.spec.js - AI診断タブ関連の Playwright E2E テスト
 * local_app/e2e.test.js から移植
 */
const { test, expect } = require('@playwright/test');
const { waitForAppReady, saveBPRecord, waitForToast, navigateToTab, isVisible } = require('./fixtures');

test('E2E-008: AI診断タブはAPIキー未設定時に非表示', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const aiTabVisible = await isVisible(page, '#tab-btn-ai');
    expect(aiTabVisible).toBe(false);
});

test('E2E-009: APIキー設定でAI診断タブが表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
        localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
    });
    await page.goto('/', { waitUntil: 'networkidle' });

    const aiTabVisible = await isVisible(page, '#tab-btn-ai');
    expect(aiTabVisible).toBe(true);

    await page.click('[data-tab="ai"]');
    const aiContentActive = await page.evaluate(() => {
        return document.getElementById('tab-ai').classList.contains('active');
    });
    expect(aiContentActive).toBe(true);

    const disclaimerVisible = await isVisible(page, '.ai-disclaimer');
    expect(disclaimerVisible).toBe(true);

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_openai_api_key');
    });
});

test('E2E-012: parseSuggestionsが正しく候補を抽出する', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const result = await page.evaluate(() => {
        const text = '血圧の傾向は良好です。\n\n{{SUGGEST:食事について詳しく教えてください}}\n{{SUGGEST:運動の頻度はどのくらいが良いですか？}}\n{{SUGGEST:睡眠との関係を教えてください}}';
        return parseSuggestions(text);
    });

    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions[0]).toBe('食事について詳しく教えてください');
    expect(result.suggestions[1]).toBe('運動の頻度はどのくらいが良いですか？');
    expect(result.suggestions[2]).toBe('睡眠との関係を教えてください');
    expect(result.mainContent).not.toContain('{{SUGGEST:');
    expect(result.mainContent).toContain('血圧の傾向は良好です。');
});

test('E2E-013: 提案質問ボタンがAI応答に表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
        localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
    });
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.click('[data-tab="ai"]');
    await page.waitForSelector('#tab-ai.active', { timeout: 5000 });

    await page.evaluate(() => {
        aiConversation = [
            { role: 'user', content: 'テスト', displayContent: 'テスト' },
            { role: 'assistant', content: '血圧は正常です。\n\n{{SUGGEST:食事のアドバイスをください}}\n{{SUGGEST:運動について教えてください}}\n{{SUGGEST:ストレス管理の方法は？}}' }
        ];
        renderAIChatMessages(false);
    });

    const btnCount = await page.evaluate(() => {
        return document.querySelectorAll('.ai-suggestion-btn').length;
    });
    expect(btnCount).toBe(3);

    const firstBtnText = await page.evaluate(() => {
        return document.querySelector('.ai-suggestion-btn').textContent;
    });
    expect(firstBtnText).toBe('食事のアドバイスをください');

    const bubbleText = await page.evaluate(() => {
        return document.getElementById('ai-last-bubble').textContent;
    });
    expect(bubbleText).not.toContain('{{SUGGEST:');
    expect(bubbleText).toContain('血圧は正常です。');

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_openai_api_key');
    });
});

test('E2E-034: AI診断タブに期間選択ボタンが表示される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.evaluate(() => {
        localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.click('[data-tab="ai"]');
    await page.waitForSelector('#tab-ai.active', { timeout: 5000 });

    const buttons = await page.evaluate(() => {
        const btns = document.querySelectorAll('#ai-period-controls button');
        return Array.from(btns).map(b => ({
            period: b.dataset.period,
            text: b.textContent,
            isActive: b.classList.contains('active')
        }));
    });

    expect(buttons).toHaveLength(5);
    expect(buttons[0].period).toBe('7');
    expect(buttons[0].isActive).toBe(true);
    expect(buttons[1].period).toBe('14');
    expect(buttons[2].period).toBe('30');
    expect(buttons[3].period).toBe('90');
    expect(buttons[4].period).toBe('all');

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_openai_api_key');
    });
});

test('E2E-035: AI診断の期間選択ボタン切替', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.evaluate(() => {
        localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.click('[data-tab="ai"]');
    await page.waitForSelector('#tab-ai.active', { timeout: 5000 });

    await page.click('#ai-period-controls button[data-period="30"]');
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
        const btns = document.querySelectorAll('#ai-period-controls button');
        return Array.from(btns).map(b => ({
            period: b.dataset.period,
            isActive: b.classList.contains('active')
        }));
    });

    expect(result.find(b => b.period === '7').isActive).toBe(false);
    expect(result.find(b => b.period === '30').isActive).toBe(true);

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_openai_api_key');
    });
});

test('E2E-044: AI診断タブのカスタム期間入力で期間が設定される', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.evaluate(() => {
        localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.click('[data-tab="ai"]');
    await page.waitForSelector('#tab-ai.active', { timeout: 5000 });

    // カスタム入力欄が存在する
    const input = page.locator('#ai-custom-period');
    await expect(input).toBeVisible();

    // 60日を入力してEnter
    await input.fill('60');
    await input.press('Enter');
    await new Promise(r => setTimeout(r, 300));

    // currentAIPeriodが60に設定される
    const period = await page.evaluate(() => currentAIPeriod);
    expect(period).toBe(60);

    // プリセットボタンのactiveが全て外れる
    const anyPresetActive = await page.evaluate(() => {
        const btns = document.querySelectorAll('#ai-period-controls button');
        return Array.from(btns).some(b => b.classList.contains('active'));
    });
    expect(anyPresetActive).toBe(false);

    // カスタム入力にactiveクラスが付く
    const inputActive = await page.evaluate(() => {
        return document.getElementById('ai-custom-period').classList.contains('active');
    });
    expect(inputActive).toBe(true);

    // プリセットボタンをクリックするとカスタム入力のactiveが外れる
    await page.click('#ai-period-controls button[data-period="7"]');
    await new Promise(r => setTimeout(r, 300));

    const stateAfterPreset = await page.evaluate(() => {
        const inp = document.getElementById('ai-custom-period');
        return { active: inp.classList.contains('active'), value: inp.value };
    });
    expect(stateAfterPreset.active).toBe(false);
    expect(stateAfterPreset.value).toBe('');

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_openai_api_key');
    });
});

test('E2E-052: AI会話クリアが動作する', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.evaluate(() => {
        localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForAppReady(page);

    await page.click('[data-tab="ai"]');
    await page.waitForSelector('#tab-ai.active', { timeout: 5000 });

    // ダミー会話を注入
    await page.evaluate(() => {
        aiConversation = [
            { role: 'user', content: 'テスト質問', displayContent: 'テスト質問' },
            { role: 'assistant', content: 'テスト回答です。' }
        ];
        renderAIChatMessages(false);
        document.getElementById('ai-followup-row').style.display = '';
    });

    // 会話が表示されていることを確認
    const beforeClear = await page.evaluate(() => {
        return document.querySelectorAll('.ai-msg').length;
    });
    expect(beforeClear).toBeGreaterThan(0);

    // クリアボタンをクリック
    await page.click('#ai-clear-btn');
    await new Promise(r => setTimeout(r, 500));

    // 会話がクリアされている
    const afterClear = await page.evaluate(() => ({
        bubbles: document.querySelectorAll('.ai-msg').length,
        emptyVisible: document.getElementById('ai-chat-empty') !== null,
        followupHidden: document.getElementById('ai-followup-row').style.display === 'none'
    }));
    expect(afterClear.bubbles).toBe(0);
    expect(afterClear.followupHidden).toBe(true);

    await page.evaluate(() => {
        localStorage.removeItem('sbpr_openai_api_key');
    });
});

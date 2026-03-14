/**
 * e2e.test.js - シンプル血圧記録 (sbpr) E2Eテスト
 * Puppeteer で Docker ネットワーク内の nginx にアクセスしてテスト
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const childProcess = require('child_process');

describe('E2E Test: sbpr App', () => {
    let browser;
    let page;
    let baseUrl = 'http://sbpr-app:80';
    const pageErrors = [];

    jest.setTimeout(300000);

    beforeAll(async () => {
        const host = process.env.E2E_APP_HOST || 'sbpr-app';
        const fixedIp = String(process.env.E2E_APP_IP || '').trim();
        const hasFixedIp = Boolean(fixedIp && /^\d+\.\d+\.\d+\.\d+$/.test(fixedIp));

        if (hasFixedIp) {
            baseUrl = `http://${fixedIp}:80`;
            console.log(`E2E baseUrl = ${baseUrl} (fixed)`);
        } else {
            const tryResolveIpv4 = () => {
                try {
                    const out = childProcess.execSync(`getent hosts ${host}`, { encoding: 'utf-8', timeout: 8000 }).trim();
                    const ip = out.split(/\s+/)[0];
                    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
                } catch (e) {}
                try {
                    const out = childProcess.execSync(`nslookup ${host} 127.0.0.11`, { encoding: 'utf-8', timeout: 8000 });
                    const lines = String(out || '').split('\n').map(l => l.trim()).filter(Boolean);
                    const addrLine = lines.find(l => /^Address\s+\d+:\s+\d+\.\d+\.\d+\.\d+/.test(l));
                    if (addrLine) {
                        const m = addrLine.match(/(\d+\.\d+\.\d+\.\d+)/);
                        if (m && m[1]) return m[1];
                    }
                } catch (e) {}
                try {
                    const hostsText = fs.readFileSync('/etc/hosts', 'utf-8');
                    const line = hostsText.split('\n').find(l => l.includes(` ${host}`) || l.endsWith(`\t${host}`));
                    if (line) {
                        const ip = line.trim().split(/\s+/)[0];
                        if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
                    }
                } catch (e) {}
                return null;
            };

            let ip = null;
            for (let i = 0; i < 30; i++) {
                ip = tryResolveIpv4();
                if (ip) break;
                await new Promise(r => setTimeout(r, 1000));
            }
            if (!ip) {
                throw new Error(`E2E: cannot resolve '${host}' to IPv4.`);
            }
            baseUrl = `http://${ip}:80`;
            console.log(`E2E baseUrl = ${baseUrl}`);
        }

        browser = await puppeteer.launch({
            headless: 'new',
            timeout: 300000,
            protocolTimeout: 300000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        page = await browser.newPage();

        page.on('pageerror', error => {
            console.error('Browser Page Error:', error.message);
            pageErrors.push(error.message);
        });

        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error('Browser Console Error:', msg.text());
            }
        });
    }, 300000);

    afterAll(async () => {
        if (browser) await browser.close();
    });

    beforeEach(() => {
        pageErrors.length = 0;
    });

    const isVisible = async (selector) => {
        return await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
        }, selector);
    };

    /** initApp()完了を待機（data-app-ready="true"フラグ） */
    const waitForAppReady = async () => {
        await page.waitForFunction(() => {
            return document.body.dataset.appReady === 'true';
        }, { timeout: 30000 });
    };

    test('E2E-001: ページが表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        const title = await page.title();
        expect(title).toBe('シンプル血圧記録 - sbpr');

        const headerVisible = await isVisible('.app-header');
        expect(headerVisible).toBe(true);

        const tabNavVisible = await isVisible('.tab-nav');
        expect(tabNavVisible).toBe(true);

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-025: 右上にバージョン情報が表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        const infoDisplay = await page.evaluate(() => {
            const el = document.getElementById('app-info-display');
            return el ? el.innerHTML : null;
        });
        expect(infoDisplay).not.toBeNull();
        expect(infoDisplay).toContain('Ver:');
        expect(infoDisplay).toContain('Build:');

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-026: 左上にスクロールトップボタンが表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        const btnExists = await page.evaluate(() => {
            const el = document.getElementById('scroll-to-top-btn');
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.position === 'fixed';
        });
        expect(btnExists).toBe(true);

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-002: 血圧を記録して一覧に表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        const recordText = await page.$eval('#recent-records', el => el.textContent || '');
        expect(recordText).toContain('125');
        expect(recordText).toContain('82');

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-003: 記録を削除できる', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        const deleteBtn = await page.$('.record-actions .delete-btn');
        if (deleteBtn) {
            await deleteBtn.click();
            await page.waitForSelector('#confirm-overlay.show', { timeout: 5000 });
            await page.click('#confirm-ok');
            await page.waitForFunction(() => {
                const overlay = document.getElementById('confirm-overlay');
                return !overlay.classList.contains('show');
            }, { timeout: 5000 });
        }

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-004: グラフタブでグラフが描画される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-005: タブ切り替えが正しく動作する', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        const tabs = ['record', 'chart', 'history', 'settings'];
        for (const tab of tabs) {
            await page.click(`[data-tab="${tab}"]`);
            const isActive = await page.evaluate((t) => {
                return document.getElementById(`tab-${t}`).classList.contains('active');
            }, tab);
            expect(isActive).toBe(true);
        }

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-006: 設定タブのエクスポート/インポートボタンが表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        await page.click('[data-tab="settings"]');
        await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

        const exportVisible = await isVisible('#export-btn');
        expect(exportVisible).toBe(true);

        const importVisible = await isVisible('#import-btn');
        expect(importVisible).toBe(true);

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-007: pageerrorが発生しないこと（全タブ巡回）', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        const tabs = ['record', 'chart', 'history', 'settings'];
        for (const tab of tabs) {
            await page.click(`[data-tab="${tab}"]`);
            await new Promise(r => setTimeout(r, 500));
        }

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-008: AI診断タブはAPIキー未設定時に非表示', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        const aiTabVisible = await isVisible('#tab-btn-ai');
        expect(aiTabVisible).toBe(false);

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-009: APIキー設定でAI診断タブが表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        await page.evaluate(() => {
            localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
        });
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        const aiTabVisible = await isVisible('#tab-btn-ai');
        expect(aiTabVisible).toBe(true);

        await page.click('[data-tab="ai"]');
        const aiContentActive = await page.evaluate(() => {
            return document.getElementById('tab-ai').classList.contains('active');
        });
        expect(aiContentActive).toBe(true);

        const disclaimerVisible = await isVisible('.ai-disclaimer');
        expect(disclaimerVisible).toBe(true);

        await page.evaluate(() => {
            localStorage.removeItem('sbpr_openai_api_key');
        });

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-011: 気分・体調・体重を記録して一覧に表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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

        const recordText = await page.$eval('#recent-records', el => el.textContent || '');
        expect(recordText).toContain('118');
        expect(recordText).toContain('76');
        expect(recordText).toContain('65.5');

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-010: AI設定の備考保存が動作する', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-015: エクスポートJSONにプロフィールとAI備考とAIモデルが含まれる', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-015b: エクスポート実行後に最終エクスポート日時がlocalStorageに保存される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        await page.evaluate(() => localStorage.removeItem('sbpr_last_export_at'));

        await page.click('[data-tab="settings"]');
        await page.waitForSelector('#tab-settings.active', { timeout: 5000 });
        await page.click('#export-btn');
        await new Promise(r => setTimeout(r, 500));

        const lastExportAt = await page.evaluate(() => localStorage.getItem('sbpr_last_export_at'));
        expect(lastExportAt).not.toBeNull();
        expect(() => new Date(lastExportAt).toISOString()).not.toThrow();
        expect(new Date(lastExportAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
        expect(new Date(lastExportAt).getTime()).toBeGreaterThanOrEqual(Date.now() - 60000);

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-015c: 服薬しなかった日を記録すると直近の記録に「服薬なし」で表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-016: インポートでプロフィールとAI備考とAIモデルが復元される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-012: parseSuggestionsが正しく候補を抽出する', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-013: 提案質問ボタンがAI応答に表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        await page.evaluate(() => {
            localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
        });
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-021: 保存後に前回値がプリフィルされる', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-022: リロード後に前回値がプリフィルされる', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-023: プリフィル時に日時は現在時刻が設定される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-024: フォーカスで入力値が全選択される（memo textarea）', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-017: AIモデル選択セレクトが設定タブに表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        await page.click('[data-tab="settings"]');
        await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

        const selectExists = await page.evaluate(() => {
            const el = document.getElementById('ai-model-select');
            return el !== null && el.tagName === 'SELECT';
        });
        expect(selectExists).toBe(true);

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-018: AIモデル選択のデフォルト値がgpt-4o-miniである', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        await page.evaluate(() => {
            localStorage.removeItem('sbpr_ai_model');
        });
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        const defaultModel = await page.evaluate(() => {
            return document.getElementById('ai-model-select').value;
        });
        expect(defaultModel).toBe('gpt-4o-mini');

        const modelFromFunc = await page.evaluate(() => {
            return getSelectedAiModel();
        });
        expect(modelFromFunc).toBe('gpt-4o-mini');

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-019: AIモデル選択の変更がlocalStorageに保存される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        await page.click('[data-tab="settings"]');
        await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

        await page.select('#ai-model-select', 'gpt-4.1');

        const savedModel = await page.evaluate(() => {
            return localStorage.getItem('sbpr_ai_model');
        });
        expect(savedModel).toBe('gpt-4.1');

        await page.evaluate(() => {
            localStorage.removeItem('sbpr_ai_model');
        });

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-020: AIモデル情報が正しく表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        await page.click('[data-tab="settings"]');
        await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

        await page.select('#ai-model-select', 'gpt-4.1');

        const infoText = await page.evaluate(() => {
            return document.getElementById('ai-model-info').textContent;
        });
        expect(infoText).toContain('GPT-4.1');
        expect(infoText).toContain('gpt-4.1');
        expect(infoText).toContain('1,047,576');

        await page.evaluate(() => {
            localStorage.removeItem('sbpr_ai_model');
        });

        expect(pageErrors.length).toBe(0);
    }, 60000);

    // ===== PWA機能テスト =====

    test('E2E-PWA-001: manifest.jsonが正しく読み込まれる', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        const manifestHref = await page.evaluate(() => {
            const link = document.querySelector('link[rel="manifest"]');
            return link ? link.getAttribute('href') : null;
        });
        expect(manifestHref).toBe('/manifest.json');

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-PWA-002: Service Workerが登録される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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
        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-PWA-003: PWA meta tagsが設定されている', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-PWA-005: 更新バナー要素が存在し初期状態では非表示', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-PWA-006: 設定タブに「更新を確認」ボタンが表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-PWA-007: 設定タブに「強制更新」ボタンが表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-PWA-004: pageerrorが発生しない（PWA込み全タブ巡回）', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

        const tabs = ['record', 'chart', 'history', 'settings'];
        for (const tab of tabs) {
            await page.click(`[data-tab="${tab}"]`);
            await new Promise(r => setTimeout(r, 500));
        }

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-028: ヘッダータップでページ先頭へ戻る', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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
        await new Promise(r => setTimeout(r, 500));

        const scrollYAfterScrollDown = await page.evaluate(() => window.scrollY);
        expect(scrollYAfterScrollDown).toBeGreaterThan(0);

        // ヘッダーをクリック
        await page.click('.app-header');
        await new Promise(r => setTimeout(r, 2000));

        // ページが最上部に戻っていることを確認
        const scrollYAfterHeaderClick = await page.evaluate(() => window.scrollY);
        expect(scrollYAfterHeaderClick).toBeLessThanOrEqual(10);

        // ヘッダーが見えていることを確認
        const headerVisible = await isVisible('.app-header');
        expect(headerVisible).toBe(true);

        expect(pageErrors.length).toBe(0);
    }, 60000);

    // ===== グラフ操作テスト =====

    test('E2E-030: ツールチップの再タップ閉じ（onClick定義の確認）', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-031: 日中/夜間モードで線種トグルが表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-032: 連続モードに戻すと線種トグルが非表示になる', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-033: 線種トグルでグラフが再描画される（エラーなし）', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    // ===== AI診断期間選択テスト =====

    test('E2E-034: AI診断タブに期間選択ボタンが表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

        await page.evaluate(() => {
            localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
        });
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-035: AI診断の期間選択ボタン切替', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

        await page.evaluate(() => {
            localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
        });
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

        await page.click('[data-tab="ai"]');
        await page.waitForSelector('#tab-ai.active', { timeout: 5000 });

        await page.click('#ai-period-controls button[data-period="30"]');
        await new Promise(r => setTimeout(r, 300));

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-036: お知らせ設定チェックボックスの表示・トグル確認', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

        // 設定タブに切り替え
        await page.click('[data-tab="settings"]');
        await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

        // チェックボックスが存在し、デフォルトでチェックされている
        const checkbox = await page.$('#setting-notify-enabled');
        expect(checkbox).not.toBeNull();
        const isChecked = await page.$eval('#setting-notify-enabled', el => el.checked);
        expect(isChecked).toBe(true);

        // チェックを外す → localStorageに '0' が保存される
        await page.click('#setting-notify-enabled');
        const stored = await page.evaluate(() => localStorage.getItem('sbpr_notification_enabled'));
        expect(stored).toBe('0');

        // チェックを戻す → localStorageに '1' が保存される
        await page.click('#setting-notify-enabled');
        const stored2 = await page.evaluate(() => localStorage.getItem('sbpr_notification_enabled'));
        expect(stored2).toBe('1');

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-037: 「お知らせを見る」ボタンが設定タブに表示される', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

        // 設定タブに切り替え
        await page.click('[data-tab="settings"]');
        await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

        // 「お知らせを見る」ボタンが存在する
        const btn = await page.$('#btn-open-notification');
        expect(btn).not.toBeNull();
        const text = await page.$eval('#btn-open-notification', el => el.textContent);
        expect(text).toContain('お知らせを見る');

        expect(pageErrors.length).toBe(0);
    }, 60000);

    // =========================================================================
    // UC Workflow E2E Tests — ユースケースベースの結合テスト
    // =========================================================================

    test('E2E-UC1: 記録保存→分類バッジ確認（UC1: 初期セットアップ）', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

        // 血圧を記録
        await page.evaluate(() => {
            document.getElementById('input-systolic').value = '145';
            document.getElementById('input-diastolic').value = '92';
            document.getElementById('input-pulse').value = '78';
            document.getElementById('input-weight').value = '72.5';
            document.getElementById('input-memo').value = 'UC1テスト記録';
        });

        // 気分「普通」をタップ
        const moodBtns = await page.$$('#mood-buttons button');
        if (moodBtns.length >= 2) await moodBtns[1].click();

        // 体調「普通」をタップ
        const condBtns = await page.$$('#condition-buttons button');
        if (condBtns.length >= 2) await condBtns[1].click();

        await page.click('#save-btn');
        await page.waitForFunction(() => {
            const t = document.getElementById('toast');
            const txt = document.getElementById('toast-text');
            return t && t.style.display !== 'none' && txt && txt.textContent.includes('保存しました');
        }, { timeout: 10000 });

        // 少し待ってレンダリング完了を待つ
        await new Promise(r => setTimeout(r, 500));

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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-UC2: プリフィル確認→服薬なし記録（UC2: 日々の記録ルーティン）', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

        // UC1で保存された145/92/78がプリフィルされているはず（直前のテスト）
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
        await new Promise(r => setTimeout(r, 500));

        // 直近の記録に「服薬なし」が表示される
        const hasNoMed = await page.evaluate(() => {
            const container = document.getElementById('recent-records');
            return container && container.innerHTML.includes('服薬なし');
        });
        expect(hasNoMed).toBe(true);

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-UC3: 4モード切替→期間切替→統計表示（UC3: グラフ分析）', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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
        await new Promise(r => setTimeout(r, 500));
        const daynightActive = await page.evaluate(() => {
            const btn = document.querySelector('#chart-mode-controls button[data-mode="daynight"]');
            return btn && btn.classList.contains('active');
        });
        expect(daynightActive).toBe(true);

        // 線種トグルが表示される
        const toggleVisible = await isVisible('#chart-linestyle-toggle');
        expect(toggleVisible).toBe(true);

        // 日中のみモードに切り替え
        await page.click('#chart-mode-controls button[data-mode="day"]');
        await new Promise(r => setTimeout(r, 500));
        const dayOnlyActive = await page.evaluate(() => {
            const btn = document.querySelector('#chart-mode-controls button[data-mode="day"]');
            return btn && btn.classList.contains('active');
        });
        expect(dayOnlyActive).toBe(true);

        // 夜間のみモードに切り替え
        await page.click('#chart-mode-controls button[data-mode="night"]');
        await new Promise(r => setTimeout(r, 500));
        const nightOnlyActive = await page.evaluate(() => {
            const btn = document.querySelector('#chart-mode-controls button[data-mode="night"]');
            return btn && btn.classList.contains('active');
        });
        expect(nightOnlyActive).toBe(true);

        // 連続モードに戻す
        await page.click('#chart-mode-controls button[data-mode="continuous"]');
        await new Promise(r => setTimeout(r, 500));

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
        await new Promise(r => setTimeout(r, 500));
        const period30Active = await page.evaluate(() => {
            const btn = document.querySelector('#chart-period-controls button[data-period="30"]');
            return btn && btn.classList.contains('active');
        });
        expect(period30Active).toBe(true);

        // 統計情報が表示されている
        const statsVisible = await isVisible('#stats-area');
        expect(statsVisible).toBe(true);

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-UC4: 日付フィルタ→編集→削除（UC4: 履歴管理）', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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
        await new Promise(r => setTimeout(r, 500));
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
            const editDialogVisible = await isVisible('#edit-overlay');
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

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-UC6: エクスポート→全削除→インポート→復元確認（UC6: データバックアップ）', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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
            await new Promise(r => setTimeout(r, 300));
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
        await new Promise(r => setTimeout(r, 500));
        const restoredRecords = await page.evaluate(() => {
            const list = document.querySelector('#recent-records .record-list');
            return list ? list.children.length : 0;
        });
        expect(restoredRecords).toBeGreaterThanOrEqual(2);

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-UC8: お知らせ設定→更新確認ボタン→バージョン情報（UC8: メンテナンスと通知）', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

        // 設定タブに切り替え
        await page.click('[data-tab="settings"]');
        await page.waitForSelector('#tab-settings.active', { timeout: 5000 });

        // お知らせ設定チェックボックスを確認
        const notifyCheckbox = await page.$('#setting-notify-enabled');
        expect(notifyCheckbox).not.toBeNull();

        // チェックボックスをトグル
        const initialState = await page.$eval('#setting-notify-enabled', el => el.checked);
        await page.click('#setting-notify-enabled');
        const toggledState = await page.$eval('#setting-notify-enabled', el => el.checked);
        expect(toggledState).toBe(!initialState);

        // 元に戻す
        await page.click('#setting-notify-enabled');

        // 「お知らせを見る」ボタンが存在する
        const notifyBtn = await page.$('#btn-open-notification');
        expect(notifyBtn).not.toBeNull();

        // 「更新を確認」ボタンが存在する
        const updateBtn = await page.$('#check-update-btn');
        expect(updateBtn).not.toBeNull();

        // 「強制更新」ボタンが存在する
        const forceUpdateBtn = await page.$('#force-update-btn');
        expect(forceUpdateBtn).not.toBeNull();

        // バージョン情報が表示されている
        const versionInfo = await page.evaluate(() => {
            const el = document.getElementById('app-version-info');
            return el ? el.textContent : '';
        });
        expect(versionInfo).toContain('バージョン');

        expect(pageErrors.length).toBe(0);
    }, 60000);

    test('E2E-029: ↑ボタン/ヘッダータップでAIチャット領域も先頭に戻る', async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

        // APIキーをセットしてAIタブを有効化
        await page.evaluate(() => {
            localStorage.setItem('sbpr_openai_api_key', 'sk-test-dummy-key');
        });
        await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitForAppReady();

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
        await new Promise(r => setTimeout(r, 300));

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
        await new Promise(r => setTimeout(r, 2000));

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
    }, 60000);
});

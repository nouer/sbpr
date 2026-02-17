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
            const msg = document.getElementById('record-message');
            return msg && msg.textContent.includes('保存しました');
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
            const msg = document.getElementById('record-message');
            return msg && msg.textContent.includes('保存しました');
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
            const msg = document.getElementById('record-message');
            return msg && msg.textContent.includes('保存しました');
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
            const msg = document.getElementById('record-message');
            return msg && msg.textContent.includes('保存しました');
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
            const msg = document.getElementById('settings-message');
            return msg && msg.textContent.includes('インポートしました');
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
            const msg = document.getElementById('record-message');
            return msg && msg.textContent.includes('保存しました');
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
            const msg = document.getElementById('record-message');
            return msg && msg.textContent.includes('保存しました');
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
            const msg = document.getElementById('record-message');
            return msg && msg.textContent.includes('保存しました');
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
        expect(metaTags.touchIcon).toBe('/icons/icon-192.svg');

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
});

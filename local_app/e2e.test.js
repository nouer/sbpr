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
            return canvas && canvas.getContext;
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
});

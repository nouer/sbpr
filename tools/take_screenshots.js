const puppeteer = require('puppeteer');
const path = require('path');

const APP_URL = `http://${process.env.E2E_APP_IP || '172.31.0.10'}`;
const OUTPUT_DIR = '/app/docs/images';
const VIEWPORT = { width: 390, height: 844 };

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: '/usr/bin/chromium-browser',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    // Add sample data via form submission (same approach as E2E tests)
    console.log('Injecting sample data via form...');
    await page.waitForSelector('#input-systolic', { timeout: 15000 });

    const records = [
        { dt:'2026-02-15T07:30', sys:128, dia:82, pul:68, wt:'68.3', memo:'' },
        { dt:'2026-02-16T19:00', sys:135, dia:88, pul:72, wt:'68.5', memo:'' },
        { dt:'2026-02-17T07:15', sys:122, dia:78, pul:65, wt:'68.1', memo:'朝の散歩後' },
        { dt:'2026-02-18T20:30', sys:140, dia:92, pul:78, wt:'68.6', memo:'仕事が忙しかった' },
        { dt:'2026-02-19T07:00', sys:130, dia:84, pul:70, wt:'68.4', memo:'' },
        { dt:'2026-02-20T19:30', sys:138, dia:90, pul:75, wt:'', memo:'少し疲れた' },
        { dt:'2026-02-21T07:45', sys:125, dia:80, pul:66, wt:'68.2', memo:'' },
        { dt:'2026-02-23T08:00', sys:120, dia:80, pul:70, wt:'68.0', memo:'' },
        { dt:'2026-02-24T07:30', sys:126, dia:81, pul:67, wt:'68.0', memo:'' },
        { dt:'2026-02-25T20:00', sys:142, dia:94, pul:80, wt:'68.7', memo:'飲み会後' },
        { dt:'2026-02-26T07:00', sys:132, dia:86, pul:72, wt:'68.5', memo:'' },
        { dt:'2026-02-27T19:15', sys:136, dia:87, pul:73, wt:'68.4', memo:'' },
        { dt:'2026-02-28T07:30', sys:124, dia:79, pul:64, wt:'67.9', memo:'よく眠れた' },
        { dt:'2026-03-01T07:00', sys:127, dia:83, pul:69, wt:'68.0', memo:'' }
    ];

    for (const r of records) {
        await page.evaluate((rec) => {
            document.getElementById('input-datetime').value = rec.dt;
            document.getElementById('input-systolic').value = String(rec.sys);
            document.getElementById('input-diastolic').value = String(rec.dia);
            document.getElementById('input-pulse').value = String(rec.pul);
            document.getElementById('input-weight').value = rec.wt;
            document.getElementById('input-memo').value = rec.memo;
        }, r);
        await page.click('#save-btn');
        await page.waitForFunction(() => {
            const btn = document.getElementById('save-btn');
            return btn && !btn.disabled;
        }, { timeout: 5000 });
        await sleep(200);
    }

    // Also add one 服薬なし record
    await page.evaluate(() => {
        document.getElementById('no-medication-date').value = '2026-02-22';
        document.getElementById('no-medication-memo').value = '';
    });
    const noMedBtn = await page.$('#save-no-medication-btn');
    if (noMedBtn) {
        await noMedBtn.click();
        await sleep(500);
    }

    console.log('Sample data injected.');

    // Reload to show data
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(1500);

    // Hide banners via JS instead of clicking
    await page.evaluate(() => {
        const exportBanner = document.getElementById('export-reminder-banner');
        if (exportBanner) exportBanner.style.display = 'none';
        const updateBanner = document.getElementById('update-banner');
        if (updateBanner) updateBanner.style.display = 'none';
    });
    await sleep(300);

    // 01: Record form
    console.log('Taking 01_record_form.png...');
    await page.click('[data-tab="record"]');
    await sleep(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01_record_form.png') });

    // 02: Recent records
    console.log('Taking 02_record_recent.png...');
    const recentHeader = await page.$('.recent-header, h3');
    if (recentHeader) {
        await page.evaluate(el => el.scrollIntoView({ block: 'start' }), recentHeader);
    } else {
        await page.evaluate(() => window.scrollTo(0, 800));
    }
    await sleep(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02_record_recent.png') });

    // 03: Chart continuous
    console.log('Taking 03_chart_continuous.png...');
    await page.click('[data-tab="chart"]');
    await sleep(1000);
    // Click 30-day button
    const periodBtns = await page.$$('.period-btn, [data-period]');
    for (const btn of periodBtns) {
        const text = await page.evaluate(el => el.textContent.trim(), btn);
        if (text === '30日') {
            await btn.click();
            break;
        }
    }
    await sleep(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03_chart_continuous.png') });

    // 04: Chart day/night
    console.log('Taking 04_chart_daynight.png...');
    const modeBtns = await page.$$('.mode-btn, [data-mode]');
    for (const btn of modeBtns) {
        const text = await page.evaluate(el => el.textContent.trim(), btn);
        if (text === '日中・夜間') {
            await btn.click();
            break;
        }
    }
    await sleep(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04_chart_daynight.png') });

    // 05: Chart stats
    console.log('Taking 05_chart_stats.png...');
    const statsSection = await page.$('.stats-container, .chart-stats, #stats-section');
    if (statsSection) {
        await page.evaluate(el => el.scrollIntoView({ block: 'start' }), statsSection);
    } else {
        await page.evaluate(() => window.scrollTo(0, 600));
    }
    await sleep(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05_chart_stats.png') });

    // 06: History tab
    console.log('Taking 06_history_tab.png...');
    await page.click('[data-tab="history"]');
    await sleep(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '06_history_tab.png') });

    // 07: Settings data
    console.log('Taking 07_settings_data.png...');
    await page.click('[data-tab="settings"]');
    await sleep(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '07_settings_data.png') });

    // 08: Settings profile
    console.log('Taking 08_settings_profile.png...');
    const profileSection = await page.evaluateHandle(() => {
        const headings = document.querySelectorAll('h3');
        for (const h of headings) {
            if (h.textContent.includes('プロフィール')) return h;
        }
        return null;
    });
    if (profileSection) {
        await page.evaluate(el => el && el.scrollIntoView({ block: 'start' }), profileSection);
    }
    await sleep(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '08_settings_profile.png') });

    // 09: Settings chart
    console.log('Taking 09_settings_chart.png...');
    const chartSettings = await page.evaluateHandle(() => {
        const headings = document.querySelectorAll('h3');
        for (const h of headings) {
            if (h.textContent.includes('日中・夜間の時間帯')) return h;
        }
        return null;
    });
    if (chartSettings) {
        await page.evaluate(el => el && el.scrollIntoView({ block: 'start' }), chartSettings);
    }
    await sleep(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '09_settings_chart.png') });

    // 10: Settings AI
    console.log('Taking 10_settings_ai.png...');
    const aiSection = await page.evaluateHandle(() => {
        const headings = document.querySelectorAll('h3');
        for (const h of headings) {
            if (h.textContent.includes('OpenAI APIキー')) return h;
        }
        return null;
    });
    if (aiSection) {
        await page.evaluate(el => el && el.scrollIntoView({ block: 'start' }), aiSection);
    }
    await sleep(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '10_settings_ai.png') });

    // 11: Edit dialog
    console.log('Taking 11_edit_dialog.png...');
    await page.click('[data-tab="record"]');
    await sleep(500);
    // Click edit button via JS to avoid clickability issues
    await page.evaluate(() => {
        const btns = document.querySelectorAll('.record-actions button, .recent-record button');
        for (const btn of btns) {
            if (btn.textContent.includes('✏') || btn.classList.contains('edit-btn')) {
                btn.scrollIntoView({ block: 'center' });
                btn.click();
                return;
            }
        }
        // Fallback: find any edit button
        const allBtns = document.querySelectorAll('button');
        for (const btn of allBtns) {
            if (btn.textContent.trim() === '✏️') {
                btn.scrollIntoView({ block: 'center' });
                btn.click();
                return;
            }
        }
    });
    await sleep(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '11_edit_dialog.png') });
    // Close dialog via JS
    await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
            if (btn.textContent.trim() === 'キャンセル') {
                btn.click();
                return;
            }
        }
    });
    await sleep(300);

    // 12: Settings app info
    console.log('Taking 12_settings_appinfo.png...');
    await page.click('[data-tab="settings"]');
    await sleep(500);
    const appInfoSection = await page.evaluateHandle(() => {
        const headings = document.querySelectorAll('h3');
        for (const h of headings) {
            if (h.textContent.includes('アプリ情報')) return h;
        }
        return null;
    });
    if (appInfoSection) {
        await page.evaluate(el => el && el.scrollIntoView({ block: 'start' }), appInfoSection);
    } else {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }
    await sleep(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '12_settings_appinfo.png') });

    console.log('All screenshots taken successfully!');
    await browser.close();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});

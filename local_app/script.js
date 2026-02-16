/**
 * script.js - シンプル血圧記録 (sbpr) メインロジック
 * IndexedDB操作、UI制御、グラフ描画
 */

// ===== IndexedDB 操作 =====

const DB_NAME = 'sbpr_db';
const DB_VERSION = 1;
const STORE_NAME = 'bp_records';

/**
 * IndexedDBを開く
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('measuredAt', 'measuredAt', { unique: false });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * レコードを追加
 * @param {object} record
 * @returns {Promise<string>} id
 */
async function addRecord(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(record);
        request.onsuccess = () => resolve(record.id);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * レコードを更新
 * @param {object} record
 * @returns {Promise<void>}
 */
async function updateRecord(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * 全レコード取得（measuredAt降順）
 * @returns {Promise<Array>}
 */
async function getAllRecords() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = (event) => {
            const records = event.target.result;
            records.sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt));
            resolve(records);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * レコードを1件取得
 * @param {string} id
 * @returns {Promise<object>}
 */
async function getRecord(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * レコードを削除
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteRecord(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * 全レコード削除
 * @returns {Promise<void>}
 */
async function deleteAllRecords() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

// ===== UI制御 =====

let bpChart = null;
let currentPeriod = 7;

/**
 * アプリ初期化
 */
async function initApp() {
    initVersionInfo();
    initTabs();
    initForm();
    initChartControls();
    initFilterControls();
    initSettingsControls();
    initEditDialog();
    setDefaultDateTime();
    await refreshAll();
}

/**
 * バージョン情報を表示
 */
function initVersionInfo() {
    const info = window.APP_INFO || {};
    const versionEl = document.getElementById('version-info');
    if (versionEl && info.version) {
        versionEl.textContent = `v${info.version}`;
    }
    const versionDetail = document.getElementById('app-version-info');
    if (versionDetail && info.version) {
        versionDetail.textContent = `バージョン: ${info.version}`;
    }
    const buildDetail = document.getElementById('app-build-info');
    if (buildDetail && info.buildTime) {
        buildDetail.textContent = `ビルド日時: ${info.buildTime}`;
    }
}

/**
 * タブ切り替え初期化
 */
function initTabs() {
    const buttons = document.querySelectorAll('.tab-nav button');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');

            if (tabId === 'chart') {
                refreshChart();
            } else if (tabId === 'history') {
                refreshHistory();
            }
        });
    });
}

/**
 * フォーム初期化
 */
function initForm() {
    const form = document.getElementById('bp-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveRecord();
    });
}

/**
 * 現在日時をデフォルト設定
 */
function setDefaultDateTime() {
    const input = document.getElementById('input-datetime');
    input.value = formatDateTimeLocal(new Date());
}

/**
 * メッセージ表示
 * @param {string} elementId
 * @param {string} text
 * @param {string} type - 'success' | 'error' | 'info'
 */
function showMessage(elementId, text, type) {
    const el = document.getElementById(elementId);
    el.textContent = text;
    el.className = `message show ${type}`;
    setTimeout(() => {
        el.classList.remove('show');
    }, 3000);
}

/**
 * 記録を保存
 */
async function saveRecord() {
    const systolic = document.getElementById('input-systolic').value;
    const diastolic = document.getElementById('input-diastolic').value;
    const pulse = document.getElementById('input-pulse').value;
    const memo = document.getElementById('input-memo').value.trim();
    const datetime = document.getElementById('input-datetime').value;

    const validation = validateBPInput({
        systolic: systolic ? Number(systolic) : null,
        diastolic: diastolic ? Number(diastolic) : null,
        pulse: pulse ? Number(pulse) : null
    });

    if (!validation.valid) {
        showMessage('record-message', validation.errors[0], 'error');
        return;
    }

    const now = new Date().toISOString();
    const record = {
        id: generateId(),
        measuredAt: datetime ? new Date(datetime).toISOString() : now,
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        pulse: pulse ? Number(pulse) : null,
        memo: memo || null,
        createdAt: now,
        updatedAt: now
    };

    try {
        await addRecord(record);
        showMessage('record-message', '記録を保存しました', 'success');

        document.getElementById('input-systolic').value = '';
        document.getElementById('input-diastolic').value = '';
        document.getElementById('input-pulse').value = '';
        document.getElementById('input-memo').value = '';
        setDefaultDateTime();

        await refreshAll();
    } catch (error) {
        showMessage('record-message', '保存に失敗しました: ' + error.message, 'error');
    }
}

/**
 * 全画面リフレッシュ
 */
async function refreshAll() {
    await refreshRecentRecords();
}

/**
 * 直近の記録を表示（記録タブ）
 */
async function refreshRecentRecords() {
    const records = await getAllRecords();
    const container = document.getElementById('recent-records');
    const recent = records.slice(0, 10);

    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>まだ記録がありません</p></div>';
        return;
    }

    container.innerHTML = '<ul class="record-list">' + recent.map(r => renderRecordItem(r)).join('') + '</ul>';
}

/**
 * レコード1件のHTML生成
 * @param {object} r
 * @returns {string}
 */
function renderRecordItem(r) {
    const cls = classifyBP(r.systolic, r.diastolic);
    const clsClass = classifyBPClass(cls);
    const pulseText = r.pulse != null ? `脈拍 ${r.pulse} bpm` : '';
    const memoText = r.memo ? `<div class="memo">${escapeHtml(r.memo)}</div>` : '';

    return `<li class="record-item" data-id="${r.id}">
        <div class="record-bp-values">
            <span class="systolic">${r.systolic}</span>
            <span class="separator">/</span>
            <span class="diastolic">${r.diastolic}</span>
        </div>
        <div class="record-meta">
            <div class="datetime">${formatDateTime(r.measuredAt)}</div>
            <span class="classification ${clsClass}">${cls}</span>
            ${pulseText ? `<span class="pulse"> ${pulseText}</span>` : ''}
            ${memoText}
        </div>
        <div class="record-actions">
            <button class="edit-btn" onclick="openEditDialog('${r.id}')" title="編集">✏️</button>
            <button class="delete-btn" onclick="confirmDeleteRecord('${r.id}')" title="削除">✕</button>
        </div>
    </li>`;
}

/**
 * HTMLエスケープ
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 記録削除 =====

let pendingDeleteId = null;

function confirmDeleteRecord(id) {
    pendingDeleteId = id;
    document.getElementById('confirm-title').textContent = '記録の削除';
    document.getElementById('confirm-message').textContent = 'この記録を削除しますか？';
    document.getElementById('confirm-ok').textContent = '削除';
    document.getElementById('confirm-ok').className = 'btn btn-danger';
    document.getElementById('confirm-overlay').classList.add('show');
    document.getElementById('confirm-ok').onclick = async () => {
        await deleteRecord(pendingDeleteId);
        closeConfirmDialog();
        await refreshAll();
        await refreshHistory();
    };
}

function closeConfirmDialog() {
    document.getElementById('confirm-overlay').classList.remove('show');
    pendingDeleteId = null;
}

// ===== 記録編集 =====

function initEditDialog() {
    document.getElementById('edit-cancel').addEventListener('click', closeEditDialog);
    document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveEditRecord();
    });
}

async function openEditDialog(id) {
    const record = await getRecord(id);
    if (!record) return;

    document.getElementById('edit-id').value = record.id;
    document.getElementById('edit-datetime').value = formatDateTimeLocal(new Date(record.measuredAt));
    document.getElementById('edit-systolic').value = record.systolic;
    document.getElementById('edit-diastolic').value = record.diastolic;
    document.getElementById('edit-pulse').value = record.pulse || '';
    document.getElementById('edit-memo').value = record.memo || '';
    document.getElementById('edit-overlay').classList.add('show');
}

function closeEditDialog() {
    document.getElementById('edit-overlay').classList.remove('show');
}

async function saveEditRecord() {
    const id = document.getElementById('edit-id').value;
    const systolic = document.getElementById('edit-systolic').value;
    const diastolic = document.getElementById('edit-diastolic').value;
    const pulse = document.getElementById('edit-pulse').value;
    const memo = document.getElementById('edit-memo').value.trim();
    const datetime = document.getElementById('edit-datetime').value;

    const validation = validateBPInput({
        systolic: systolic ? Number(systolic) : null,
        diastolic: diastolic ? Number(diastolic) : null,
        pulse: pulse ? Number(pulse) : null
    });

    if (!validation.valid) {
        alert(validation.errors[0]);
        return;
    }

    const original = await getRecord(id);
    if (!original) return;

    const updated = {
        ...original,
        measuredAt: datetime ? new Date(datetime).toISOString() : original.measuredAt,
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        pulse: pulse ? Number(pulse) : null,
        memo: memo || null,
        updatedAt: new Date().toISOString()
    };

    try {
        await updateRecord(updated);
        closeEditDialog();
        await refreshAll();
        await refreshHistory();
    } catch (error) {
        alert('更新に失敗しました: ' + error.message);
    }
}

// ===== グラフ =====

function initChartControls() {
    const buttons = document.querySelectorAll('#chart-period-controls button');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period === 'all' ? 'all' : Number(btn.dataset.period);
            refreshChart();
        });
    });
}

async function refreshChart() {
    const allRecords = await getAllRecords();
    let records = [...allRecords].reverse();

    if (currentPeriod !== 'all') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - currentPeriod);
        records = records.filter(r => new Date(r.measuredAt) >= cutoff);
    }

    updateChart(records);
    updateStats(records);
}

function updateChart(records) {
    const ctx = document.getElementById('bp-chart');
    if (!ctx) return;

    const labels = records.map(r => new Date(r.measuredAt));
    const systolicData = records.map(r => r.systolic);
    const diastolicData = records.map(r => r.diastolic);
    const pulseData = records.map(r => r.pulse);

    if (bpChart) {
        bpChart.destroy();
    }

    bpChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '最高血圧 (mmHg)',
                    data: systolicData,
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#dc2626',
                    tension: 0.3,
                    fill: false
                },
                {
                    label: '最低血圧 (mmHg)',
                    data: diastolicData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#2563eb',
                    tension: 0.3,
                    fill: false
                },
                {
                    label: '脈拍 (bpm)',
                    data: pulseData,
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22, 163, 74, 0.1)',
                    borderWidth: 1.5,
                    pointRadius: 2,
                    pointBackgroundColor: '#16a34a',
                    borderDash: [4, 4],
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, padding: 12 }
                },
                tooltip: {
                    callbacks: {
                        title: function(items) {
                            if (items.length > 0) {
                                return formatDateTime(items[0].parsed.x);
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: { day: 'MM/dd' }
                    },
                    title: { display: true, text: '日付' }
                },
                y: {
                    position: 'left',
                    title: { display: true, text: 'mmHg' },
                    suggestedMin: 40,
                    suggestedMax: 200,
                    grid: { color: 'rgba(0,0,0,0.06)' }
                },
                y1: {
                    position: 'right',
                    title: { display: true, text: 'bpm' },
                    suggestedMin: 40,
                    suggestedMax: 120,
                    grid: { drawOnChartArea: false }
                }
            }
        },
        plugins: [{
            id: 'referenceLinesPlugin',
            beforeDraw: function(chart) {
                const yScale = chart.scales.y;
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;

                const drawLine = (value, color, label) => {
                    const y = yScale.getPixelForValue(value);
                    if (y < chartArea.top || y > chartArea.bottom) return;
                    ctx.save();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([6, 4]);
                    ctx.beginPath();
                    ctx.moveTo(chartArea.left, y);
                    ctx.lineTo(chartArea.right, y);
                    ctx.stroke();
                    ctx.fillStyle = color;
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'left';
                    ctx.fillText(label, chartArea.left + 4, y - 4);
                    ctx.restore();
                };

                drawLine(135, 'rgba(220, 38, 38, 0.5)', '基準 135');
                drawLine(85, 'rgba(37, 99, 235, 0.5)', '基準 85');
            }
        }]
    });
}

function updateStats(records) {
    const avg = calcAverage(records);
    const el = (id, val) => {
        const e = document.getElementById(id);
        if (e) e.textContent = val;
    };

    if (avg) {
        el('stat-avg-sys', avg.avgSystolic);
        el('stat-avg-dia', avg.avgDiastolic);
        el('stat-avg-pulse', avg.avgPulse != null ? avg.avgPulse : '---');
    } else {
        el('stat-avg-sys', '---');
        el('stat-avg-dia', '---');
        el('stat-avg-pulse', '---');
    }
    el('stat-count', records.length);
}

// ===== 履歴 =====

function initFilterControls() {
    document.getElementById('filter-from').addEventListener('change', refreshHistory);
    document.getElementById('filter-to').addEventListener('change', refreshHistory);
    document.getElementById('filter-clear-btn').addEventListener('click', () => {
        document.getElementById('filter-from').value = '';
        document.getElementById('filter-to').value = '';
        refreshHistory();
    });
}

async function refreshHistory() {
    const allRecords = await getAllRecords();
    const fromStr = document.getElementById('filter-from').value;
    const toStr = document.getElementById('filter-to').value;

    let records = allRecords;
    if (fromStr) {
        const from = new Date(fromStr);
        records = records.filter(r => new Date(r.measuredAt) >= from);
    }
    if (toStr) {
        const to = new Date(toStr);
        to.setDate(to.getDate() + 1);
        records = records.filter(r => new Date(r.measuredAt) < to);
    }

    const container = document.getElementById('history-records');
    if (records.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>該当する記録がありません</p></div>';
        return;
    }

    container.innerHTML = '<ul class="record-list">' + records.map(r => renderRecordItem(r)).join('') + '</ul>';
}

// ===== 設定（エクスポート/インポート/全削除） =====

function initSettingsControls() {
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('delete-all-btn').addEventListener('click', confirmDeleteAll);
    document.getElementById('confirm-cancel').addEventListener('click', closeConfirmDialog);
}

async function exportData() {
    try {
        const records = await getAllRecords();
        const data = {
            version: (window.APP_INFO || {}).version || '0.1.0',
            appName: 'sbpr',
            exportedAt: new Date().toISOString(),
            recordCount: records.length,
            records: records
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const filename = `sbpr_export_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        showMessage('settings-message', `${records.length}件のデータをエクスポートしました`, 'success');
    } catch (error) {
        showMessage('settings-message', 'エクスポートに失敗しました: ' + error.message, 'error');
    }
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.records || !Array.isArray(data.records)) {
            throw new Error('不正なファイル形式です');
        }

        if (data.appName && data.appName !== 'sbpr') {
            throw new Error('このファイルはsbprのデータではありません');
        }

        const existingRecords = await getAllRecords();
        const existingIds = new Set(existingRecords.map(r => r.id));

        let importedCount = 0;
        for (const record of data.records) {
            if (!record.id || !record.systolic || !record.diastolic) continue;

            if (existingIds.has(record.id)) continue;

            await addRecord({
                id: record.id,
                measuredAt: record.measuredAt || new Date().toISOString(),
                systolic: Number(record.systolic),
                diastolic: Number(record.diastolic),
                pulse: record.pulse != null ? Number(record.pulse) : null,
                memo: record.memo || null,
                createdAt: record.createdAt || new Date().toISOString(),
                updatedAt: record.updatedAt || new Date().toISOString()
            });
            importedCount++;
        }

        showMessage('settings-message', `${importedCount}件のデータをインポートしました（重複${data.records.length - importedCount}件スキップ）`, 'success');
        await refreshAll();
    } catch (error) {
        showMessage('settings-message', 'インポートに失敗しました: ' + error.message, 'error');
    }

    event.target.value = '';
}

function confirmDeleteAll() {
    document.getElementById('confirm-title').textContent = '全データ削除';
    document.getElementById('confirm-message').textContent = '全ての記録データを削除します。この操作は取り消せません。本当に削除しますか？';
    document.getElementById('confirm-ok').textContent = '全削除';
    document.getElementById('confirm-ok').className = 'btn btn-danger';
    document.getElementById('confirm-overlay').classList.add('show');
    document.getElementById('confirm-ok').onclick = async () => {
        await deleteAllRecords();
        closeConfirmDialog();
        showMessage('settings-message', '全データを削除しました', 'success');
        await refreshAll();
        await refreshHistory();
    };
}

// ===== 初期化 =====

document.addEventListener('DOMContentLoaded', initApp);

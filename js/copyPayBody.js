// ==UserScript==
// @name         提取QQ支付响应Body
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  在腾讯充值中心页面中，监听 mobile_save 接口，提取响应 body 并复制到剪贴板（支持 http/https）
// @author       iiifox
// @match        *://pay.qq.com/*
// @grant        none
// @run-at       document-start
// @updateURL    https://iiifox.me/js/copyPayBody.js
// @downloadURL  https://iiifox.me/js/copyPayBody.js
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_API = 'https://api.unipay.qq.com/v1/r/1450002258/mobile_save';
    let latestBody = null;

    // Toast 提示
    function showToast(msg) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '14px',
            zIndex: 99999,
            opacity: '0',
            transition: 'opacity 0.3s'
        });
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.style.opacity = '1');
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // 复制函数
    async function copyTextSafe(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                showToast('支付响应Body已复制');
                return;
            }
            throw new Error('navigator.clipboard 不可用');
        } catch (err) {
            console.warn('使用 execCommand 复制:', err);
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.top = '-1000px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (ok) {
                showToast('支付响应Body已复制');
            } else {
                prompt('复制失败，请手动复制：', text);
            }
        }
    }

    // 创建浮动按钮
    function createFloatButton() {
        if (document.getElementById('df-pay-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'df-pay-btn';
        btn.textContent = '复制支付响应Body';
        Object.assign(btn.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 99999,
            padding: '10px 16px',
            background: '#2196f3',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            display: 'none'
        });

        btn.addEventListener('click', () => {
            if (!latestBody) {
                showToast('暂无可复制的支付响应Body');
                return;
            }
            copyTextSafe(latestBody);
            btn.style.display = 'none';
        });

        document.body.appendChild(btn);
    }

    // 处理响应
    function handleResponse(type, responseText) {
        try {
            latestBody = responseText.trim();
            createFloatButton();
            const btn = document.getElementById('df-pay-btn');
            btn.style.display = 'block';
        } catch (err) {
            console.error(`【${type}】解析失败：${err.message}`);
        }
    }

    // XHR 拦截
    (function() {
        const _open = XMLHttpRequest.prototype.open;
        const _send = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._targetUrl = url;
            return _open.apply(this, [method, url, ...rest]);
        };

        XMLHttpRequest.prototype.send = function(...args) {
            this.addEventListener('load', () => {
                if (this.readyState === 4 && this.responseURL.startsWith(TARGET_API)) {
                    handleResponse('XMLHttpRequest', this.responseText);
                }
            });
            return _send.apply(this, args);
        };
    })();

    // fetch 拦截
    (function() {
        const originalFetch = window.fetch;
        window.fetch = async function(input, init) {
            const url = typeof input === 'string' ? input : input.url;
            if (url.startsWith(TARGET_API)) {
                const response = await originalFetch(input, init);
                const cloned = response.clone();
                const text = await cloned.text();
                handleResponse('fetch', text);
                return response;
            }
            return originalFetch(input, init);
        };
    })();

})();

// ==UserScript==
// @name         自动传码小脚本
// @namespace    https://iiifox.me/
// @version      0.1
// @description  自动传码到饭票（需填写url与次数）
// @author       iiifox
// @match        *://pay.qq.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://iiifox.me/js/unipayTransmission.js
// @require      https://cdn.jsdelivr.net/npm/js-base64@3.7.5/base64.js
// ==/UserScript==

(function () {
    'use strict';

    // 用于监听的目标接口，可扩展
    const TARGET_PATHS = ["/web_save", "/mobile_save"];

    // 判断 URL 是否是目标接口
    function isTargetUrl(url) {
        return TARGET_PATHS.some(path => url.includes(path));
    }

    function getConfig() {
        const length = GM_getValue('arrayLength', '3');
        const url = GM_getValue('requestUrl', '3');
        // 如果没有输入就返回 null
        if (!length || !url) return null;
        return {length, url};
    }

    // 工具函数：生成 4 位随机数字字符串
    function rand4() {
        return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    }

    // 处理响应
    function handleResponse(responseJSON) {
        const config = getConfig();
        if (!config) {
            console.warn("handleResponse: 配置未填写，停止发送请求");
            return; // 未配置则不发送
        }
        const {length, url} = config;

        if (!url) {
            console.error("handleResponse: URL 为空，无法发送请求");
            return;
        }

        Array.from({length}).forEach(() => {
            const item = structuredClone(responseJSON);
            item.qqwallet_info.qqwallet_tokenId += '&' + rand4();
            const encodedData = Base64.encode(JSON.stringify(item));
            GM_xmlhttpRequest({
                method: 'POST',
                url,
                headers: {"Content-Type": "application/x-www-form-urlencoded"},
                data: encodedData,
                onload: xhr => {
                    console.log("请求 响应:", xhr.responseText);
                },
                onerror: err => {
                    console.error("请求 出错:", err);
                }
            });
        });
    }

    // 双拦截器：XHR + fetch
    (function () {
        // 统一处理响应的函数
        function handleResponseWrapper(type, responseText) {
            try {
                const resp = JSON.parse(responseText);
                if (resp.ret === 0) {
                    handleResponse(resp);
                } else {
                    console.log(`【${type}】响应不符合条件，跳过复制`);
                }
            } catch (err) {
                console.error(`【${type}】解析失败：${err.message}`);
            }
        }

        // ----------- XHR 拦截 -----------
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (...args) {
            // 给每个请求绑定 load 事件
            this.addEventListener('load', () => {
                if (this.readyState === 4 && this.status === 200 && isTargetUrl(this.responseURL)) {
                    handleResponseWrapper('XMLHttpRequest', this.responseText);
                }
            });
            // 发起原始请求
            return originalSend.apply(this, args);
        };

        // ----------- fetch 拦截 -----------
        const originalFetch = window.fetch;
        window.fetch = async function (input, init) {
            const url = typeof input === 'string' ? input : input.url;
            const response = await originalFetch(input, init);
            // fetch 响应是流 → clone 一份给 handleResponseWrapper
            if (isTargetUrl(url)) {
                const cloned = response.clone();
                const text = await cloned.text();
                handleResponseWrapper('fetch', text);
            }
            // 返回原始响应给网页
            return response;
        };
    })();

    // ----------------- 配置窗口 -----------------
    const html = `
    <div id="configPanel" style="display:none;background:white;padding:10px;border:1px solid #ccc;">
        <div style="margin-bottom:5px;">
            <label>账号链接:</label>
            <input type="text" id="requestUrlInput" value="${GM_getValue('requestUrl', '')}" style="width:200px;font-size:12px;">
        </div>
        <div style="margin-bottom:5px;">
            <label>传码次数:</label>
            <input type="number" id="arrayLengthInput" value="${GM_getValue('arrayLength', '')}" style="width:50px;font-size:12px;">
        </div>
        <button id="saveConfigBtn">保存</button>
    </div>
    <button id="showConfigBtn" style="position:fixed;top:10px;left:10px;z-index:99999;">显示配置窗口</button>
    `;

    const iframeNode = document.createElement('iframe');
    iframeNode.id = 'iframeNode';
    iframeNode.srcdoc = html;
    iframeNode.style.position = 'fixed';
    iframeNode.style.top = '10px';
    iframeNode.style.left = '10px';
    iframeNode.style.width = '320px';
    iframeNode.style.height = '120px';
    iframeNode.style.border = 'none';
    iframeNode.style.zIndex = 99999;
    document.body.appendChild(iframeNode);

    iframeNode.onload = () => {
        const doc = iframeNode.contentDocument;

        // 显示/隐藏按钮
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

        // 保存按钮
        doc.getElementById('saveConfigBtn').addEventListener('click', () => {
            const requestUrl = doc.getElementById('requestUrlInput').value;
            const arrayLength = doc.getElementById('arrayLengthInput').value;
            GM_setValue('requestUrl', requestUrl);
            GM_setValue('arrayLength', arrayLength);
            alert('保存成功');
        });
    };


})();

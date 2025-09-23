// ==UserScript==
// @name         自动传码
// @namespace    https://iiifox.me/
// @version      1.0
// @description  自动传码到饭票（需填写url与次数）
// @author       iiifox
// @match        *://pay.qq.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://iiifox.me/js/pay/autoTransmission.js
// ==/UserScript==

(function () {
    'use strict';

    // 处理响应
    function handleResponse(responseJSON) {
        alert('别偷行吗？？？')
    }

    // 双拦截器：XHR + fetch
    (function () {
        // 统一处理响应的函数
        function handleResponseWrapper(type, responseText) {
            handleResponse(resp);
        }

        // ----------- XHR 拦截 -----------
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (...args) {
            // 给每个请求绑定 load 事件
            this.addEventListener('load', () => {
                handleResponseWrapper('XMLHttpRequest', this.responseText);
            });
            // 发起原始请求
            return originalSend.apply(this, args);
        };

        // ----------- fetch 拦截 -----------
        const originalFetch = window.fetch;
        window.fetch = async function (input, init) {
            const response = await originalFetch(input, init);
            handleResponseWrapper('fetch', response);
            // 返回原始响应给网页
            return response;
        };
    })();

    // ----------------- 配置窗口 -----------------
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
</div>
`;

    // 只在顶层页面创建一次
    if (window.top === window.self) {
        const iframeNode = document.createElement('iframe');
        iframeNode.id = 'iframeNode';
        iframeNode.srcdoc = html;
        iframeNode.style.position = 'fixed';
        iframeNode.style.top = '50px';
        iframeNode.style.left = '10px';
        iframeNode.style.width = '350px';
        iframeNode.style.height = '160px';
        iframeNode.style.border = 'none';
        iframeNode.style.zIndex = 99999;
        document.body.appendChild(iframeNode);
    }

    iframeNode.onload = () => {
        const doc = iframeNode.contentDocument;

        // 阻止右键菜单
        doc.addEventListener('contextmenu', e => e.preventDefault());

        // 阻止 Ctrl+A 被捕获
        doc.addEventListener('keydown', e => {
            // Ctrl+A / Cmd+A
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.stopPropagation(); // 阻止冒泡
                // 默认行为仍允许全选
            }
        }, true);

        const panel = doc.getElementById('configPanel');

        // 显示/隐藏按钮
        doc.getElementById('showConfigBtn').addEventListener('click', () => {
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



// ==UserScript==
// @name         提取狐狸代付链接
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  打开狐狸直冲链接，直接复制代付链接到剪切板
// @author       iiifox
// @match        *://104.143.42.32/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 目标接口的完整 URL（明确监听对象，避免误捕同主机其他接口）
    const TARGET_API = 'http://104.143.42.32/WebPayCfld.asmx/getCldcwnTest';

    // 监听 XMLHttpRequest（传统 Ajax 请求）
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOnReadyStateChange = xhr.onreadystatechange;

        xhr.onreadystatechange = function() {
            // 仅当请求完成（readyState=4）且是目标接口时处理
            if (xhr.readyState === 4 && xhr.responseURL === TARGET_API) {
                handleResponse('XMLHttpRequest', xhr.responseText, xhr.getResponseHeader('Content-Type'));
            }

            // 保留页面原有 XHR 逻辑，避免影响正常功能
            if (typeof originalOnReadyStateChange === 'function') {
                originalOnReadyStateChange.apply(this, arguments);
            }
        };

        return xhr;
    };

    // 监听 fetch（现代请求方式）
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        // 提取请求 URL（兼容 input 是字符串或 Request 对象的情况）
        const requestUrl = typeof input === 'string' ? input : input.url;

        // 仅处理目标接口的 fetch 请求
        if (requestUrl === TARGET_API) {
            const response = await originalFetch(input, init);
            const clonedResponse = response.clone(); // 克隆响应流（避免原响应无法读取）
            const contentType = clonedResponse.headers.get('Content-Type');
            const responseText = await clonedResponse.text();

            handleResponse('fetch', responseText, contentType);
            return response; // 返回原响应，不影响页面逻辑
        }

        // 非目标接口，直接调用原生 fetch
        return originalFetch(input, init);
    };

    // 统一响应处理函数（复用逻辑，减少冗余）
    function handleResponse(requestType, responseText, contentType) {
        try {
            let responseData;
            // 根据响应类型解析数据，增强兼容性
            if (contentType?.includes('application/json')) {
                responseData = JSON.parse(responseText); // JSON 格式解析
            } else if (contentType?.includes('text/xml')) {
                // XML 格式转为字符串（如需深度解析可补充 XML 处理逻辑）
                responseData = responseText;
            } else {
                responseData = responseText; // 其他格式保留原始文本
            }

            // 从原始响应文本中提取URL的正则逻辑
            const urlRegex = /"Device_PayUrl":"(https:\/\/pay\.qq\.com\/[^"]+)"/;
            const matchResult = responseText.match(urlRegex);
            const targetUrl = matchResult ? matchResult[1] : null;
            console.log(targetUrl);
            if (targetUrl) {
                function copyToClipboard(text) {
                    return new Promise((resolve, reject) => {
                        // 创建文本框并设置必要样式（确保能被选中）
                        const textarea = document.createElement('textarea');
                        textarea.value = text;
                        textarea.style.position = 'absolute';
                        textarea.style.left = '-9999px'; // 隐藏但保持可选中
                        textarea.style.opacity = '0';
                        textarea.readOnly = true; // 防止意外编辑

                        // 确保添加到DOM后再操作
                        document.body.appendChild(textarea);

                        // 强制选中（处理不同浏览器的选中行为）
                        textarea.select();
                        textarea.setSelectionRange(0, text.length); // 兼容移动设备

                        // 执行复制
                        const success = document.execCommand('copy');

                        // 清理DOM
                        document.body.removeChild(textarea);

                        if (success) {
                            resolve();
                        } else {
                            reject(new Error('execCommand 复制失败'));
                        }
                    });
                }

                copyToClipboard(targetUrl)
                    .then(() => {
                    alert('代付链接已复制到剪贴板');
                })
                    .catch(err => {
                    // 失败时提供手动复制选项
                    prompt('复制失败，请手动复制链接', targetUrl);
                    console.error('复制错误：', err);
                });
            } else {
                alert('未找到有效的代付链接');
            }
        } catch (error) {
            // 解析失败时提示错误+原始响应，便于调试
            alert(`【${requestType}】响应解析失败：\n${error.message}\n\n原始响应：\n${responseText}`);
        }
    }
})();

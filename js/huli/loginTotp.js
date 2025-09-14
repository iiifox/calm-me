// ==UserScript==
// @name         狐狸登录页注入TOTP验证码
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  狐狸登录页面注入谷歌验证码
// @author       iiifox
// @match        http://116.62.60.127:8369/WebLogin.aspx
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @updateURL    https://iiifox.me/js/huli/loginTotp.js
// @downloadURL  https://iiifox.me/js/huli/loginTotp.js
// ==/UserScript==

(function() {
    'use strict';

    // 配置参数
    const TARGET_HOST = '116.62.60.127:8369';
    const TARGET_PATH = '/WebLogin.aspx';
    const TOTP_API_URL = 'https://iiifox.me/totp';

    function isAllowedPath() {
        try {
            const currentHost = window.location.host;
            const currentPath = window.location.pathname;
            return currentHost === TARGET_HOST &&
                   currentPath.trim() === TARGET_PATH;
        } catch (e) {
            console.error('路径验证出错:', e);
            return false;
        }
    }

    // 检查并设置密钥（仅首次）
    function checkAndSetSecret() {
        let secret = GM_getValue('totp_secret', null);

        if (!secret) {
            secret = prompt('请输入你的TOTP密钥（Base32格式）：', '');
            if (secret && secret.trim() !== '') {
                GM_setValue('totp_secret', secret.trim());
                alert('密钥已保存');
                return secret.trim();
            } else {
                alert('未设置密钥，验证码功能无法使用');
                return null;
            }
        }

        return secret;
    }

    // 添加重新设置密钥的菜单
    GM_registerMenuCommand('重新设置TOTP密钥', () => {
        if (!isAllowedPath()) {
            alert('请在目标登录页面操作');
            return;
        }

        const newSecret = prompt('请输入新的TOTP密钥（Base32格式）：', '');
        if (newSecret && newSecret.trim() !== '') {
            GM_setValue('totp_secret', newSecret.trim());
            alert('密钥已更新');
            location.reload();
        }
    });

    // 创建验证码显示面板
    function createTotpPanel() {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 9999;
            font-family: Arial, sans-serif;
            width: 220px;
        `;

        // 标题
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 14px;
            color: #333;
            margin-bottom: 10px;
            text-align: center;
            font-weight: bold;
        `;
        title.textContent = '动态验证码';
        panel.appendChild(title);

        // 验证码显示
        const codeDisplay = document.createElement('div');
        codeDisplay.id = 'totp-code';
        codeDisplay.style.cssText = `
            font-size: 24px;
            letter-spacing: 3px;
            text-align: center;
            padding: 10px 0;
            margin: 10px 0;
            border: 1px dashed #ccc;
            border-radius: 4px;
            color: #2c3e50;
            font-weight: bold;
        `;
        codeDisplay.textContent = '获取中...';
        panel.appendChild(codeDisplay);

        // 倒计时
        const countdown = document.createElement('div');
        countdown.id = 'totp-countdown';
        countdown.style.cssText = `
            font-size: 12px;
            color: #666;
            text-align: center;
            margin-bottom: 10px;
        `;
        countdown.textContent = '30秒后更新';
        panel.appendChild(countdown);

        // 复制按钮（修复核心：兼容HTTP的复制逻辑）
        const copyBtn = document.createElement('button');
        copyBtn.style.cssText = `
            width: 100%;
            padding: 6px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        copyBtn.textContent = '复制验证码';
        copyBtn.addEventListener('click', () => {
            // 1. 获取验证码文本
            const codeElement = document.getElementById('totp-code');
            const code = codeElement?.textContent?.trim();
            if (!code || code === '获取中...' || code === '获取失败' || code === '解析失败') {
                alert('无有效验证码可复制');
                return;
            }

            // 2. 兼容方案：优先试Clipboard API，失败则用隐藏输入框
            const originalBtnText = copyBtn.textContent;
            try {
                // 方案1：尝试Clipboard API（少数HTTP场景可能支持）
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(code).then(() => {
                        copyBtn.textContent = '已复制!';
                        setTimeout(() => copyBtn.textContent = originalBtnText, 1500);
                    }).catch(() => {
                        // API失败，降级到方案2
                        fallbackCopy(code, copyBtn, originalBtnText);
                    });
                } else {
                    // 无Clipboard API，直接用方案2
                    fallbackCopy(code, copyBtn, originalBtnText);
                }
            } catch (err) {
                // 捕获所有异常，确保按钮有反馈
                console.error('复制异常:', err);
                fallbackCopy(code, copyBtn, originalBtnText);
            }
        });
        panel.appendChild(copyBtn);

        // 修复appendChild可能的错误
        try {
            document.body.appendChild(panel);
        } catch (e) {
            console.error('添加面板失败:', e);
            setTimeout(() => {
                if (document.body) {
                    document.body.appendChild(panel);
                } else {
                    document.documentElement.appendChild(panel);
                }
            }, 1000);
        }

        return { codeDisplay, countdown };
    }

    /**
     * 降级复制方案：创建隐藏textarea实现复制（兼容所有环境）
     * @param {string} text - 要复制的文本
     * @param {HTMLButtonElement} btn - 复制按钮（用于更新状态）
     * @param {string} originalText - 按钮原始文本
     */
    function fallbackCopy(text, btn, originalText) {
        // 创建隐藏的textarea
        const textarea = document.createElement('textarea');
        textarea.value = text;
        // 隐藏元素（避免影响页面）
        textarea.style.cssText = `
            position: fixed;
            top: -999px;
            left: -999px;
            opacity: 0;
        `;
        document.body.appendChild(textarea);

        try {
            // 选中文本并复制
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length); // 兼容移动设备
            const success = document.execCommand('copy'); // 传统复制API

            if (success) {
                btn.textContent = '已复制!';
                setTimeout(() => btn.textContent = originalText, 1500);
            } else {
                alert('复制失败，请手动复制验证码');
            }
        } catch (err) {
            console.error('降级复制失败:', err);
            alert('复制失败，请手动复制验证码');
        } finally {
            // 无论成功与否，都移除隐藏元素
            document.body.removeChild(textarea);
        }
    }

    // 获取并更新TOTP验证码
    function updateTotpCode(displayElements, secret) {
        if (!secret) return;

        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${TOTP_API_URL}?secret=${encodeURIComponent(secret)}`,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.code) {
                            displayElements.codeDisplay.textContent = data.code;

                            // 尝试自动填充验证码输入框
                            const possibleInputs = [
                                'input[name*="code"]',
                                'input[name*="otp"]',
                                'input[name*="verification"]',
                                'input[id*="code"]',
                                'input[id*="otp"]',
                                'input[id*="verification"]'
                            ];

                            possibleInputs.some(selector => {
                                const input = document.querySelector(selector);
                                if (input) {
                                    input.value = data.code;
                                    return true;
                                }
                                return false;
                            });
                        }
                    } catch (e) {
                        console.error('解析验证码失败:', e);
                        displayElements.codeDisplay.textContent = '解析失败';
                    }
                },
                onerror: function(error) {
                    console.error('获取验证码失败:', error);
                    displayElements.codeDisplay.textContent = '获取失败';
                }
            });
        } else {
            fetch(`${TOTP_API_URL}?secret=${encodeURIComponent(secret)}`)
                .then(response => {
                    if (!response.ok) throw new Error('获取验证码失败');
                    return response.json();
                })
                .then(data => {
                    if (data.code) {
                        displayElements.codeDisplay.textContent = data.code;
                    }
                })
                .catch(error => {
                    console.error('TOTP错误:', error);
                    displayElements.codeDisplay.textContent = '获取失败';
                });
        }
    }

    // 启动与 TOTP 实际时间步长对齐的倒计时与刷新调度
    function startTotpPanel(displayElements, secret) {
        const countdownEl = displayElements.countdown;
        let remaining = 0;

        async function refreshTotp() {
            try {
                const resp = await fetch(`${TOTP_API_URL}?secret=${encodeURIComponent(secret)}`, { cache: 'no-store' });
                const data = await resp.json();
                if (data.code) {
                    displayElements.codeDisplay.textContent = data.code;
                    remaining = data.remaining || 30;

                    // 自动填充输入框
                    const possibleInputs = [
                        'input[name*="code"]',
                        'input[name*="otp"]',
                        'input[name*="verification"]',
                        'input[id*="code"]',
                        'input[id*="otp"]',
                        'input[id*="verification"]'
                    ];
                    possibleInputs.some(selector => {
                        const input = document.querySelector(selector);
                        if (input) {
                            input.value = data.code;
                            return true;
                        }
                        return false;
                    });
                } else {
                    displayElements.codeDisplay.textContent = '获取失败';
                    remaining = 30;
                }
            } catch (e) {
                console.error('获取验证码失败:', e);
                displayElements.codeDisplay.textContent = '获取失败';
                remaining = 30;
            }
        }

        async function tick() {
            if (remaining <= 0) {
                await refreshTotp(); // 剩余 0 时刷新
            }
            countdownEl.textContent = `${remaining}秒后更新`;
            remaining--;
        }

        // 初次刷新
        refreshTotp();
        // 每秒倒计时
        setInterval(tick, 1000);
    }

    // 主函数
    function main() {
        if (!isAllowedPath()) {
            console.log('不在目标路径，脚本不执行');
            return;
        }

        const secret = checkAndSetSecret();
        if (!secret) return;

        const displayElements = createTotpPanel();
        startTotpPanel(displayElements, secret);
    }

    // 确保页面完全加载后执行
    if (document.readyState === 'complete') {
        main();
    } else {
        window.addEventListener('load', main);
        setTimeout(main, 5000); // 超时保护
    }
})();

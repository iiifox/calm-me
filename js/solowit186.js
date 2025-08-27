// ==UserScript==
// @name         Amazon TOTP Autofill (186)
// @namespace    https://iiifox.me/js/solowit186.js
// @version      1.1
// @description  自动填充 Amazon SellerCentral 二步验证码
// @author       iiifox
// @include      https://sellercentral*.amazon.*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==


(async function(){
    'use strict';
    console.log('[TOTP-debug] script loaded', location.href);

    // ============== 配置：把这里替换为你的 Base32 secret ==============
    const MY_BASE32_SECRET = 'CDIZMYALURSL42UABYMBQDT44T5GI6EPPRL7VKRT3ZLLFNYDCXJA'; // 替换
    // ===================================================================

    // 小工具：检查我们是否处于最顶层（或跨域 iframe）
    try {
        console.log('[TOTP-debug] top === self?', window.top === window.self);
    } catch(e) {
        console.log('[TOTP-debug] top is cross-origin or inaccessible');
    }

    // base32 解码（RFC4648）
    function base32Decode(input) {
        input = (input||'').toUpperCase().replace(/=+$/,'').replace(/[^A-Z2-7]/g,'');
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        let bits = 0, value = 0, output = [];
        for (let i = 0; i < input.length; i++) {
            value = (value << 5) | alphabet.indexOf(input[i]);
            bits += 5;
            if (bits >= 8) {
                bits -= 8;
                output.push((value >>> bits) & 0xFF);
            }
        }
        return new Uint8Array(output);
    }
    function counterToBytes(counter) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        const hi = Math.floor(counter / Math.pow(2, 32));
        const lo = counter >>> 0;
        view.setUint32(0, hi);
        view.setUint32(4, lo);
        return new Uint8Array(buffer);
    }
    async function generateTOTP(base32secret, digits = 6, period = 30) {
        const keyBytes = base32Decode(base32secret);
        const now = Math.floor(Date.now() / 1000);
        const counter = Math.floor(now / period);
        const counterBytes = counterToBytes(counter);
        const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
        const sigBytes = new Uint8Array(signature);
        const offset = sigBytes[sigBytes.length - 1] & 0x0f;
        const code = ((sigBytes[offset] & 0x7f) << 24) |
                     ((sigBytes[offset+1] & 0xff) << 16) |
                     ((sigBytes[offset+2] & 0xff) << 8) |
                     (sigBytes[offset+3] & 0xff);
        return (code % Math.pow(10, digits)).toString().padStart(digits,'0');
    }

    const OTP_SELECTORS = [
        '#auth-mfa-otpcode',
        'input[name="otpCode"]',
        'input[name="otp"]',
        'input[id*="otp"]',
        'input[name*="mfa"]',
        'input[type="tel"]',
        'input[placeholder*="验证码"]',
        'input[placeholder*="code"]'
    ];

    function isVisible(el){
        if(!el) return false;
        try {
            return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        } catch(e) { return false; }
    }

    function findOtpField(){
        for(const sel of OTP_SELECTORS){
            const el = document.querySelector(sel);
            if(el && isVisible(el)) return el;
        }
        // 更宽松：所有 input 检查 placeholder/name/id
        const all = Array.from(document.querySelectorAll('input'));
        for(const i of all){
            const p = (i.placeholder||'').toLowerCase();
            const n = (i.name||'').toLowerCase();
            const id = (i.id||'').toLowerCase();
            if(/otp|code|verification|验证码|mfa/.test(p+n+id) && isVisible(i)) return i;
        }
        return null;
    }

    let currentField = null;
    async function fillOnce(){
        if(!MY_BASE32_SECRET || MY_BASE32_SECRET.trim()==='') { console.warn('[TOTP-debug] 必须配置 MY_BASE32_SECRET'); return; }
        const field = findOtpField();
        if(!field){
            //console.log('[TOTP-debug] 还没找到 OTP 输入框');
            return;
        }
        currentField = field;
        try{
            const otp = await generateTOTP(MY_BASE32_SECRET);
            if(field.value !== otp){
                field.focus();
                field.value = otp;
                ['input','change'].forEach(n => field.dispatchEvent(new Event(n,{bubbles:true})));
                console.log('[TOTP-debug] 填入 OTP:', otp, 'selector->', field);
            } else {
                //console.log('[TOTP-debug] OTP 已是最新，无需覆盖');
            }
        }catch(e){
            console.error('[TOTP-debug] 生成/填充失败', e);
        }
    }

    // 定时更新（每秒检查）
    const loopId = setInterval(fillOnce, 1000);

    // MutationObserver：页面动态插入输入框时能立即响应
    const mo = new MutationObserver((mutations)=>{
        if(findOtpField()){
            fillOnce();
        }
    });
    mo.observe(document, { childList: true, subtree: true });

    // 安全退出：如果页面卸载，清理
    window.addEventListener('beforeunload', ()=>{
        clearInterval(loopId);
        mo.disconnect();
    });

    // 立即尝试一次
    fillOnce();

})();

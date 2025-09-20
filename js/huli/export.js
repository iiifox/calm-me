// ==UserScript==
// @name         导出代理统计 XLSX 
// @namespace    https://iiifox.me/
// @version      0.2
// @description  从 iframe 的 F_STATE 提取数据并导出 XLSX，中文不乱码，总额可求和
// @match        *://116.62.60.127:8369/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://iiifox.me/js/huli/export.js
// ==/UserScript==

(function () {
    'use strict';
    if (window.top !== window.self) return;

    const BTN_ID = 'export-dltj-xlsx';
    if (!document.getElementById(BTN_ID)) {
        const btn = document.createElement("button");
        btn.id = BTN_ID;
        btn.textContent = "导出代理统计(XLSX)";
        Object.assign(btn.style, {
            position: "fixed",
            top: "80px",
            right: "20px",
            zIndex: 99999,
            padding: "8px 12px",
            background: "#2e8b57",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer"
        });
        document.body.appendChild(btn);
        btn.addEventListener("click", exportXLSX);
    }

    const XLSX_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    function loadXLSX() {
        return new Promise((resolve, reject) => {
            if (window.XLSX) return resolve(window.XLSX);
            const s = document.createElement("script");
            s.src = XLSX_URL;
            s.onload = () => resolve(window.XLSX);
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function base64UrlDecode(input) {
        input = input.replace(/-/g, '+').replace(/_/g, '/');
        while (input.length % 4) input += '=';
        return atob(input);
    }

    function fixChinese(str) {
        try {
            return decodeURIComponent(escape(str));
        } catch (e) {
            return str;
        }
    }

    function getFState() {
        const iframe = document.querySelector("iframe[src*='dltj']");
        if (!iframe) { alert("未找到 dltj 的 iframe"); return null; }
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc) { alert("无法访问 iframe 内容"); return null; }
        const stateEl = doc.querySelector("#F_STATE");
        if (!stateEl) { alert("iframe 内没有找到 F_STATE"); return null; }

        let decoded, json;
        try {
            decoded = base64UrlDecode(stateEl.value);
            json = JSON.parse(decoded);
        } catch(e){
            alert("F_STATE 解析失败: " + e);
            console.log("F_STATE 内容前300字符:", stateEl.value.slice(0,300));
            return null;
        }

        if (!json.Grid1 || !json.Grid1.F_Rows){ alert("F_STATE 中没有 Grid1.F_Rows"); return null; }

        const data = json.Grid1.F_Rows.map(r => {
            const f0 = r.f0;
            return [
                fixChinese(String(f0[1])), // 用户
                fixChinese(String(f0[2])), // 业务
                Number(f0[3])              // 总额，保留数字类型
            ];
        });

        return data;
    }

    function exportXLSX() {
        const data = getFState();
        if (!data) return;

        const aoa = [["用户","业务","总额"], ...data];

        loadXLSX().then(XLSX=>{
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "代理统计");

            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "代理统计.xlsx";
            a.click();
            URL.revokeObjectURL(url);
        }).catch(err=>{
            alert("加载 XLSX 失败: " + err);
        });
    }

})();

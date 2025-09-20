// ==UserScript==
// @name         狐狸导出代理统计
// @namespace    https://iiifox.me/
// @version      0.4
// @description  监听 dltj.aspx 响应，提取表格数据，可配置直冲、慢充、特价折扣
// @match        *://116.62.60.127:8369/dltj.aspx*
// @grant        GM_xmlhttpRequest
// @updateURL    https://iiifox.me/js/huli/export.js
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// ==/UserScript==

(function () {
    'use strict';

    // ---------------- 配置面板 ----------------
    function createDiscountPanel() {
        const panel = document.createElement("div");
        panel.style = `
            position: fixed;
            top: 50px;
            right: 20px;
            width: 220px;
            background: #fff;
            border: 1px solid #ccc;
            padding: 10px;
            z-index: 9999;
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
            font-size: 14px;
        `;

        panel.innerHTML = `
            <strong>折扣配置</strong>
            <div style="margin-top:5px;"><label>直冲折扣: <input id="dcDiscount" type="number" step="0.001" value="0.095" style="width:60px"></label></div>
            <div><label>慢充折扣: <input id="mcDiscount" type="number" step="0.001" value="-0.86" style="width:60px"></label></div>
            <div><label>特价折扣: <input id="tjDiscount" type="number" step="0.001" value="-0.835" style="width:60px"></label></div>
        `;

        document.body.appendChild(panel);
    }

    createDiscountPanel();

    // ---------------- 工具函数 ----------------
    function isTargetUrl(url) {
        return url.includes("dltj.aspx");
    }

    function fixChinese(str) {
        try { return decodeURIComponent(escape(str)); }
        catch (e) { return str; }
    }

    function parseResponseText(text) {
        if (!text.includes('"Text":"')) return null;

        const dateMatch = text.match(/"Text":"(\d{4}-\d{2}-\d{2})"/);
        const dateStr = dateMatch ? dateMatch[1] : "未知日期";

        const rowsMatch = text.match(/"F_Rows":(\[.*?\])\}/s);
        if (!rowsMatch) return null;

        let rows;
        try {
            rows = JSON.parse(rowsMatch[1]);
        } catch(e) {
            console.error("解析 F_Rows 失败", e);
            return null;
        }

        const data = rows.map(r => {
            const f0 = r.f0;
            return [
                fixChinese(String(f0[1])), // 用户
                fixChinese(String(f0[2])), // 业务
                Number(f0[3])              // 总额
            ];
        });

        return { dateStr, data };
    }

    function exportXLSX(dateStr, data) {
        const aoa = [["用户","业务","总额","折扣","入预付"], ...data];
        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // 读取配置折扣
        const dc = parseFloat(document.getElementById("dcDiscount").value);
        const mc = parseFloat(document.getElementById("mcDiscount").value);
        const tj = parseFloat(document.getElementById("tjDiscount").value);

        data.forEach((row,index)=>{
            const rowNum = index + 2;
            ws[`D${rowNum}`] = { f: `IF(B${rowNum}="秒拉",${dc},IF(ISNUMBER(SEARCH("特价",B${rowNum})),${tj},${mc}))` };
            ws[`E${rowNum}`] = { f: `C${rowNum}*D${rowNum}` };
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "代理统计");

        const wbout = XLSX.write(wb,{bookType:'xlsx',type:'array'});
        const blob = new Blob([wbout],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${dateStr}代理统计.xlsx`;
        a.click();
    }

    // ---------------- 拦截 XHR ----------------
    (function(){
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(...args){
            this.addEventListener('load',()=>{
                if(this.readyState===4 && this.status===200 && isTargetUrl(this.responseURL)){
                    const parsed = parseResponseText(this.responseText);
                    if(parsed){
                        console.log("检测到代理统计数据，自动导出:", parsed);
                        exportXLSX(parsed.dateStr, parsed.data);
                    }
                }
            });
            return originalSend.apply(this,args);
        };
    })();

    // ---------------- 拦截 fetch ----------------
    (function(){
        const originalFetch = window.fetch;
        window.fetch = async function(input, init){
            const url = typeof input === 'string' ? input : input.url;
            const response = await originalFetch(input, init);
            if(isTargetUrl(url)){
                const cloned = response.clone();
                const text = await cloned.text();
                const parsed = parseResponseText(text);
                if(parsed){
                    console.log("检测到代理统计数据(fetch)，自动导出:", parsed);
                    exportXLSX(parsed.dateStr, parsed.data);
                }
            }
            return response;
        };
    })();

})();

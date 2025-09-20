// ==UserScript==
// @name         狐狸导出代理统计
// @namespace    https://iiifox.me/
// @version      0.3
// @description  监听 dltj.aspx 响应，提取表格数据，带折扣和入预付公式
// @match        *://116.62.60.127:8369/dltj.aspx*
// @grant        GM_xmlhttpRequest
// @updateURL    https://iiifox.me/js/huli/export.js
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// ==/UserScript==

(function () {
    'use strict';

    function isTargetUrl(url) {
        return url.includes("dltj.aspx");
    }

    function base64UrlDecode(input) {
        input = input.replace(/-/g, '+').replace(/_/g, '/');
        while (input.length % 4) input += '=';
        return atob(input);
    }

    function fixChinese(str) {
        try { return decodeURIComponent(escape(str)); }
        catch (e) { return str; }
    }

    // 解析响应中的表格数据
    function parseResponseText(text) {
        if (!text.includes('"Text":"')) return null;

        // 简单匹配 Text 和 F_Rows
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

    // 导出 XLSX
    function exportXLSX(dateStr, data) {
        const aoa = [["用户","业务","总额","折扣","入预付"], ...data];

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        data.forEach((row,index)=>{
            const rowNum = index + 2;
            ws[`D${rowNum}`] = { f: `IF(B${rowNum}="秒拉",0.095,IF(ISNUMBER(SEARCH("特价",B${rowNum})),-0.835,-0.86))` };
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

    // 拦截 XHR
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

    // 拦截 fetch
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

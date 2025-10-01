// ==UserScript==
// @name         狐狸导出代理统计
// @namespace    https://iiifox.me/
// @version      1.2.0
// @description  监听 dltj.aspx 响应，按渠道精确折扣导出代理统计，汇总同用户同业务
// @match        *://116.62.60.127:8369/dltj.aspx*
// @grant        GM_xmlhttpRequest
// @updateURL    https://iiifox.me/js/huli/export.js
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// ==/UserScript==

(function () {
    'use strict';

    // ---------------- 折扣配置 ----------------
    const discountMap = {
        "直冲": { channels: ["秒拉"], value: 0.07 },
        "慢充": { channels: [
            "王者Q钱点卷(电商)",
            "王者4笔Q钱点卷（电商）",
            "王者点券Q钱电商单笔",
            "王者点券Q钱电商四笔"
        ], value: -0.88 },
        "特价": { channels: [
            "王者点券特价单笔",
            "王者点券特价五笔"
        ], value: -0.835 }
    };

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
            <div style="margin-top:5px;"><label>直冲折扣: <input id="dcDiscount" type="number" step="0.001" value="${discountMap["直冲"].value}" style="width:60px"></label></div>
            <div><label>慢充折扣: <input id="mcDiscount" type="number" step="0.001" value="${discountMap["慢充"].value}" style="width:60px"></label></div>
            <div><label>特价折扣: <input id="tjDiscount" type="number" step="0.001" value="${discountMap["特价"].value}" style="width:60px"></label></div>
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

    // ---------------- 获取业务类型 ----------------
    function getBusinessType(business) {
        for (let key in discountMap) {
            if (discountMap[key].channels.includes(business)) {
                return key; // 返回“直冲”“慢充”“特价”
            }
        }
        return "其他";
    }

    // ---------------- 汇总数据 ----------------
    function aggregateData(data) {
        const map = {}; // { "用户名|业务类型": 总额 }

        // 每次导出前更新折扣值
        discountMap["直冲"].value = parseFloat(document.getElementById("dcDiscount").value);
        discountMap["慢充"].value = parseFloat(document.getElementById("mcDiscount").value);
        discountMap["特价"].value = parseFloat(document.getElementById("tjDiscount").value);

        data.forEach(row => {
            const user = row[0];
            const type = getBusinessType(row[1]);
            const key = `${user}|${type}`;
            if (!map[key]) map[key] = 0;
            map[key] += row[2];
        });

        // 转成二维数组
        const result = Object.entries(map).map(([key, total]) => {
            const [user, type] = key.split("|");
            const discount = discountMap[type]?.value || 0;
            return [user, type, total, discount, total * discount];
        });

        // 按用户名升序，再按业务类型排序
        result.sort((a, b) => {
            if (a[0] === b[0]) return a[1].localeCompare(b[1]);
            return a[0].localeCompare(b[0]);
        });


        return result;
    }

    // ---------------- 导出 Excel ----------------
    function exportXLSX(dateStr, data) {
        const aggregated = aggregateData(data);
        const aoa = [["用户","业务","总额","折扣","入预付"], ...aggregated];

        // 创建工作簿
        const wb = XLSX.utils.book_new();

        // 1️⃣ 添加原始代理统计工作表
        const wsMain = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, wsMain, "代理统计");

        // 2️⃣ 给每个用户创建单独工作表
        const usersMap = {}; // { 用户名: [[user,type,total,discount,入预付], ...] }
        aggregated.forEach(row => {
            const user = row[0];
            if (!usersMap[user]) usersMap[user] = [];
            usersMap[user].push(row);
        });

        Object.entries(usersMap).forEach(([user, rows]) => {
            const wsUser = XLSX.utils.aoa_to_sheet([[dateStr,"业务","总额","折扣","入预付"], ...rows]);

            // 计算入预付总和
            const totalSum = rows.reduce((sum,r) => sum + r[4], 0);

            // 添加总计行（BCDE合并）
            const lastRow = rows.length + 2; // 第一行是表头
            wsUser[`A${lastRow}`] = { t: 's', v: '总计' };
            wsUser[`B${lastRow}`] = { t: 'n', v: totalSum };
            // 更新 !ref，让工作表范围包含最后一行
            const range = XLSX.utils.decode_range(wsUser['!ref']);
            // 注意索引从0开始，所以减1
            range.e.r = lastRow - 1;
            wsUser['!ref'] = XLSX.utils.encode_range(range);
            // 合并 BCDE 四个单元格
            wsUser['!merges'] = wsUser['!merges'] || [];
            wsUser['!merges'].push({
                s: { r: lastRow - 1, c: 1 }, // 起始单元格 B
                e: { r: lastRow - 1, c: 4 }  // 结束单元格 E
            });

            XLSX.utils.book_append_sheet(wb, wsUser, user);
        });

        // 3️⃣ 导出文件
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

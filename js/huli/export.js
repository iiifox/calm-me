// ==UserScript==
// @name         长颈鹿导出代理统计（前缀筛选 + 汇总）
// @namespace    https://iiifox.me/
// @version      3.1.0
// @description  监听 dltj.aspx 响应，支持前缀筛选导出与前缀汇总导出（下浮%）
// @match        *://121.43.147.96:8369/dltj.aspx*
// @grant        GM_xmlhttpRequest
// @downloadURL  https://iiifox.me/js/huli/export.js
// @updateURL    https://iiifox.me/js/huli/export.js
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// ==/UserScript==

(function () {
'use strict';

const discountMap = {
    "直冲": { channels: ["秒拉"], value: 0.105 },
    "慢充": { channels: [
        "王者Q钱点卷(电商)",
        "王者4笔Q钱点卷（电商）",
        "王者点券Q钱电商单笔",
        "王者点券Q钱电商四笔"
    ], value: -0.86 },
    "特价": { channels: [
        "王者点券特价单笔",
        "王者点券特价五笔"
    ], value: -0.835 }
};

let selectedPrefixes = new Set();
let currentMode = "filter"; // "filter" or "sum"
let pendingData = null;

// ---------------- 折扣配置 + 模式切换 ----------------
function createPanel() {
    const panel = document.createElement("div");
    panel.style = `
        position: fixed;
        top: 50px;
        right: 20px;
        width: 300px;
        background: #fff;
        border: 1px solid #ccc;
        padding: 10px;
        z-index: 9999;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
        font-size: 14px;
    `;

    panel.innerHTML = `
        <strong>折扣配置</strong><br>
        <label style="display:block; margin-bottom:6px;">
            直冲折扣: <input id="dcDiscount" type="number" step="0.001" value="${discountMap["直冲"].value}" style="width:80px">
            下浮%: <input id="dcDrop" type="number" step="0.01" value="0.25" style="width:60px"> %
            <small style="color:#666; display:block;">注意：输入 0.25 表示 0.25%（即 +0.0025）</small>
        </label>
        <label style="display:block; margin-bottom:6px;">慢充折扣: <input id="mcDiscount" type="number" step="0.001" value="${discountMap["慢充"].value}" style="width:80px"></label>
        <label style="display:block; margin-bottom:6px;">特价折扣: <input id="tjDiscount" type="number" step="0.001" value="${discountMap["特价"].value}" style="width:80px"></label>
        <hr>
        <strong>导出模式</strong><br>
        <label><input type="radio" name="mode" value="filter" checked> 前缀筛选</label>
        <label style="margin-left:10px;"><input type="radio" name="mode" value="sum"> 前缀汇总</label>
        <hr>
        <div id="prefixFilterArea"><em>暂无数据</em></div>
    `;

    panel.addEventListener("change", e => {
        if (e.target && e.target.name === "mode") currentMode = e.target.value;
    });

    document.body.appendChild(panel);
}
createPanel();

// ---------------- 工具函数 ----------------
function isTargetUrl(url){ return url && url.includes("dltj.aspx"); }

function fixChinese(str){ try{return decodeURIComponent(escape(str));}catch{return str;} }

function parseResponseText(text){
    if (!text || !text.includes('"Text":"')) return null;
    const dateMatch = text.match(/"Text":"(\d{4}-\d{2}-\d{2})"/);
    const dateStr = dateMatch ? dateMatch[1] : "未知日期";
    const rowsMatch = text.match(/"F_Rows":(\[.*?\])\}/s);
    if (!rowsMatch) return null;
    let rows;
    try{ rows = JSON.parse(rowsMatch[1]); }catch(e){ console.error("解析 F_Rows 失败", e); return null; }
    const data = rows.map(r=>{
        const f0=r.f0;
        return [ fixChinese(String(f0[1])), fixChinese(String(f0[2])), Number(f0[3]) ];
    });
    return {dateStr,data};
}

function getBusinessType(business){
    for (let key in discountMap){
        if (discountMap[key].channels.includes(business)) return key;
    }
    return "其他";
}

// ---------------- 前缀面板 ----------------
function updatePrefixUI(dateStr, data){
    const area=document.getElementById("prefixFilterArea");
    const users=data.map(r=>r[0]);
    const prefixes=Array.from(new Set(users.map(u=>(u.match(/^([A-Za-z0-9]+)-/)||[])[1]).filter(Boolean)));
    if(!prefixes.length){area.innerHTML="<em>未检测到前缀</em>"; return;}

    selectedPrefixes=new Set(prefixes);
    area.innerHTML=`
        <strong>前缀列表</strong><br>
        ${prefixes.map(p=>`<label><input type="checkbox" class="prefixCheck" value="${p}" checked> ${p}</label><br>`).join("")}
        <div style="margin-top:6px;"><button id="exportBtn">导出（${dateStr}）</button></div>
    `;
    area.querySelectorAll(".prefixCheck").forEach(cb=>{
        cb.addEventListener("change",e=>{
            const val=e.target.value;
            if(e.target.checked) selectedPrefixes.add(val);
            else selectedPrefixes.delete(val);
        });
    });

    area.querySelector("#exportBtn").addEventListener("click",()=>{
        if(currentMode==="filter") exportByPrefixFilter(dateStr,data);
        else exportByPrefixSum(dateStr,data);
    });
}

// ---------------- 筛选模式导出（保持不变） ----------------
function exportByPrefixFilter(dateStr,data){
    const filtered=data.filter(row=>{
        const m=row[0].match(/^([A-Za-z0-9]+)-/);
        return m && selectedPrefixes.has(m[1]);
    });
    if(!filtered.length) return alert("未选中任何匹配用户");
    exportXLSX(dateStr,filtered);
}

// ---------------- 汇总模式导出（修正版） ----------------
function exportByPrefixSum(dateStr,data){
    // 读取折扣与下浮（注意下浮输入 0.25 表示 0.25%）
    const dcBase = parseFloat(document.getElementById("dcDiscount").value) || 0;
    const dropInput = parseFloat(document.getElementById("dcDrop").value) || 0; // 用户输入的“下浮%”，比如 0.25 => 0.25%
    const dropAsFraction = dropInput / 100; // 0.25 -> 0.0025
    const dcAdjusted = dcBase + dropAsFraction; // **修正点**：加上绝对的小数（示例：0.105 + 0.0025 = 0.1075）

    // 其它折扣读取（不受下浮影响）
    const mcVal = parseFloat(document.getElementById("mcDiscount").value) || discountMap["慢充"].value;
    const tjVal = parseFloat(document.getElementById("tjDiscount").value) || discountMap["特价"].value;

    // 准备 prefix -> (业务 -> 总额)
    const prefixMap = {}; // { prefix: { type: total, ... }, ... }

    data.forEach(r=>{
        const [user, biz, total] = r;
        const prefix = (user.match(/^([A-Za-z0-9]+)-/)||[])[1];
        if(!prefix) return;
        if(!selectedPrefixes.has(prefix)) return;

        const type = getBusinessType(biz);
        prefixMap[prefix] = prefixMap[prefix] || {};
        prefixMap[prefix][type] = (prefixMap[prefix][type] || 0) + Number(total || 0);
    });

    // ---- 1) 构造「代理统计」工作表：按前缀、按业务汇总，折扣：直冲用 dcAdjusted，其它用原值 ----
    const statAOA = [["前缀","业务","总额","折扣","入预付"]];
    Object.entries(prefixMap).forEach(([prefix, bizMap])=>{
        Object.entries(bizMap).forEach(([type, total])=>{
            let discountForStat;
            if(type === "直冲") discountForStat = dcAdjusted;
            else if(type === "慢充") discountForStat = mcVal;
            else if(type === "特价") discountForStat = tjVal;
            else discountForStat = discountMap[type]?.value || 0;

            statAOA.push([prefix, type, total, discountForStat, total * discountForStat]);
        });
    });

    // ---- 2) 为每个前缀创建明细表：每个用户 + 业务 一行，折扣使用 **原始直冲折扣 dcBase**（不包含下浮） ----
    // 先把原始 data 按 prefix -> user|type 聚合（和筛选模式一致，但要保留用户维度）
    const perPrefixUserMap = {}; // { prefix: { "user|type": total, ... }, ... }
    data.forEach(r=>{
        const [user, biz, total] = r;
        const prefix = (user.match(/^([A-Za-z0-9]+)-/)||[])[1];
        if(!prefix) return;
        if(!selectedPrefixes.has(prefix)) return;

        const type = getBusinessType(biz);
        perPrefixUserMap[prefix] = perPrefixUserMap[prefix] || {};
        const key = `${user}|${type}`;
        perPrefixUserMap[prefix][key] = (perPrefixUserMap[prefix][key] || 0) + Number(total || 0);
    });

    // ---- 3) 组装工作簿并导出 ----
    const wb = XLSX.utils.book_new();

    // 添加代理统计工作表
    const wsStat = XLSX.utils.aoa_to_sheet(statAOA);
    XLSX.utils.book_append_sheet(wb, wsStat, "代理统计");

    // 为每个前缀添加明细表（每行：用户, 业务, 总额, 折扣(原始直冲折扣), 入预付）
    Object.entries(perPrefixUserMap).forEach(([prefix, kv])=>{
        const rows = [["用户","业务","总额","折扣","入预付"]];
        Object.entries(kv).forEach(([userType, total])=>{
            const [user, type] = userType.split("|");
            let discountForRow;
            if(type === "直冲") discountForRow = dcBase; // 明细表里使用原始直冲折扣（不含下浮）
            else if(type === "慢充") discountForRow = mcVal;
            else if(type === "特价") discountForRow = tjVal;
            else discountForRow = discountMap[type]?.value || 0;

            rows.push([user, type, total, discountForRow, total * discountForRow]);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        // 避免非法表名长度或字符，简单处理
        const sheetName = prefix.length > 28 ? prefix.slice(0, 28) : prefix;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // 导出文件名
    const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
    const blob = new Blob([wbout], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${dateStr}前缀汇总.xlsx`;
    a.click();
}

// ---------------- 通用导出函数（筛选模式使用） ----------------
function aggregateData(data){
    const map={};
    discountMap["直冲"].value=parseFloat(document.getElementById("dcDiscount").value);
    discountMap["慢充"].value=parseFloat(document.getElementById("mcDiscount").value);
    discountMap["特价"].value=parseFloat(document.getElementById("tjDiscount").value);
    data.forEach(row=>{
        const user=row[0];
        const type=getBusinessType(row[1]);
        const key=`${user}|${type}`;
        if(!map[key]) map[key]=0;
        map[key]+=row[2];
    });
    return Object.entries(map).map(([k,total])=>{
        const [user,type]=k.split("|");
        const discount=discountMap[type]?.value||0;
        return [user,type,total,discount,total*discount];
    });
}

function exportXLSX(dateStr,data){
    const aggregated=aggregateData(data);
    const wb=XLSX.utils.book_new();
    const wsMain=XLSX.utils.aoa_to_sheet([["用户","业务","总额","折扣","入预付"],...aggregated]);
    XLSX.utils.book_append_sheet(wb,wsMain,"代理统计");

    const usersMap={};
    aggregated.forEach(r=>{
        const user=r[0];
        usersMap[user]=usersMap[user]||[];
        usersMap[user].push(r);
    });

    Object.entries(usersMap).forEach(([user,rows])=>{
        const wsUser=XLSX.utils.aoa_to_sheet([["日期","业务","总额","折扣","入预付"],...rows]);
        XLSX.utils.book_append_sheet(wb,wsUser,user);
    });

    const wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'});
    const blob=new Blob([wbout],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`${dateStr}代理统计.xlsx`;
    a.click();
}

// ---------------- 拦截 ----------------
const hook=(parsed)=>{
    if(parsed){
        console.log("检测到代理统计数据:",parsed);
        pendingData=parsed;
        updatePrefixUI(parsed.dateStr,parsed.data);
    }
};

(function(){
    const originalSend=XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send=function(...args){
        this.addEventListener('load',()=>{
            if(this.readyState===4 && this.status===200 && isTargetUrl(this.responseURL)){
                const parsed=parseResponseText(this.responseText);
                hook(parsed);
            }
        });
        return originalSend.apply(this,args);
    };
})();

(function(){
    const originalFetch=window.fetch;
    window.fetch=async function(input,init){
        const url=typeof input==='string'?input:input.url;
        const res=await originalFetch(input,init);
        if(isTargetUrl(url)){
            const txt=await res.clone().text();
            const parsed=parseResponseText(txt);
            hook(parsed);
        }
        return res;
    };
})();

})();

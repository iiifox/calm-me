// ==UserScript==
// @name         gbo自动启用
// @namespace    https://iiifox.me/js/enableAccountExceptIds.js
// @version      1.2.9
// @description  自动检测并每3分钟启用一次被异常停用的账号
// @author       iiifox
// @match        *://hxmm.vdvg82xr.top/*
// @grant        GM_xmlhttpRequest
// @connect      ggbboo.xyz
// @connect      iiifox.me
// ==/UserScript==

(function () {
    'use strict';

    // 封装 POST 请求
    function postRequest(url, data) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: url,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data: new URLSearchParams(data).toString(),
                onload: function (resp) {
                    try {
                        resolve(JSON.parse(resp.responseText));
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function (err) {
                    reject(err);
                }
            });
        });
    }

    // 封装 GET 请求
    function getRequest(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function (resp) {
                    try {
                        resolve(JSON.parse(resp.responseText));
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function (err) {
                    reject(err);
                }
            });
        });
    }

    async function getAccountExceptIds(username, sid) {
        let ids = [];
        let getAccountListUrl = "http://api.ggbboo.xyz/api_group/Account/getAccountList";
        let disableData = {page: 1, limit: 20, username: username, sid: sid, state: 0};

        while (true) {
            let resp = await postRequest(getAccountListUrl, disableData);
            let items = resp?.data?.list || [];

            for (let item of items) {
                let limit_order_money = item.limit_order_money;
                let limit_order_amount = item.limit_order_amount;

                // 限额到了上限
                if (limit_order_money !== 0 && limit_order_money < item.total_money + item.minimum_limit) {
                    continue;
                }
                // 限笔到了上限
                if (limit_order_amount !== 0 && limit_order_amount <= item.total_amount) {
                    continue;
                }

                // 可以启用了
                ids.push(item.id);
            }

            if (items.length < disableData.limit) {
                break;
            }
            disableData.page++;
        }
        return ids;
    }

    async function enableAccount(username, sid, ids) {
        if (ids.length === 0) {
            console.log("没有需要重新启用的账号~");
            return;
        }

        let enableUrl = "http://api.ggbboo.xyz/api_group/Account/updateAccountState";
        let enableData = {username: username, sid: sid, is_sub: 1, state: 1};
        ids.forEach(id => enableData["ids[]"] = ids); // 多个id

        let resp = await postRequest(enableUrl, enableData);

        if (resp?.msg === "修改成功") {
            ids.forEach(id => console.log(`账号ID: ${id} 被异常停用，已重新启用`));
        } else {
            ids.forEach(id => console.log(`账号ID: ${id} 被异常停用，尝试启用失败~`));
        }
    }

    async function main(username, sid) {
        let ids = await getAccountExceptIds(username, sid);
        await enableAccount(username, sid, ids);
    }

    // 创建配置面板
    function createConfigPanel() {
        const panel = document.createElement("div");
        panel.style.position = "fixed";
        panel.style.bottom = "20px";
        panel.style.right = "20px";
        panel.style.padding = "10px";
        panel.style.background = "rgba(0,0,0,0.7)";
        panel.style.color = "#fff";
        panel.style.borderRadius = "8px";
        panel.style.zIndex = 9999;
        panel.style.fontSize = "14px";
        panel.innerHTML = `
            <label>执行间隔(分钟): </label>
            <input id="intervalInput" type="number" min="1" style="width:50px;" />
            <button id="saveInterval">保存</button>
        `;
        document.body.appendChild(panel);

        const input = panel.querySelector("#intervalInput");
        input.value = GM_getValue("intervalMinutes", 3); // 默认 3 分钟

        panel.querySelector("#saveInterval").onclick = () => {
            const val = parseInt(input.value);
            if (val > 0) {
                GM_setValue("intervalMinutes", val);
                alert("保存成功，脚本将按新间隔执行！");
            } else {
                alert("请输入大于0的数字！");
            }
        };
    }

    // 页面加载后执行
    window.addEventListener("load", () => {
        setTimeout(() => {
            // 页面加载后显示配置面板
            createConfigPanel();

            let username = localStorage.getItem("username");
            let sid = localStorage.getItem("sid");

            if (!username || !sid) {
                console.log("未找到 localStorage 中的 username 或 sid");
                return;
            }

            getRequest("https://iiifox.me/config/gbo.json").then(cfg => {
                if (!cfg.enableUser.includes(username)) {
                    return;
                }
                // 启动定时任务，每3分钟执行一次
                main(username, sid); // 先执行一次
                setInterval(() => main(username, sid), 3 * 60 * 1000);
            }).catch(err => {
                console.error("获取白名单配置失败：", err);
            });

        }, 2000);
    });
})();


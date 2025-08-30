// functions/discount.js
// 将 /price.txt 解析为 JSON：{ yesterday_page, date, qz, gbo}


// 辅助函数：格式化费率值 映射到区间 {0}∪[0.2,2)
function formatRateValue(value) {
    const num = Number(value);
    if (Number.isNaN(num) || num < 0 || num > 2000) return 0;
    if (num === 0) return 0;
    if (num < 2) return num;
    if (num < 20) return +(num / 10).toFixed(3);
    if (num < 200) return +(num / 100).toFixed(3);
    return +(num / 1000).toFixed(3);
}

export async function onRequest() {
    const resp = await fetch(new URL('/price.txt', request.url))
    if (!resp.ok) {
        return new Response(JSON.stringify({error: 'price.txt 获取失败'}), {
            status: 502,
            headers: {'Content-Type': 'application/json'}
        });
    }
    const text = await resp.text();

    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);

    let date = '';
    let yesterday_page = 'https://4231f30c.iiifox.me/'; // 你明确要求固定为该地址
    const qz = {};   // { "00:00": { "渠道A": 0.895, ... }, "09:25": {...}, ... }
    const gbo = {};  // { "1起": 0.75, "点券10起": 0.82, ... }

    let inWechat = false;
    let currentTimeKey = '';

    for (const line of lines) {
        // 第一行通常是昨日页面链接，这里忽略或覆盖到 yesterday_page（你已固定）
        if (/^https?:\/\//i.test(line)) continue;

        // 日期
        if (/^\d{4}-\d{2}-\d{2}$/.test(line)) {
            date = line;
            continue;
        }

        // 微信块开始
        if (line.startsWith('微信')) {
            inWechat = true;
            currentTimeKey = '';
            continue;
        }

        if (inWechat) {
            // gbo：取“倒数第一个数字”作为值，之前的文字作为 key；并按你的映射压缩到 [0,2)
            const m = line.match(/(.+?)\s*([0-9]+(?:\.[0-9]+)?)\s*$/);
            if (m) {
                const name = m[1].replace(/\s+/g, ' ').replace(/(综合、端游|端游、综合)\s*/g, '点券').trim();
                const val = formatRateValue(m[2]);
                if (name) gbo[name] = val;
            } else {
                // 支持“多项共用一个数值”的行：先找数值，再将分隔符前的部分按 、 ， , 拆开
                const v = line.match(/([0-9]+(?:\.[0-9]+)?)\s*$/);
                if (v) {
                    const val = formatRateValue(v[1]);
                    const prefix = line.slice(0, v.index).replace(/\s+/g, ' ').trim();
                    if (prefix) {
                        prefix.split(/[、，,]/).map(s => s.trim()).filter(Boolean).forEach(k => {
                            gbo[k] = val;
                        });
                    }
                }
            }
            continue;
        }

        // ----- 旧返利（qz）时间块 -----
        // “30号过点” 视为 00:00
        if (line.includes('过点')) {
            currentTimeKey = '00:00';
            if (!qz[currentTimeKey]) qz[currentTimeKey] = {};
            continue;
        }
        // “9:25开始”“11点开始”等
        const t = line.match(/(\d{1,2})(?:[:：](\d{2}))?点?开始/);
        if (t) {
            const hh = String(t[1]).padStart(2, '0');
            const mm = t[2] ? t[2] : '00';
            currentTimeKey = `${hh}:${mm}`;
            if (!qz[currentTimeKey]) qz[currentTimeKey] = {};
            continue;
        }

        // 渠道行：渠道名 + 数字
        const m = line.match(/(.*?)\s*([0-9]+(?:\.[0-9]+)?)\s*$/);
        if (m) {
            const ch = m[1].replace(/\s+/g, ' ').trim();
            const val = formatRateValue(m[2]);
            // 没进入过任何时间块时，默认归入 00:00
            const tk = currentTimeKey || '00:00';
            if (!qz[tk]) qz[tk] = {};
            if (ch) qz[tk][ch] = val;
        }
    }

    const out = {
        yesterday_page,
        date,
        qz,
        gbo
    };

    return new Response(JSON.stringify(out, null, 2), {
        headers: {'Content-Type': 'application/json'}
    });
}

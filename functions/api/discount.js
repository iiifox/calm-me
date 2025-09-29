// /api/discount

const normalizeGboLine = line => line
    // 只保留第一个字符到最后一个数字之间
    .replace(/^(.*\d).*/, '$1')
    // 特定词替换
    .replace(/(?:综合、端游|端游、综合)/g, "点券")
    // 移除数字和文字之间的空格(综合、端游100  极速 --> 点卷100极速)
    .replace(/(\d+)\s+([^\d\s])/g, '$1$2')
    .trim();

// 辅助函数：格式化费率值 映射到区间 {0}∪[0.2,2)
function formatRateValue(value) {
    const num = Number(value);
    if (Number.isNaN(num) || num <= 0) return 0;
    if (num < 2) return num;
    if (num < 20) return +(num / 10).toFixed(3);
    if (num < 200) return +(num / 100).toFixed(3);
    return +(num / 1000).toFixed(3);
}

// 先用辅助函数格式化，再加上浮动参数profit后四舍五入：自动去除末尾多余的零
function formatAndRound(value, profit = 0, decimalPlaces = 4) {
    return Number((formatRateValue(value) + profit).toFixed(decimalPlaces));
}

// 解析xd折扣
function parseXd(lines, profit) {
    const xd = {};
    let timeOrder = [];
    let currentTimeKey = ""
    for (const line of lines) {
        // “30号过点” 视为 00:00
        if (line.includes('号')) {
            currentTimeKey = '00:00';
            if (!xd[currentTimeKey]) {
                xd[currentTimeKey] = {};
                timeOrder.push(currentTimeKey);
            }
            continue;
        }
        // “9:25开始”“11点开始”等
        const t = line.match(/(\d{1,2})(?:[:：](\d{2}))?点?开始/);
        if (t) {
            const hh = String(t[1]).padStart(2, '0');
            const mm = t[2] ? t[2] : '00';
            currentTimeKey = `${hh}:${mm}`;
            if (!xd[currentTimeKey]) {
                xd[currentTimeKey] = {};
                timeOrder.push(currentTimeKey);
            }
            continue;
        }

        // 渠道行：渠道名 + 数字
        const m = line.match(/^(.*?)\s*(\d+(?:\.\d+)?)(?:，|$)/);
        if (m && currentTimeKey) {
            let channel = m[1];
            // 1️⃣ 先统一大写
            channel = channel.replace(/[a-z]/g, c => c.toUpperCase());
            // 2️⃣ 特殊渠道映射（可选，未来可能移除）
            const specialMap = {
                VB: "VB微信10起",
                VC: "VC微信50",
                VD: "VD100",
                VE: "VE200"
            };
            // 查找是否包含特殊渠道标识
            const matchedKey = Object.keys(specialMap).find(k => channel.includes(k));
            if (matchedKey) {
                channel = specialMap[matchedKey];
            }
            xd[currentTimeKey][channel] = formatAndRound(m[2], profit);
        }
    }

    // 1️⃣ 收集渠道首次出现的顺序和索引
    const firstOccurrence = {};
    const channelsOrder = [];
    timeOrder.forEach((time, index) => {
        Object.keys(xd[time]).forEach(channel => {
            if (!(channel in firstOccurrence)) {
                firstOccurrence[channel] = index;
                channelsOrder.push(channel);
            }
        });
    });

    // 2️⃣ 补全并重建，同时生成 template
    const templateItems = [];
    timeOrder.forEach((time, timeIndex) => {
        const newObj = {};
        channelsOrder.forEach(channel => {
            if (timeIndex < firstOccurrence[channel]) {
                // 首次出现前，补 1
                newObj[channel] = 1;
            } else {
                // 首次出现及之后
                newObj[channel] = xd[time][channel] ?? xd[timeOrder[timeIndex - 1]][channel];
            }
            templateItems.push(`${channel}${time}/${newObj[channel]}`);
        });
        xd[time] = newObj;
    });

    xd.template = templateItems.join('\n');

    return xd;
}

// 解析gbo折扣
async function parseGbo(lines, request, profit) {
    const resp = await fetch(new URL('/config/gbo.json', new URL(request.url).origin));
    if (!resp.ok) {
        return new Response(JSON.stringify({error: 'GBO配置数据源获取失败'}), {
            status: 502,
            headers: {'Content-Type': 'application/json'}
        });
    }
    const gboJson = await resp.json();

    // 解析所有折扣项（精确匹配自定义渠道名）
    const discountItems = lines
        .map(normalizeGboLine)
        .filter(Boolean)
        .flatMap(line => {
            const m = line.match(/^(.*?)(\d+(?:\.\d+)?)$/);
            if (!m) return [];
            const prefixPart = m[1].trim();
            const discount = formatAndRound(m[2], profit);
            return prefixPart.split(/[、,，]/)
                .map(s => s.trim())
                .filter(Boolean)
                .map(channel => ({ channel, discount }));
        });

    const channelConfig = gboJson.channelConfig;
    // 渠道映射 和 鼠标悬停提示信息(渠道对应的所有通道)
    const discountMap = new Map();
    discountItems.forEach(item => {
        const channelName = channelConfig.nameMap[item.channel] || item.channel;
        const paths = (channelConfig.channelMap[channelName] || '').split('\n').filter(Boolean);
        discountMap.set(channelName, { price: item.discount, paths })
    });

    const gbo = {};
    // 1️⃣ 按 channelMap 顺序输出
    Object.keys(channelConfig.channelMap).forEach(channel => {
        if (discountMap.has(channel)) {
            gbo[channel] = discountMap.get(channel);
            discountMap.delete(channel); // 已输出
        }
    });
    // 2️⃣ 输出剩余未匹配渠道
    for (const [channel, value] of discountMap.entries()) {
        gbo[channel] = value;
    }

    return gbo;
}

export async function onRequest({request}) {
    const profit = Number(new URL(request.url).searchParams.get("profit") || 0);
    const resp = await fetch(new URL('/price.txt', new URL(request.url).origin));
    if (!resp.ok) {
        return new Response(JSON.stringify({error: '数据源获取失败'}), {
            status: 502,
            headers: {'Content-Type': 'application/json'}
        });
    }
    const text = await resp.text();

    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);

    let yesterdayPage = '';
    let date = '';
    let xdLines = [];
    let gboLines = [];

    let currentSystem = "xd";
    for (const line of lines) {
        // 昨日费率页面
        if (/^https:\/\/[\w-]+(\.[\w-]+)+(?:\/[^\s?#]*)?(?:\?[^#\s]*)?(?:#\S*)?/i.test(line)) {
            yesterdayPage = line;
            continue;
        }
        // 当前费率日期
        if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(line)) {
            date = line;
            continue;
        }

        // xd
        if (currentSystem === "xd") {
            if (line.startsWith('微信')) {
                currentSystem = "gbo";
                continue;
            }
            xdLines.push(line);
            continue;
        }
        // gbo
        gboLines.push(line);
    }

    const xd = parseXd(xdLines, profit);
    const gbo = await parseGbo(gboLines, request, profit);

    return new Response(JSON.stringify({yesterdayPage, date, xd, gbo}), {
        headers: {'Content-Type': 'application/json'}
    });
}

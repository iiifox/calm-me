// /api/discount


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
    const timeOrder = [];
    let currentTimeKey = '';

    const specialMap = { VB: "VB微信10起", VC: "VC微信50", VD: "VD100", VE: "VE200" };

    const channelsFirstIndex = new Map();

    for (const line of lines) {
        // 时间匹配
        const t = line.match(/(\d{1,2})(?::|：)?(\d{2})?点?开始/);
        if (line.includes('号')) currentTimeKey = '00:00';
        else if (t) currentTimeKey = `${String(t[1]).padStart(2, '0')}:${t[2] || '00'}`;

        if (currentTimeKey && !(currentTimeKey in xd)) {
            xd[currentTimeKey] = {};
            timeOrder.push(currentTimeKey);
        }

        // 渠道行匹配
        const m = line.match(/^(.*?)\s*(\d+(?:\.\d+)?)(?:，|$)/);
        if (m && currentTimeKey) {
            let channel = m[1].toUpperCase();
            const matchedKey = Object.keys(specialMap).find(k => channel.includes(k));
            if (matchedKey) channel = specialMap[matchedKey];
            xd[currentTimeKey][channel] = formatAndRound(m[2], profit);

            if (!channelsFirstIndex.has(channel)) {
                channelsFirstIndex.set(channel, timeOrder.indexOf(currentTimeKey));
            }
        }
    }

    // 补全缺失值并生成 template
    const channelsOrder = Array.from(channelsFirstIndex.keys());
    const templateItems = [];

    timeOrder.forEach((time, timeIndex) => {
        const newObj = {};
        channelsOrder.forEach(channel => {
            if (timeIndex < channelsFirstIndex.get(channel)) newObj[channel] = 1;
            else newObj[channel] = xd[time][channel] ?? xd[timeOrder[timeIndex - 1]][channel];
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
    if (!resp.ok) throw new Error('GBO配置数据源获取失败');

    const { channelConfig } = await resp.json();

    const discountMap = new Map();
    for (const line of lines.map(l => l.trim()).filter(Boolean)) {
        let cleanLine = line.replace(/^(.*\d).*/, '$1')
                            .replace(/(?:综合、端游|端游、综合)/g, "点券")
                            .replace(/(\d+)\s+([^\d\s])/g, '$1$2');
        const m = cleanLine.match(/^(.*?)(\d+(?:\.\d+)?)$/);
        if (!m) continue;

        const discount = formatAndRound(m[2], profit);
        const channels = m[1].split(/[、,，]/).map(s => s.trim()).filter(Boolean);
        channels.forEach(channel => {
            const name = channelConfig.nameMap[channel] || channel;
            const paths = (channelConfig.channelMap[name] || '').split('\n').filter(Boolean);
            discountMap.set(name, { price: discount, paths });
        });
    }

    // 构建 gbo
    const gbo = Object.fromEntries(
        [...new Set([...Object.keys(channelConfig.channelMap), ...discountMap.keys()])]
            .map(channel => [channel, discountMap.get(channel) || { price: 0, paths: [] }])
    );

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

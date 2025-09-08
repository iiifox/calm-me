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

// 四舍五入函数：自动去除末尾多余的零
function roundToFixed(num, decimalPlaces = 4) {
    const factor = Math.pow(10, decimalPlaces);
    // 先四舍五入到指定位数，再转换为Number自动去除末尾零
    return Number(Math.round(num * factor) / factor);
}

// 解析qz折扣
function parseQz(lines, profit) {
    const qz = {};
    let timeOrder = [];
    let currentTimeKey = ""
    for (const line of lines) {
        // “30号过点” 视为 00:00
        if (line.includes('过点')) {
            currentTimeKey = '00:00';
            if (!qz[currentTimeKey]) {
                qz[currentTimeKey] = {};
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
            if (!qz[currentTimeKey]) {
                qz[currentTimeKey] = {};
                timeOrder.push(currentTimeKey);
            }
            continue;
        }

        // 渠道行：渠道名 + 数字
        const m = line.match(/(.*?)\s*(\d+(?:\.\d+)?)$/);
        if (m && currentTimeKey) qz[currentTimeKey][m[1]] = roundToFixed(formatRateValue(m[2]) + profit);
    }

    // 收集所有出现过的渠道，以及每个渠道首次出现的时间段索引
    const allChannels = new Set();
    // 键：渠道名，值：首次出现的时间索引（在timeOrder中）
    const firstOccurrence = {};
    timeOrder.forEach((time, index) => {
        const channels = Object.keys(qz[time]);
        channels.forEach(channel => {
            allChannels.add(channel);
            if (firstOccurrence[channel] === undefined) {
                // 记录首次出现的时间索引
                firstOccurrence[channel] = index;
            }
        });
    });
    const allChannelsArr = Array.from(allChannels);

    // template补全（按规则生成：首次出现前补1，首次出现后延用折扣）
    const templateItems = [];
    // 按渠道分组，每个渠道下按时间顺序生成条目
    allChannelsArr.forEach(channel => {
        // 记录上一时间段的折扣，用于后续时间段补全
        let lastDiscount;
        timeOrder.forEach((time, timeIndex) => {
            // 渠道首次出现前的时间段 → template补折扣1
            if (timeIndex < firstOccurrence[channel]) {
                qz[time][channel] = 1
                templateItems.push(`${channel}${time}/1`);
            }
            // 若当前时间段有该渠道，使用当前折扣并更新lastDiscount
            else if (qz[time].hasOwnProperty(channel)) {
                const lastDiscount = qz[time][channel];
                templateItems.push(`${channel}${time}/${lastDiscount}`);
            }
            // 若当前时间段无该渠道，延用上一时间段折扣（补全）
            else if (lastDiscount !== undefined) {
                qz[time][channel] = lastDiscount;
                templateItems.push(`${channel}${time}/${lastDiscount}`);
            }
        });
    });
    // 将所有条目拼接为多行字符串，作为qz的template属性
    qz.template = templateItems.join('\n');

    return qz;
}

// 解析gbo折扣
async function parseGbo(lines, request, profit) {
    const gbo = {};

    const resp = await fetch(new URL('/config/gbo.json', new URL(request.url).origin));
    if (!resp.ok) {
        return new Response(JSON.stringify({error: '数据源获取失败'}), {
            status: 502,
            headers: {'Content-Type': 'application/json'}
        });
    }
    const gboJson = await resp.json();

    // 解析所有折扣项（精确匹配自定义渠道名）
    const discountItems = [];
    for (const line of lines) {
        // 格式处理
        const cleanLine = line.replace(/^(.*\d).*/, '$1')
            .replace(/(综合、端游|端游、综合)\s*/g, "点券")
            .replace(/(\d+)\s+([^\d\s])/g, '$1$2');
        // 有些个数处理后变为了空值（比如全中文）
        if (!cleanLine) continue;

        // 首先提取整行最后的折扣部分
        const discountMatch = cleanLine.match(/(\d+(?:\.\d+)?)$/);
        if (discountMatch) {
            const discount = formatRateValue(parseFloat(discountMatch[1]));
            // 移除折扣部分，保留前面的渠道部分
            const prefixPart = cleanLine.substring(0, discountMatch.index).trim();
            // 拆分前缀渠道部分
            const separatorPattern = /[、,，]/
            const channels = separatorPattern.test(prefixPart)
                ? prefixPart.split(separatorPattern).map(p => p.trim())
                : [prefixPart]
            // 为每个渠道创建折扣
            channels.forEach(channel => {
                if (channel) discountItems.push({channel, discount});
            });
        }
    }

    const channelConfig = gboJson.channelConfig;
    // 渠道映射 和 鼠标悬停提示信息(渠道对应的所有通道)
    discountItems.forEach(item => {
        item.channel = channelConfig.nameMap[item.channel] || item.channel;
        const tooltip = channelConfig.channelMap[item.channel] || '';
        item.paths = tooltip ? tooltip.split('\n') : [];
    });

    // 获取顺序（直接使用 channelMap 的键）
    const order = Object.keys(channelConfig.channelMap);

    // 精确匹配自定义渠道顺序
    order.forEach(channel => {
        const index = discountItems.findIndex(item => item.channel === channel);
        if (index !== -1) {
            const item = discountItems[index];
            gbo[channel] = {
                price: roundToFixed(item.discount + profit),
                paths: item.paths
            };
            discountItems.splice(index, 1);
        }
    });
    // 剩余项（没有被精确匹配的渠道名）
    for (const item of discountItems) {
        gbo[item.channel] = {
            price: roundToFixed(item.discount + profit),
            paths: item.paths
        };
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
    let qzLines = [];
    let gboLines = [];

    let currentSystem = "qz";
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

        // qz
        if (currentSystem === "qz") {
            if (line.startsWith('微信')) {
                currentSystem = "gbo";
                continue;
            }
            qzLines.push(line);
            continue;
        }
        // gbo
        gboLines.push(line);
    }

    const qz = parseQz(qzLines, profit);
    const gbo = await parseGbo(gboLines, request, profit);

    const out = {yesterdayPage, date, qz, gbo};
    return new Response(JSON.stringify(out, null, 2), {
        headers: {'Content-Type': 'application/json'}
    });
}

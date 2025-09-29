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

    // 收集所有出现过的渠道，以及每个渠道首次出现的时间段索引
    const allChannels = new Set();
    // 键：渠道名，值：首次出现的时间索引（在timeOrder中）
    const firstOccurrence = {};
    timeOrder.forEach((time, index) => {
        const channels = Object.keys(xd[time]);
        channels.forEach(channel => {
            allChannels.add(channel);
            if (firstOccurrence[channel] === undefined) {
                // 记录首次出现的时间索引
                firstOccurrence[channel] = index;
            }
        });
    });

    // 收集全局渠道首次出现顺序
    const channelsFirstOrder = [];
    const seen = new Set();
    timeOrder.forEach(time => {
        Object.keys(xd[time]).forEach(channel => {
            if (!seen.has(channel)) {
                seen.add(channel);
                channelsFirstOrder.push(channel);
            }
        });
    });

    // 补全
    channelsFirstOrder.forEach(channel => {
        let lastDiscount;
        timeOrder.forEach(time => {
            if (xd[time][channel] !== undefined) lastDiscount = xd[time][channel];
            else xd[time][channel] = lastDiscount;
        });
    });

    // 重建对象，确保输出顺序一致
    timeOrder.forEach(time => {
        const newObj = {};
        channelsFirstOrder.forEach(channel => {
            if (xd[time].hasOwnProperty(channel)) {
                newObj[channel] = xd[time][channel];
            }
        });
        xd[time] = newObj;
    });

    // === 新的 template 生成逻辑 ===
    const templateItems = [];
    channelsFirstOrder.forEach(channel => {
        timeOrder.forEach(time => {
            templateItems.push(`${channel}${time}/${xd[time][channel]}`);
        });
    });
    xd.template = templateItems.join('\n');
    
    return xd;
}

// 解析gbo折扣
async function parseGbo(lines, request, profit) {
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
    const discountMap = new Map();
    discountItems.forEach(item => {
        const channelName = channelConfig.nameMap[item.channel] || item.channel;
        const paths = (channelConfig.channelMap[channelName] || '').split('\n');
        discountMap.set(channelName, { price: roundToFixed(item.discount + profit), paths })
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

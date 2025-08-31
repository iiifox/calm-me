// 渲染返利平台调价卡片
function renderQz(data) {
    const container = document.getElementById('qzContainer');
    if (!data || !data.timeBlocks || data.timeBlocks.length === 0) {
        container.innerHTML = '<div class="error">未找到有效的价格数据</div>';
        return;
    } 

    container.innerHTML = '';
    // 渲染每个时间块（直接使用接口返回的标准时间）
    data.timeBlocks.forEach(block => {
        const card = document.createElement('div');
        card.className = 'qz-card';

        const header = document.createElement('div');
        header.className = 'card-header';
        header.textContent = `${block.time}`;

        const content = document.createElement('div');
        content.className = 'card-content';

        // 添加费率项
        block.rates.forEach(rate => {
            const item = document.createElement('div');
            item.className = 'qz-item';
            item.innerHTML = `
                <span class="channel">${rate.channel}</span>
                <span class="value">${rate.value}</span>
            `;
            content.appendChild(item);
        });

        card.appendChild(header);
        card.appendChild(content);
        container.appendChild(card);
    });
}

// 渲染微信折扣区（适配/discount接口返回的gbo数据，依赖后端处理的配置映射）
function renderGbo(gbo, channelConfig) {
    const container = document.getElementById('gboGrid');
    container.innerHTML = '';

    if (!gbo || Object.keys(gbo).length === 0) {
        container.innerHTML = '<p>暂无微信报价</p>';
        return;
    }

    const discountItems = Object.entries(gbo).map(([channel, value]) => ({
        channel: channel,
        value: value,
        tooltip: channelConfig.channelMap[channel] || ''
    }));

    const order = Object.keys(channelConfig.channelMap);

    const sortedDiscounts = [];
    const otherDiscounts = [];

    order.forEach(orderedChannel => {
        const index = discountItems.findIndex(item => item.channel === orderedChannel);
        if (index !== -1) {
            sortedDiscounts.push(discountItems[index]);
            discountItems.splice(index, 1);
        }
    });

    otherDiscounts.push(...discountItems);

    sortedDiscounts.forEach(item => {
        const gboItem = document.createElement('div');
        gboItem.className = 'gbo-item';
        gboItem.setAttribute('data-tooltip', item.tooltip);
        gboItem.innerHTML = `${item.channel} <strong>${item.value}</strong>`;
        container.appendChild(gboItem);
    });

    if (otherDiscounts.length > 0) {
        const separator = document.createElement('div');
        separator.className = 'gbo-separator';
        separator.textContent = '其他折扣';
        container.appendChild(separator);

        otherDiscounts.forEach(item => {
            const gboItem = document.createElement('div');
            gboItem.className = 'gbo-item extra';
            gboItem.setAttribute('data-tooltip', item.tooltip);
            gboItem.innerHTML = `${item.channel} <strong>${item.value}</strong>`;
            container.appendChild(gboItem);
        });
    }
}

// 显示错误信息
function showError(message) {
    const container = document.getElementById('qzContainer');
    container.innerHTML = `
        <div class="error">
            <p>${message}</p>
            <p>请确保服务正常运行</p>
            <button class="refresh-btn" onclick="location.reload()">刷新页面</button>
        </div>
    `;
}

// 主数据加载逻辑（移除fetchConfig相关逻辑）
async function loadData() {
    try {
        // 获取折扣数据
        const discountResp = await fetch('/discount');
        if (!discountResp.ok) throw new Error('折扣数据接口请求失败');
        const discountData = await discountResp.json();
        if (discountData.error) throw new Error(discountData.error);

        // 设置昨日费率链接
        if (discountData.yesterdayPage) {
            document.getElementById('yesterday').href = discountData.yesterdayPage;
        }

        // 处理旧返利数据（qz）
        const qzData = discountData.qz || {};
        const timeKeys = Object.keys(qzData);
        // 转换为时间块格式
        const timeBlocks = timeKeys.map(time => ({
            time: time, // 直接使用接口返回的标准时间
            rates: Object.entries(qzData[time]).map(([channel, value]) => ({
                channel,
                value
            }))
        }));
        // 渲染旧返利
        renderQz({ timeBlocks, updateTime });
        
        // 计算更新时间
        const lastTime = timeKeys[timeKeys.length - 1] || '00:00';
        const updateTime = `${discountData.date || ''} ${lastTime}`;
        // 更新页面上的时间
        if (data.updateTime) {
            document.getElementById('updateTime').textContent = data.updateTime;
        }

        // 处理新返利数据（gbo）- 从/discount接口获取已处理的gbo和配置
        const gbo = discountData.gbo || {};
        // 从gbo.json获取渠道配置（后端已处理映射，前端直接使用）
        const gboConfigResp = await fetch('/config/gbo.json');
        if (!gboConfigResp.ok) throw new Error('gbo配置获取失败');
        const gboConfig = await gboConfigResp.json();

        // 渲染新返利折扣
        renderGbo(gbo, gboConfig.channelConfig);

    } catch (error) {
        showError('数据加载失败: ' + error.message);
    }
}

// 页面加载时执行
loadData();

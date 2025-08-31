// 渲染返利平台调价卡片
function renderqzCards(data) {
    const container = document.getElementById('qzContainer');

    if (!data || !data.timeBlocks || data.timeBlocks.length === 0) {
        container.innerHTML = '<div class="error">未找到有效的价格数据</div>';
        return;
    }

    // 更新页面上的时间
    if (data.updateTime) {
        document.getElementById('updateTime').textContent = data.updateTime;
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

// 新增：显示通知提示
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification'; // 重置样式
    if (isError) notification.classList.add('error');
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// 新增：初始化复制按钮功能
function initCopyButton(templateData) {
    const copyBtn = document.getElementById('copyRatesBtn');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', () => {
        if (!templateData) {
            showNotification('无可用费率数据（qz.template不存在）', true);
            return;
        }

        // 复制qz.template内容到剪贴板
        navigator.clipboard.writeText(templateData)
            .then(() => showNotification('费率已复制到剪贴板'))
            .catch(err => {
                showNotification('复制失败，请手动复制', true);
                console.error('复制失败:', err);
            });
    });
}

// 修改主数据加载逻辑，添加复制按钮初始化
async function loadData() {
    try {
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

        const timeBlocks = timeKeys.map(time => ({
            time: time,
            rates: Object.entries(qzData[time]).map(([channel, value]) => ({
                channel,
                value
            }))
        }));

        const lastTime = timeKeys[timeKeys.length - 1] || '00:00';
        const updateTime = `${discountData.date || ''} ${lastTime}`;

        renderqzCards({ timeBlocks, updateTime });

        // 处理新返利数据（gbo）
        const gbo = discountData.gbo || {};
        const gboConfigResp = await fetch('/config/gbo.json');
        if (!gboConfigResp.ok) throw new Error('gbo配置获取失败');
        const gboConfig = await gboConfigResp.json();

        renderGbo(gbo, gboConfig.channelConfig);

        // 新增：初始化复制按钮（传入qz.template数据）
        initCopyButton(discountData.qz?.template);

    } catch (error) {
        showError('数据加载失败: ' + error.message);
    }
}

// 页面加载时执行
loadData();

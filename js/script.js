function renderqzCards(timeBlocks) {
    const container = document.getElementById('qz-rebate-system');
    const tabsContainer = document.querySelector('.time-tabs');

    // 清空容器
    container.innerHTML = '';
    tabsContainer.innerHTML = '';

    if (!timeBlocks || timeBlocks.length === 0) {
        container.innerHTML = '<div class="error">未找到有效的价格数据</div>';
        return;
    }

    const types = [
        {key: 'qianbao', label: '钱包'},
        {key: 'teshu', label: '特殊'},
        {key: 'weixin', label: '微信'}
    ];

    const channelGroup = {
        "qianbao": ["渠道A", "渠道B", "渠道C", "渠道D", "渠道E", "渠道H"],
        "teshu": ["渠道TA", "渠道TB"],
        "weixin": ["渠道VA", "VB微信10起", "VC微信50", "VD100", "VE200"]
    }

    // 为每个时间块创建滑动面板
    timeBlocks.forEach((block, index) => {
        // 创建时间块面板
        const slide = document.createElement('div');
        slide.className = 'qz-slide';
        slide.dataset.time = block.time;

        const timeTitle = document.createElement('div');
        timeTitle.className = 'rebate-title';
        timeTitle.textContent = `旧返利折扣（${block.time}开始）`;
        slide.appendChild(timeTitle);

        // 渲染该时间块的所有渠道数据
        // 修改types.forEach循环内的代码
        types.forEach(type => {
            const group = document.createElement('div');
            group.className = 'rebate-group';

            const channelSpan = document.createElement('span');
            channelSpan.className = 'channel';
            channelSpan.textContent = type.label; // 这是"钱包"、"特殊"、"微信"等组名
            group.appendChild(channelSpan);

            const channelList = document.createElement('div');
            channelList.className = 'channel-list';

            // 在 renderqzCards 函数的循环中，替换原有 channelList 内部渲染逻辑
            Object.values(block.rates).forEach(item => {
                if (channelGroup[type.key].includes(item.channel)) {
                    // 创建独立的渠道项div（使用 qz-item 类）
                    const channelItem = document.createElement('div');
                    channelItem.className = 'qz-item'; // 应用统一样式

                    // 渠道名称
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'channel-name';
                    nameSpan.textContent = item.channel;

                    // 渠道值
                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'channel-value';
                    valueSpan.textContent = item.value;

                    channelItem.appendChild(nameSpan);
                    channelItem.appendChild(valueSpan);
                    channelList.appendChild(channelItem);
                }
            });

            group.appendChild(channelList);
            slide.appendChild(group);
        });

        container.appendChild(slide);

        // 创建时间标签
        const tab = document.createElement('div');
        tab.className = `time-tab ${index === timeBlocks.length - 1 ? 'active' : ''}`;
        tab.textContent = block.time;
        tab.addEventListener('click', () => {
            // 切换到对应时间块
            slide.scrollIntoView({behavior: 'smooth'});
            // 更新活跃标签
            document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
        tabsContainer.appendChild(tab);
    });

    // 监听滚动事件，更新活跃标签
    container.addEventListener('scroll', () => {
        const slides = document.querySelectorAll('.qz-slide');
        const tabs = document.querySelectorAll('.time-tab');

        slides.forEach((slide, index) => {
            const rect = slide.getBoundingClientRect();
            // 检查当前slide是否在可视区域
            if (rect.left >= 0 && rect.right <= window.innerWidth) {
                tabs.forEach(t => t.classList.remove('active'));
                tabs[index].classList.add('active');
            }
        });
    });

    // 默认滚动到最后一个时间块
    setTimeout(() => {
        const lastSlide = document.querySelector('.qz-slide:last-child');
        if (lastSlide) {
            lastSlide.scrollIntoView({behavior: 'smooth'});
        }
    }, 100);
}

// 直接使用 discountData.gbo 中的 {渠道: {price, paths}} 数据
function renderGbo(gbo) {
    const container = document.getElementById('gboGrid');
    container.innerHTML = '';

    // 校验数据是否存在
    if (!gbo || typeof gbo !== 'object' || Object.keys(gbo).length === 0) {
        container.innerHTML = '<p>暂无微信报价</p>';
        return;
    }

    const channels = Object.keys(gbo);

    // 渲染每个渠道项
    channels.forEach(channel => {
        const { price, paths } = gbo[channel];
        // 容错处理：确保 paths 是数组
        const validPaths = Array.isArray(paths) ? paths : [];
        
        const gboItem = document.createElement('div');
        gboItem.className = 'gbo-item';
        // 悬停提示使用 paths 数组（换行分隔）
        gboItem.setAttribute('data-tooltip', validPaths.join('\n'));
        // 显示渠道名和价格
        gboItem.innerHTML = `${channel} <strong>${price}</strong>`;
        container.appendChild(gboItem);
    });
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

// 显示通知提示
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification'; // 重置样式
    if (isError) notification.classList.add('error');
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// 初始化复制按钮功能
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

        // 处理旧返利数据（qz）- 核心修改：过滤掉template字段
        const qzData = discountData.qz || {};
        // 获取qz中所有键，但排除'template'（避免被当作时间块渲染）
        const timeKeys = Object.keys(qzData).filter(key => key !== 'template');
        // 转换为时间块格式
        const timeBlocks = timeKeys.map(time => ({
            time: time, // 直接使用接口返回的标准时间
            rates: Object.entries(qzData[time]).map(([channel, value]) => ({
                channel,
                value
            }))
        }));

        renderqzCards(timeBlocks);

        // 处理新返利数据（gbo）
        const gbo = discountData.gbo || {};
        renderGbo(gbo);

        // 初始化复制按钮（传入qz.template数据）
        initCopyButton(discountData.qz?.template);

    } catch (error) {
        showError('数据加载失败: ' + error.message);
    }
}

// 页面加载时执行
loadData();

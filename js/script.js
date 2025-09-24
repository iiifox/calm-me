function renderXdCards(timeBlocks) {
    const container = document.getElementById('xd-rebate-system');
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
        "qianbao": ["渠道A", "渠道B", "渠道C", "渠道D", "渠道E", "渠道F" "渠道H"],
        "teshu": ["渠道TA", "渠道TB"],
        "weixin": ["渠道VA", "VB微信10起", "VC微信50", "VD100", "VE200"]
    }

    // 构造渠道顺序，用于折扣颜色计算
    const allChannels = [...channelGroup.qianbao, ...channelGroup.teshu, ...channelGroup.weixin];
    // 存储每个渠道上一次的折扣值
    const lastDiscountByChannel = {};

    // 为每个时间块创建滑动面板
    timeBlocks.forEach((block, index) => {
        // 创建时间块面板
        const slide = document.createElement('div');
        slide.className = 'xd-slide';
        slide.dataset.time = block.time;

        const timeTitle = document.createElement('div');
        timeTitle.className = 'rebate-title';
        timeTitle.textContent = `旧返利折扣（${block.time}开始）`;
        slide.appendChild(timeTitle);

        // 渲染该时间块的所有渠道数据
        types.forEach(type => {
            const group = document.createElement('div');
            group.className = 'rebate-group';

            const channelSpan = document.createElement('span');
            channelSpan.className = 'channel';
            // 这是"钱包"、"特殊"、"微信"等组名
            channelSpan.textContent = type.label;
            group.appendChild(channelSpan);

            const channelList = document.createElement('div');
            channelList.className = 'channel-list';

            // 渲染渠道项
            channelGroup[type.key].forEach(channelName => {
                // 找到当前时间块的渠道
                const item = Object.values(block.rates).find(i => i.channel === channelName);
                if (!item) return;

                // 颜色判定
                let color = 'black';
                if (index === 0) {
                    // 00:00时间块全部黑色
                    color = 'black';
                } else {
                    const last = lastDiscountByChannel[channelName];
                    if (last !== undefined) {
                        if (item.value === last) color = 'black';
                        else if (item.value > last) color = 'red';
                        else if (item.value < last) color = 'green';
                    }
                }

                // 创建独立的渠道项div
                const channelItem = document.createElement('div');
                channelItem.className = 'xd-item';

                // 渠道名称
                const nameSpan = document.createElement('span');
                nameSpan.className = 'channel-name';
                nameSpan.textContent = channelName;

                // 渠道值
                const valueSpan = document.createElement('span');
                valueSpan.className = 'channel-value';
                valueSpan.textContent = item.value;
                valueSpan.style.color = color; // 设置颜色

                channelItem.appendChild(nameSpan);
                channelItem.appendChild(valueSpan);
                channelList.appendChild(channelItem);

                // 更新当前渠道的last value
                lastDiscountByChannel[channelName] = item.value;
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
        const slides = document.querySelectorAll('.xd-slide');
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
        const lastSlide = document.querySelector('.xd-slide:last-child');
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
    const container = document.getElementById('xdContainer');
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
            showNotification('无可用费率数据（xd.template不存在）', true);
            return;
        }

        // 复制xd.template内容到剪贴板
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
        const params = new URLSearchParams(window.location.search);
        const profit = params.get('profit');
        let discountUrl = '/discount';
        if (profit) {
            discountUrl += `?profit=${encodeURIComponent(profit)}`;
        }
        const discountResp = await fetch(discountUrl);
        if (!discountResp.ok) throw new Error('折扣数据接口请求失败');
        const discountData = await discountResp.json();
        
        if (discountData.error) throw new Error(discountData.error);

        // 设置昨日费率链接
        if (discountData.yesterdayPage) {
            document.getElementById('yesterday').href = discountData.yesterdayPage;
        }

        // 动态设置费率展示标题
        if (discountData.date) {
            const rateTitleEl = document.getElementById('rate-title');
            if (rateTitleEl) {
                rateTitleEl.textContent = `${discountData.date} 费率展示`;
            }
        }

        // 处理旧返利数据（xd）- 核心修改：过滤掉template字段
        const xdData = discountData.xd || {};
        // 获取xd中所有键，但排除'template'（避免被当作时间块渲染）
        const timeKeys = Object.keys(xdData).filter(key => key !== 'template');
        // 转换为时间块格式
        const timeBlocks = timeKeys.map(time => ({
            time: time, // 直接使用接口返回的标准时间
            rates: Object.entries(xdData[time]).map(([channel, value]) => ({
                channel,
                value
            }))
        }));
        renderXdCards(timeBlocks);

        // 处理新返利数据（gbo）
        const gbo = discountData.gbo || {};
        renderGbo(gbo);

        // 初始化复制按钮（传入xd.template数据）
        initCopyButton(discountData.xd?.template);

    } catch (error) {
        showError('数据加载失败: ' + error.message);
    }
}

// 页面加载时执行
loadData();

function renderXdCards(timeBlocks) {
    const container = document.getElementById('xd-rebate-system');
    const tabsContainer = document.querySelector('.rebate-tabs');

    // 清空容器
    container.innerHTML = '';
    tabsContainer.innerHTML = '';

    if (!timeBlocks || timeBlocks.length === 0) {
        container.innerHTML = '<p>暂无报价</p>';
        return;
    }

    // 渠道太多，按组分好
    const groups = {
        qianbao: {
            label: '钱包',
            channels: ["渠道A", "渠道B", "渠道C", "渠道D", "渠道E", "渠道F", "渠道H"]
        },
        teshu: {
            label: '特殊',
            channels: ["渠道TA", "渠道TB"]
        },
        weixin: {
            label: '微信',
            channels: ["渠道VA", "VB微信10起", "VC微信50", "VD100", "VE200"]
        }
    };

    // 存储每个渠道上一次的折扣值
    const lastDiscountByChannel = {};

    // === 渲染 折扣slide ===
    timeBlocks.forEach((block, index) => {
        // 创建时间块面板
        const slide = document.createElement('div');
        slide.className = 'rebate-slide';
        slide.dataset.time = block.time;

        const timeTitle = document.createElement('h2');
        timeTitle.textContent = `旧返利折扣${(index === 0 && timeBlocks.length === 1) ? '' : `（${block.time}开始）`}`;
        slide.appendChild(timeTitle);

        // 渠道分组进行渲染
        Object.values(groups).forEach(groupInfo => {
            const group = document.createElement('div');
            group.className = 'rebate-group';

            // 渠道标签
            const channelSpan = document.createElement('span');
            channelSpan.className = 'channel-label';
            channelSpan.textContent = groupInfo.label;
            group.appendChild(channelSpan);

            // 渠道列表
            const channelList = document.createElement('div');
            channelList.className = 'channel-list';
            // 渲染标签当中每个渠道（渠道列表）
            groupInfo.channels.forEach(channelName => {
                const item = block.rates.find(i => i.channel === channelName);
                if (!item) return;

                // 颜色判定（默认黑色 涨价红色 降价绿色）
                let color = 'black';
                if (index > 0) {
                    const last = lastDiscountByChannel[channelName];
                    if (last !== undefined) {
                        if (item.discount > last) color = 'red';
                        else if (item.discount < last) color = 'green';
                    }
                }

                const channelItem = document.createElement('div');
                channelItem.className = 'channel-item';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'channel-name';
                nameSpan.textContent = channelName;

                const discountSpan = document.createElement('span');
                discountSpan.className = 'channel-discount';
                discountSpan.textContent = item.discount;
                discountSpan.style.color = color;

                channelItem.appendChild(nameSpan);
                channelItem.appendChild(discountSpan);
                channelList.appendChild(channelItem);

                // 更新当前渠道的 last discount
                lastDiscountByChannel[channelName] = item.discount;
            });

            group.appendChild(channelList);
            slide.appendChild(group);
        });

        container.appendChild(slide);
    });

    // === 如果有多个时间块，才渲染 tabs ===
    if (timeBlocks.length > 1) {
        tabsContainer.style.display = '';

        // 创建时间标签
        timeBlocks.forEach((block, index) => {
            const slide = container.querySelectorAll('.rebate-slide')[index];
            const tab = document.createElement('div');
            tab.className = `rebate-tab ${index === timeBlocks.length - 1 ? 'active' : ''}`;
            tab.textContent = block.time;
            // 绑定点击样式
            tab.addEventListener('click', () => {
                slide.scrollIntoView({behavior: 'smooth'});
                document.querySelectorAll('.rebate-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
            tabsContainer.appendChild(tab);
        });

        // 监听滚动事件，更新活跃标签
        container.addEventListener('scroll', () => {
            const slides = document.querySelectorAll('.rebate-slide');
            const tabs = document.querySelectorAll('.rebate-tab');
            slides.forEach((slide, index) => {
                const rect = slide.getBoundingClientRect();
                if (rect.left >= 0 && rect.right <= window.innerWidth) {
                    tabs.forEach(t => t.classList.remove('active'));
                    tabs[index].classList.add('active');
                }
            });
        });

        // 默认滚动到最后一个时间块
        setTimeout(() => {
            const lastSlide = document.querySelector('.rebate-slide:last-child');
            if (lastSlide) {
                lastSlide.scrollIntoView({behavior: 'smooth'});
            }
        }, 100);
    } else {
        // 如果只有一个时间块，直接隐藏 tab 容器
        tabsContainer.style.display = 'none';
    }
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


function renderXyCards(timeBlocks) {
    const container = document.getElementById('xy-rebate-system');
    const tabsContainer = document.querySelector('.rebate-tabs');

    // 清空容器
    container.innerHTML = '';
    tabsContainer.innerHTML = '';

    if (!timeBlocks || timeBlocks.length === 0) {
        container.innerHTML = '<p>暂无报价</p>';
        return;
    }

    // 渠道太多，按组分好
    const groups = {
        qianbao: {
            label: '钱包',
            channels: []
        },
        teshu: {
            label: '特殊',
            channels: []
        },
        weixin: {
            label: '微信',
            channels: ["微信小额", "微信双端", "微信固额"]
        }
    };

    // 存储每个渠道上一次的折扣值
    const lastDiscountByChannel = {};

    // === 渲染 折扣slide ===
    timeBlocks.forEach((block, index) => {
        // 创建时间块面板
        const slide = document.createElement('div');
        slide.className = 'rebate-slide';
        slide.dataset.time = block.time;

        const timeTitle = document.createElement('h2');
        timeTitle.textContent = `星悦折扣${(index === 0 && timeBlocks.length === 1) ? '' : `（${block.time}开始）`}`;
        slide.appendChild(timeTitle);

        // 渠道分组进行渲染
        Object.values(groups).forEach(groupInfo => {
            const group = document.createElement('div');
            group.className = 'rebate-group';

            // 渠道标签
            const channelSpan = document.createElement('span');
            channelSpan.className = 'channel-label';
            channelSpan.textContent = groupInfo.label;
            group.appendChild(channelSpan);

            // 渠道列表
            const channelList = document.createElement('div');
            channelList.className = 'channel-list';
            // 渲染标签当中每个渠道（渠道列表）
            groupInfo.channels.forEach(channelName => {
                const item = block.rates.find(i => i.channel === channelName);
                if (!item) return;

                // 颜色判定（默认黑色 涨价红色 降价绿色）
                let color = 'black';
                if (index > 0) {
                    const last = lastDiscountByChannel[channelName];
                    if (last !== undefined) {
                        if (item.discount > last) color = 'red';
                        else if (item.discount < last) color = 'green';
                    }
                }

                const channelItem = document.createElement('div');
                channelItem.className = 'channel-item';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'channel-name';
                nameSpan.textContent = channelName;

                const discountSpan = document.createElement('span');
                discountSpan.className = 'channel-discount';
                discountSpan.textContent = item.discount;
                discountSpan.style.color = color;

                channelItem.appendChild(nameSpan);
                channelItem.appendChild(discountSpan);
                channelList.appendChild(channelItem);

                // 更新当前渠道的 last discount
                lastDiscountByChannel[channelName] = item.discount;
            });

            group.appendChild(channelList);
            slide.appendChild(group);
        });

        container.appendChild(slide);
    });

    // === 如果有多个时间块，才渲染 tabs ===
    if (timeBlocks.length > 1) {
        tabsContainer.style.display = '';

        // 创建时间标签
        timeBlocks.forEach((block, index) => {
            const slide = container.querySelectorAll('.rebate-slide')[index];
            const tab = document.createElement('div');
            tab.className = `rebate-tab ${index === timeBlocks.length - 1 ? 'active' : ''}`;
            tab.textContent = block.time;
            // 绑定点击样式
            tab.addEventListener('click', () => {
                slide.scrollIntoView({behavior: 'smooth'});
                document.querySelectorAll('.rebate-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
            tabsContainer.appendChild(tab);
        });

        // 监听滚动事件，更新活跃标签
        container.addEventListener('scroll', () => {
            const slides = document.querySelectorAll('.rebate-slide');
            const tabs = document.querySelectorAll('.rebate-tab');
            slides.forEach((slide, index) => {
                const rect = slide.getBoundingClientRect();
                if (rect.left >= 0 && rect.right <= window.innerWidth) {
                    tabs.forEach(t => t.classList.remove('active'));
                    tabs[index].classList.add('active');
                }
            });
        });

        // 默认滚动到最后一个时间块
        setTimeout(() => {
            const lastSlide = document.querySelector('.rebate-slide:last-child');
            if (lastSlide) {
                lastSlide.scrollIntoView({behavior: 'smooth'});
            }
        }, 100);
    } else {
        // 如果只有一个时间块，直接隐藏 tab 容器
        tabsContainer.style.display = 'none';
    }
}


// 直接使用 discountData.gbo 中的 {渠道: {price, paths}} 数据
function renderGbo(gbo) {
    const container = document.getElementById('gboChannelList');
    container.innerHTML = '';

    // 校验数据是否存在
    if (!gbo || typeof gbo !== 'object' || Object.keys(gbo).length === 0) {
        container.innerHTML = '<p>暂无报价</p>';
        return;
    }

    const channels = Object.keys(gbo);

    // 渲染每个渠道项
    channels.forEach(channel => {
        const { price, paths } = gbo[channel];
        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        // 悬停提示使用 paths 数组（换行分隔）
        channelItem.setAttribute('data-tooltip', paths.join('\n'));
        // 显示渠道名和价格
        // channelItem.innerHTML = `${channel} <strong>${price}</strong>`;
        const nameSpan = document.createElement('span');
        nameSpan.className = 'channel-name';
        nameSpan.textContent = channel;

        const discountSpan = document.createElement('span');
        discountSpan.className = 'channel-discount';
        discountSpan.textContent = price;

        channelItem.appendChild(nameSpan);
        channelItem.appendChild(discountSpan);
        container.appendChild(channelItem);
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
    notification.className = 'notification';
    if (isError) notification.classList.add('error');
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}


// 主数据加载逻辑
async function loadData() {
    try {
        const params = new URLSearchParams(window.location.search);
        const profit = params.get('profit');
        let discountUrl = '/api/discount';
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

        // 渲染小刀数据
        const xdTimeBlocks = Object.entries(discountData.xd || {})
            .filter(([key]) => key !== 'template')
            .map(([time, channels]) => ({
                time,
                rates: Object.entries(channels).map(([channel, discount]) => ({ channel, discount }))
            }));
        renderXdCards(xdTimeBlocks);
        // 初始化复制按钮（传入xd.template数据）
        initCopyButton(discountData.xd?.template);

        // 渲染星悦数据
        const xyTimeBlocks = Object.entries(discountData.xy || {})
            .map(([time, channels]) => ({
                time,
                rates: Object.entries(channels).map(([channel, discount]) => ({ channel, discount }))
            }));
        renderXyCards(xyTimeBlocks);

        // 渲染gbo数据
        renderGbo(discountData.gbo || {});

    } catch (error) {
        showError('数据加载失败: ' + error.message);
    }
}

// 页面加载时执行
loadData();

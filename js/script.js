// ========== 小刀 ==========
function renderXdCards(timeBlocks) {
    const panel = document.getElementById('xd-panel');
    const tabsContainer = panel.querySelector('.rebate-tabs');
    const container = panel.querySelector('.rebate-slides');

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
                tabsContainer.querySelectorAll('.rebate-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
            tabsContainer.appendChild(tab);
        });

        // 监听滚动时间，更新活跃标签
        container.addEventListener('scroll', () => {
            const tabs = tabsContainer.querySelectorAll('.rebate-tab');
            const slides = container.querySelectorAll('.rebate-slide');
            slides.forEach((slide, index) => {
                const rect = slide.getBoundingClientRect();
                if (rect.left >= 0 && rect.right <= window.innerWidth) {
                    tabs.forEach(t => t.classList.remove('active'));
                    tabs[index].classList.add('active');
                }
            });
        });

        // 默认滚动到最后一哥时间块
        setTimeout(() => {
            const lastSlide = container.querySelector('.rebate-slide:last-child');
            if (lastSlide) {
                lastSlide.scrollIntoView({behavior: 'smooth'});
            }
        }, 100);
    } else {
        // 如果只有一哥时间块，直接隐藏tab容器
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


// ========== 星悦 ==========
function renderXyCards(timeBlocks) {
    const panel = document.getElementById('xy-panel');
    const tabsContainer = panel.querySelector('.rebate-tabs');
    const container = panel.querySelector('.rebate-slides');


    // 清空容器
    container.innerHTML = '';
    tabsContainer.innerHTML = '';

    if (!timeBlocks || timeBlocks.length === 0) {
        container.innerHTML = '<p>暂无报价</p>';
        return;
    }

    // 渠道太多，按组分好
    const groups = {
        weixin: {
            label: '微信',
            channels: ["微信小额", "微信双端", "微信固额"]
        }
    };

    tooltipMap = {
        "微信小额": "额度50",
        "微信双端": "额度100-1000",
        "微信固额": "额度200"
    }

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
                // 悬停提示使用
                channelItem.setAttribute('data-tooltip', tooltipMap[channelName]);

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
                tabsContainer.querySelectorAll('.rebate-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
            tabsContainer.appendChild(tab);
        });

        // 监听滚动时间，更新活跃标签
        container.addEventListener('scroll', () => {
            const tabs = tabsContainer.querySelectorAll('.rebate-tab');
            const slides = container.querySelectorAll('.rebate-slide');
            slides.forEach((slide, index) => {
                const rect = slide.getBoundingClientRect();
                if (rect.left >= 0 && rect.right <= window.innerWidth) {
                    tabs.forEach(t => t.classList.remove('active'));
                    tabs[index].classList.add('active');
                }
            });
        });

        // 默认滚动到最后一哥时间块
        setTimeout(() => {
            const lastSlide = container.querySelector('.rebate-slide:last-child');
            if (lastSlide) {
                lastSlide.scrollIntoView({behavior: 'smooth'});
            }
        }, 100);
    } else {
        // 如果只有一哥时间块，直接隐藏tab容器
        tabsContainer.style.display = 'none';
    }
}


// ========== GBO ==========
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
        const {price, paths} = gbo[channel];
        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        // 悬停提示使用 paths 数组（换行分隔）
        channelItem.setAttribute('data-tooltip', paths.join('\n'));
        // 显示渠道名和价格
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
        const profit = 0;
        const discountData = {
            "yesterdayPage": "https://3577fc03.iiifox.me/",
            "date": "2025-10-14",
            "xd": {
                "00:00": {
                    "渠道A": 0.895,
                    "渠道B": 0.9,
                    "渠道C": 0.905,
                    "渠道D": 0.915,
                    "渠道E": 0.92,
                    "渠道F": 0.925,
                    "渠道TA": 0.96,
                    "渠道TB": 0.965,
                    "渠道VA": 0.89,
                    "VB微信10起": 0.83,
                    "VC微信50": 0.855,
                    "VD100": 0.87,
                    "VE200": 0.9
                },
                "11:10": {
                    "渠道A": 0.895,
                    "渠道B": 0.9,
                    "渠道C": 0.905,
                    "渠道D": 0.915,
                    "渠道E": 0.92,
                    "渠道F": 0.93,
                    "渠道TA": 0.96,
                    "渠道TB": 0.97,
                    "渠道VA": 0.89,
                    "VB微信10起": 0.83,
                    "VC微信50": 0.855,
                    "VD100": 0.87,
                    "VE200": 0.9
                },
                "template": "渠道A00:00/0.895\n渠道A11:10/0.895\n渠道B00:00/0.9\n渠道B11:10/0.9\n渠道C00:00/0.905\n渠道C11:10/0.905\n渠道D00:00/0.915\n渠道D11:10/0.915\n渠道E00:00/0.92\n渠道E11:10/0.92\n渠道F00:00/0.925\n渠道F11:10/0.93\n渠道TA00:00/0.96\n渠道TA11:10/0.96\n渠道TB00:00/0.965\n渠道TB11:10/0.97\n渠道VA00:00/0.89\n渠道VA11:10/0.89\nVB微信10起00:00/0.83\nVB微信10起11:10/0.83\nVC微信5000:00/0.855\nVC微信5011:10/0.855\nVD10000:00/0.87\nVD10011:10/0.87\nVE20000:00/0.9\nVE20011:10/0.9"
            },
            "xy": {
                "00:00": {
                    "微信小额": 0.86,
                    "微信双端": 0.895,
                    "微信固额": 0.905
                }
            },
            "gbo": {
                "1起": {
                    "price": 0.76,
                    "paths": [
                        "腾讯综合(1起)",
                        "腾讯端游无限充(1起)",
                        "腾讯QB无限充(1起)"
                    ]
                },
                "10起": {
                    "price": 0.805,
                    "paths": [
                        "腾讯综合(10起)",
                        "腾讯端游(10起)",
                        "王者点卷（10起）",
                        "无畏契约无线充(10)",
                        "腾讯综合无限充(10起)",
                        "腾讯端游无限充(10起)"
                    ]
                },
                "10可限": {
                    "price": 0.82,
                    "paths": [
                        "腾讯综合(10起可限)",
                        "腾讯端游(10起可限)"
                    ]
                },
                "50起": {
                    "price": 0.82,
                    "paths": [
                        "腾讯综合(50起)",
                        "腾讯端游(50起）",
                        "心悦DNF(50起)",
                        "王者点卷（50起）",
                        "lolm点卷红包（50）"
                    ]
                },
                "100起": {
                    "price": 0.845,
                    "paths": [
                        "腾讯综合(100起)",
                        "腾讯端游(100起）",
                        "心悦DNF(100起)",
                        "王者点卷（100起）",
                        "lolm点卷红包（100）"
                    ]
                },
                "100极速": {
                    "price": 0.855,
                    "paths": [
                        "腾讯综合(极速100起)",
                        "腾讯端游(极速100起)",
                        "王者点卷（极速100起）",
                        "心悦DNF（极速100起）",
                        "lolm点卷红包(极速100)"
                    ]
                },
                "单笔200": {
                    "price": 0.855,
                    "paths": [
                        "单笔200（赠送点卷）"
                    ]
                },
                "200极速": {
                    "price": 0.86,
                    "paths": [
                        "单笔200(极速赠送点卷)"
                    ]
                },
                "可限": {
                    "price": 0.855,
                    "paths": [
                        "腾讯综合(可限金额)",
                        "腾讯端游(可限金额）",
                        "心悦DNF(可限金额)",
                        "lolm点卷红包（200）"
                    ]
                },
                "可限极速": {
                    "price": 0.86,
                    "paths": [
                        "腾讯综合(极速可限金额)",
                        "腾讯端游(极速可限金额)",
                        "心悦dnf（极速可限额）",
                        "lolm点卷红包(极速200)"
                    ]
                },
                "qb10起": {
                    "price": 0.875,
                    "paths": [
                        "腾讯QB(10起)"
                    ]
                },
                "qb10可限": {
                    "price": 0.885,
                    "paths": [
                        "腾讯QB(10起可限)"
                    ]
                },
                "qb50起": {
                    "price": 0.895,
                    "paths": [
                        "腾讯Q币(50起)"
                    ]
                },
                "qb100起": {
                    "price": 0.92,
                    "paths": [
                        "腾讯Q币(100起)"
                    ]
                },
                "心悦": {
                    "price": 0.845,
                    "paths": [
                        "悦享卡/小黑卡(心悦100)",
                        "悦享卡/小黑卡(心悦200)"
                    ]
                }
            }
        };

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
                rates: Object.entries(channels).map(([channel, discount]) => ({channel, discount}))
            }));
        renderXdCards(xdTimeBlocks);
        // 初始化复制按钮（传入xd.template数据）
        initCopyButton(discountData.xd?.template);

        // 渲染星悦数据
        const xyTimeBlocks = Object.entries(discountData.xy || {})
            .map(([time, channels]) => ({
                time,
                rates: Object.entries(channels).map(([channel, discount]) => ({channel, discount}))
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

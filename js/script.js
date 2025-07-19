// 辅助函数：标准化时间格式
function formatTime(timeStr) {
	const [hour, minute] = timeStr.split(':');
	return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

// 辅助函数：格式化费率值 映射到区间 {0}∪[0.2,2)
function formatRateValue(value) {
	const num = Number(value);
    if (num < 0 || num > 2000) return "Error";
    if (num === 0) return 0;
    
    if (num < 2) return num;
    if (num < 20) return parseFloat((num / 10).toFixed(3));
    if (num < 200) return parseFloat((num / 100).toFixed(3));
    return parseFloat((num / 1000).toFixed(3));
}

// 从price.txt获取数据
async function fetchPriceData() {
	try {
		const response = await fetch('price.txt');
		if (!response.ok) throw new Error('文件访问失败');
		return await response.text();
	} catch (error) {
		showError('获取数据失败: ' + error.message);
		return null;
	}
}

// 解析price.txt数据（核心修改部分）
function parsePriceData(text) {
	const lines = text.split('\n');
	const timeBlocks = [];
	let currentBlock = null;
	let date = '';
	let notes = [];
	let emptyLineCount = 0;
	let isNotesSection = false;

	for (const line of lines) {
		const trimmedLine = line.trim();

		// 检测空行
		if (trimmedLine === '') {
			emptyLineCount++;
			if (emptyLineCount >= 3) {
				isNotesSection = true;
			}
			continue;
		} else {
			emptyLineCount = 0;
		}

		// 昨日费率 超链接形式
		if (/^https:\/\/[\w-]+(\.[\w-]+)+(?:\/[^\s?#]*)?(?:\?[^#\s]*)?(?:#\S*)?/i.test(trimmedLine)) {
			document.getElementById("yesterday").href = trimmedLine;
			continue;
		}

		// 微信费率部分
		if (isNotesSection) {
			notes.push(trimmedLine);
			continue;
		}

		// 检测日期行
		if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmedLine)) {
			date = trimmedLine;
			continue;
		}

		// 检测时间块开始
		const timeMatch = trimmedLine.match(/(\d{1,2}:\d{2})\s*开始/);
		if (timeMatch) {
			if (currentBlock) timeBlocks.push(currentBlock);
			currentBlock = {
				time: timeMatch[1],
				rates: []
			};
			continue;
		}

		// 返利平台费率行。可能会一行多个费率用逗号分隔
		const ratePairs = trimmedLine.split(/[，,]/);
		for (const pair of ratePairs) {
			const match = pair.match(/(.*?)\s*(\d*\.?\d+)$/);
			if (match) {
				const channel = match[1].trim();
				const value = formatRateValue(match[2].trim());
				if (currentBlock) {
					currentBlock.rates.push({channel, value});
				} else {
					if (timeBlocks.length === 0) {
						timeBlocks.push({time: '00:00', rates: []});
					}
					// 00:00调价下的渠道
					timeBlocks[0].rates.push({channel, value});
				}
			}
		}
	}

	// 添加最后一个区块
	if (currentBlock) timeBlocks.push(currentBlock);


	// 标准化所有时间显示
	timeBlocks.forEach(block => {
		block.time = formatTime(block.time);
	});

	// 确定更新时间（核心逻辑）
	const updateTime = `${date} ${timeBlocks[timeBlocks.length - 1].time}`

	return {
		date,
		timeBlocks,
		notes,
		updateTime
	};
}

// 渲染返利平台调价卡片
function renderPriceCards(data) {
	const container = document.getElementById('priceContainer');

	if (!data || !data.timeBlocks || data.timeBlocks.length === 0) {
		container.innerHTML = '<div class="error">未找到有效的价格数据</div>';
		return;
	}

	// 更新页面上的时间
	if (data.updateTime) {
		document.getElementById('updateTime').textContent = data.updateTime;
	}

	container.innerHTML = '';

	// 渲染每个时间块
	data.timeBlocks.forEach(block => {
		const card = document.createElement('div');
		card.className = 'price-card';

		const header = document.createElement('div');
		header.className = 'card-header';
		header.textContent = `${block.time}`;

		const content = document.createElement('div');
		content.className = 'card-content';

		// 添加费率项
		block.rates.forEach(rate => {
			const item = document.createElement('div');
			item.className = 'price-item';
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

// 渲染微信折扣
function renderNotes(notes) {
	const container = document.getElementById('notesGrid');
	container.innerHTML = '';

	if (!notes || notes.length === 0) {
		container.innerHTML = '<p>暂无微信报价</p>';
		return;
	}

	notes.forEach(note => {
		const match = note.match(/(.*?)\s*(\d*\.?\d+)$/);
		if (match) {
			const prefix = match[1].trim();
			const discount = formatRateValue(match[2].trim());
			const noteItem = document.createElement('div');
			noteItem.className = 'note-item';
			noteItem.innerHTML = `${prefix} <strong>${discount}</strong>`;
			container.appendChild(noteItem);
		}
	});
}

// 显示错误信息
function showError(message) {
	const container = document.getElementById('priceContainer');
	container.innerHTML = `
			<div class="error">
				<p>${message}</p>
				<p>请确保price.txt文件存在于项目根目录</p>
				<button class="refresh-btn" onclick="location.reload()">刷新页面</button>
			</div>
		`;

	document.getElementById('copyRatesBtn').disabled = true;
}

// 复制费率到剪贴板
async function copyRatesToClipboard(data) {
	if (!data || !data.timeBlocks || data.timeBlocks.length === 0) {
		showNotification('没有可复制的数据', true);
		return;
	}

	// 获取所有渠道（去重）
	const allChannels = new Set();
	data.timeBlocks.forEach(block => {
		block.rates.forEach(rate => {
			allChannels.add(rate.channel);
		});
	});

	// 为每个渠道创建费率时间线
	const channelTimelines = {};
	allChannels.forEach(channel => {
		channelTimelines[channel] = [];
	});

	// 初始化所有渠道在第一个时间块（默认为0）
	allChannels.forEach(channel => {
		const rate = data.timeBlocks[0].rates.find(r => r.channel === channel);
		channelTimelines[channel].push({
		  time: data.timeBlocks[0].time,
		  value: rate ? rate.value : '0'
		});
	});

	// 处理后续时间块
	for (let i = 1; i < data.timeBlocks.length; i++) {
		const block = data.timeBlocks[i];

		allChannels.forEach(channel => {
			// 检查该渠道在当前时间块是否有明确费率
			const explicitRate = block.rates.find(rate => rate.channel === channel);
			if (explicitRate) {
				// 有明确费率，使用新值
				channelTimelines[channel].push({
					time: block.time,
					value: explicitRate.value
				});
			} else {
				// 没有明确费率，继承前一个时间块的值
				const lastEntry = channelTimelines[channel][channelTimelines[channel].length - 1];
				channelTimelines[channel].push({
					time: block.time,
					value: lastEntry.value
				});
			}
		});
	}

	// 构建复制字符串
	let ratesString = '';
	allChannels.forEach(channel => {
		channelTimelines[channel].forEach(entry => {
			ratesString += `${channel}${entry.time}/${entry.value}\n`;
		});
	});

	try {
		await navigator.clipboard.writeText(ratesString);
		showNotification('费率已复制到剪贴板');
	} catch (err) {
		showNotification('复制失败: ' + err.message, true);
	}
}

// 显示通知
function showNotification(message, isError = false) {
	const notification = document.getElementById('notification');
	notification.textContent = message;
	notification.className = isError ? 'notification error show' : 'notification show';

	setTimeout(() => {
		notification.classList.remove('show');
	}, 3000);
}

// 页面初始化
document.addEventListener('DOMContentLoaded', async () => {
	const rawData = await fetchPriceData();
	if (!rawData) return;

	try {
		const priceData = parsePriceData(rawData);
		renderPriceCards(priceData);
		renderNotes(priceData.notes);

		document.getElementById('copyRatesBtn').addEventListener('click', () => {
			copyRatesToClipboard(priceData);
		});
	} catch (error) {
		showError('解析数据失败: ' + error.message);
	}
});

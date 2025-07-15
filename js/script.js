// 辅助函数：标准化时间格式
function formatTime(timeStr) {
	const [hour, minute] = timeStr.split(':');
	return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

// 辅助函数：格式化费率值
function formatRateValue(value) {
	const num = Number(value);
	if (num === 0) {
		return 0;
	}
	if (num >= 100 && num < 200) {
		return num / 100;
	}
	return parseFloat('0.' + num.toString());
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
			if (emptyLineCount >= 2) {
				isNotesSection = true;
			}
			continue;
		} else {
			emptyLineCount = 0;
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
			const match = pair.match(/(.*[^\d\s])\s*(\d+)$/);
			if (match) {
				const channel = match[1].trim();
				const value = match[2].trim();

				if (currentBlock) {
					currentBlock.rates.push({channel, value});
				} else {
					if (timeBlocks.length === 0) {
						timeBlocks.push({time: '00:00', rates: []});
					}
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
					<span class="value">${formatRateValue(rate.value)}</span>
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
		let prefix = '';
		let discount = '';
		const lastSpaceIndex = note.lastIndexOf(' ');

		// 有空格时，按最后一个空格分割，并去除 prefix 末尾的空格
		if (lastSpaceIndex !== -1) {
			prefix = note.substring(0, lastSpaceIndex).trimEnd();
			discount = note.substring(lastSpaceIndex + 1);
		} else {
			// 无空格时，尝试提取末尾数字
			const numMatch = note.match(/\d+$/);
			if (numMatch) {
				discount = numMatch[0];
				prefix = note.substring(0, note.length - discount.length);
			} else {
				// 无数字时，整个作为 prefix
				prefix = note;
			}
		}

		const noteItem = document.createElement('div');
		noteItem.className = 'note-item';

		// 如果有 discount，加粗显示，并补一个空格
		if (discount) {
			noteItem.innerHTML = `${prefix} <strong>${discount}</strong>`;
		} else {
			noteItem.textContent = prefix;
		}

		container.appendChild(noteItem);
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

// 复制费率到剪贴板（修正版，确保所有时间点都有费率）
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
	const allTimes = data.timeBlocks.map(block => block.time);
	allChannels.forEach(channel => {
		// 检查该渠道是否在第一个时间块存在
		const existsInFirstBlock = data.timeBlocks[0].rates.some(rate => rate.channel === channel);

		channelTimelines[channel].push({
			time: data.timeBlocks[0].time,
			value: existsInFirstBlock ?
				data.timeBlocks[0].rates.find(rate => rate.channel === channel).value :
				'0' // 不存在则设为0
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
			ratesString += `${channel}${entry.time}/${formatRateValue(entry.value)}\n`;
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

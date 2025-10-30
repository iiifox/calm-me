// 获取通知内容并动态创建 notice-box
async function loadNotice() {
    try {
        const response = await fetch('/notice/header.txt');
        if (!response.ok) throw new Error('请求失败: ' + response.status);
        const text = await response.text(); // 返回纯文本

        // 创建 notice-box
        const noticeBox = document.createElement('div');
        noticeBox.id = 'notice';
        noticeBox.className = 'notice-box';
        noticeBox.textContent = text;

        // 保留文本换行、空格，并左对齐
        noticeBox.style.width = 'fit-content';
        noticeBox.style.whiteSpace = 'pre-wrap';
        noticeBox.style.textAlign = 'left';
        noticeBox.style.maxWidth = '62vw';
        // 设置最大高度和滚动
        noticeBox.style.maxHeight = '500px';
        noticeBox.style.overflowY = 'auto';

        // 添加到 bell 容器中
        const bellContainer = document.getElementById('bell');
        bellContainer.appendChild(noticeBox);

        // 初始隐藏
        noticeBox.style.display = 'none';

        // 点击小红点显示/隐藏
        bellContainer.addEventListener('click', () => {
            noticeBox.style.display = noticeBox.style.display === 'none' ? 'block' : 'none';
        });

    } catch (err) {
        console.error('加载通知失败:', err);
    }
}

// 页面加载后调用
document.addEventListener('DOMContentLoaded', loadNotice);

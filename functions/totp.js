export async function onRequestGet(context) {
    const {request} = context;
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');

    // 只验证secret参数
    if (!secret) {
        return new Response(JSON.stringify({error: '缺少secret参数'}), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
            },
        });
    }

    try {
        // 使用标准默认参数：SHA-1算法、6位数字、30秒周期
        const code = await generateTOTP(secret);

        return new Response(JSON.stringify({code}), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({error: error.message}), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
            },
        });
    }
}

/**
 * 生成TOTP验证码（使用标准默认参数）
 * @param {string} secret - Base32编码的密钥
 * @returns {Promise<string>} TOTP验证码
 */
async function generateTOTP(secret) {
    // 固定使用标准参数
    const algorithm = 'SHA-1';
    const digits = 6;
    const period = 30;

    // 计算当前时间步长
    const timestamp = Date.now();
    let timeStep = Math.floor(timestamp / 1000 / period);

    // 将时间步长转换为8字节的Uint8Array (大端序)
    const timeBuffer = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
        timeBuffer[i] = timeStep & 0xff;
        timeStep >>>= 8; // 无符号右移
    }

    // 解码Base32密钥
    const keyBuffer = base32ToUint8Array(secret);

    // 使用crypto.subtle计算HMAC
    const hmacBuffer = await hmac(keyBuffer, timeBuffer, algorithm);

    // 动态截断(DT)
    const otpValue = truncate(hmacBuffer);

    // 转换为指定长度的数字并返回
    const otp = otpValue % (10 ** digits);
    return otp.toString().padStart(digits, '0');
}

/**
 * Base32解码（兼容标准TOTP密钥格式）
 * @param {string} base32 - Base32编码字符串
 * @returns {Uint8Array} 解码后的二进制数据
 */
function base32ToUint8Array(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    // 预处理：转换为大写并去除填充字符
    base32 = base32.toUpperCase().replace(/=+$/, '');

    const bytes = [];
    let bits = 0;
    let value = 0;

    for (const char of base32) {
        const index = alphabet.indexOf(char);
        if (index === -1) {
            throw new Error(`无效的Base32字符: ${char}`);
        }

        // 每个字符代表5位
        value = (value << 5) | index;
        bits += 5;

        // 当累计满8位时，提取一个字节
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }

    return new Uint8Array(bytes);
}

/**
 * 使用Web Crypto API计算HMAC-SHA1
 * @param {Uint8Array} key - 密钥
 * @param {Uint8Array} data - 数据
 * @param {string} algorithm - 哈希算法
 * @returns {Promise<Uint8Array>} HMAC结果
 */
async function hmac(key, data, algorithm) {
    // 导入密钥
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        {name: 'HMAC', hash: {name: algorithm}},
        false,
        ['sign']
    );

    // 计算HMAC
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);

    return new Uint8Array(signature);
}

/**
 * 动态截断函数 (DT)
 * @param {Uint8Array} hmacResult - HMAC计算结果
 * @returns {number} 截断后的值
 */
function truncate(hmacResult) {
    // 取最后一个字节的低4位作为偏移量
    const offset = hmacResult[hmacResult.length - 1] & 0x0f;

    // 从偏移量开始取4个字节，并处理为32位无符号整数
    const truncated =
        ((hmacResult[offset] & 0x7f) << 24) |  // 清除最高位，避免符号问题
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

    return truncated;
}
    

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
        // 改动点：返回 code + remaining
        const {code, remaining} = await generateTOTP(secret);

        return new Response(JSON.stringify({code, remaining}), {
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
 * 生成TOTP验证码并返回剩余有效秒数
 * @param {string} secret - Base32编码的密钥
 * @returns {Promise<{code: string, remaining: number}>}
 */
async function generateTOTP(secret) {
    const algorithm = 'SHA-1';
    const digits = 6;
    const period = 30;

    const timestamp = Date.now();
    let timeStep = Math.floor(timestamp / 1000 / period);

    // 改动点：新增剩余秒数
    const remaining = period - (Math.floor(timestamp / 1000) % period);

    // 时间步转8字节大端序
    const timeBuffer = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
        timeBuffer[i] = timeStep & 0xff;
        timeStep >>>= 8;
    }

    const keyBuffer = base32ToUint8Array(secret);
    const hmacBuffer = await hmac(keyBuffer, timeBuffer, algorithm);
    const otpValue = truncate(hmacBuffer);

    const otp = (otpValue % (10 ** digits)).toString().padStart(digits, '0');
    return {code: otp, remaining}; // 改动点：返回对象
}

function base32ToUint8Array(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    base32 = base32.toUpperCase().replace(/=+$/, '');

    const bytes = [];
    let bits = 0;
    let value = 0;

    for (const char of base32) {
        const index = alphabet.indexOf(char);
        if (index === -1) {
            throw new Error(`无效的Base32字符: ${char}`);
        }
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return new Uint8Array(bytes);
}

async function hmac(key, data, algorithm) {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        {name: 'HMAC', hash: {name: algorithm}},
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return new Uint8Array(signature);
}

function truncate(hmacResult) {
    const offset = hmacResult[hmacResult.length - 1] & 0x0f;
    const truncated =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);
    return truncated;
}

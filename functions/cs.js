export async function onRequest(context) {
    // context 提供 request, env, params, waitUntil, next 等信息
    const {request, params, waitUntil} = context;
    const resp = await fetch(new URL('/config/gbo.json', new URL(request.url).origin));
    if (!resp.ok) {
        return new Response(JSON.stringify({error: '数据源获取失败'}), {
            status: 502,
            headers: {'Content-Type': 'application/json'}
        });
    }
    const text = await resp.json();
    out = {"abc":123}
    return new Response(JSON.stringify(out, null, 2), {
        headers: {'Content-Type': 'application/json'}
    });
  
}

export async function onRequestGet(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId");

    if (!orderId) {
      return new Response(JSON.stringify({ error: "缺少 orderId 参数" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("http://104.143.42.32/WebPayCfld.asmx/getCldcwnTest", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    });

    const text = await resp.text();

    return new Response(JSON.stringify({
      status: resp.status,
      statusText: resp.statusText,
      text
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

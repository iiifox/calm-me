// functions/_middleware.js
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const isPagesDev = url.hostname.endsWith('.pages.dev');
  
  // 阻止直接访问敏感文件
  if (url.pathname.includes('price.txt')) {
    return new Response('Not Found', { status: 404 });
  }
  
  // 仅处理.pages.dev的根请求
  if (isPagesDev && url.pathname === '/') {
    // 从非公开位置获取文件
    const fileResponse = await fetch(new URL('/private/price.txt', url));
    
    // 克隆响应并添加安全头
    const headers = new Headers(fileResponse.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('Content-Security-Policy', "default-src 'none'");
    
    return new Response(fileResponse.body, {
      status: 200,
      headers
    });
  }
  
  // 其他请求正常处理
  return next();
}

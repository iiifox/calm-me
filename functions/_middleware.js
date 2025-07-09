// functions/_middleware.js
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const isPagesDev = url.hostname.endsWith('.pages.dev');
  
  // 处理根路径请求
  if (isPagesDev && url.pathname === '/') {
    try {
      // 获取文件内容（从非公开位置）
      const fileUrl = new URL('/private/price.txt', url.origin);
      const fileResponse = await fetch(fileUrl);
      
      // 如果文件存在则返回
      if (fileResponse.status === 200) {
        const headers = new Headers(fileResponse.headers);
        headers.set('Cache-Control', 'no-store');
        headers.set('Content-Type', 'text/plain');
        
        return new Response(fileResponse.body, {
          status: 200,
          headers
        });
      }
    } catch (e) {
      // 文件获取失败处理
    }
    
    // 文件不存在时返回404
    return new Response('Price data not found', { 
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  // 阻止直接访问私有文件
  if (url.pathname.includes('/private/') || 
      url.pathname.includes('price.txt')) {
    return new Response('Access denied', { 
      status: 403,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  // 6其他请求正常处理
  return next();
}

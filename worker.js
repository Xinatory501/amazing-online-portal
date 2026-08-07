/**
 * Cloudflare Workers Script for Amazing Forum Portal
 * 
 * PURPOSE:
 * - Serves sitemap.xml and robots.txt with proper XML/text Content-Type
 * - index.html is NEVER cached by CDN or Browser (no-cache)
 * - Preserves localStorage authentication sessions (no Clear-Site-Data)
 * - Always serves fresh assets from storage
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const isHtml = pathname === '/' || pathname.endsWith('.html') || pathname === '';

    // Create asset fetch request with cache-busting directives
    const assetRequest = isHtml
      ? new Request(request, {
          cf: {
            cacheTtlByStatus: { "200-299": 0, "400-499": 0, "500-599": 0 },
            cacheEverything: false
          }
        })
      : request;

    const response = await env.ASSETS.fetch(assetRequest);
    const newHeaders = new Headers(response.headers);

    if (pathname === '/sitemap.xml') {
      newHeaders.set('Content-Type', 'application/xml; charset=utf-8');
      newHeaders.set('Cache-Control', 'public, max-age=3600');
    } else if (pathname === '/robots.txt') {
      newHeaders.set('Content-Type', 'text/plain; charset=utf-8');
      newHeaders.set('Cache-Control', 'public, max-age=3600');
    } else if (isHtml) {
      // 🚨 AGGRESSIVE NO-CACHE (Prevents CDN/Browser HTML caching without wiping localStorage)
      newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      newHeaders.set('Pragma', 'no-cache');
      newHeaders.set('Expires', '0');
      newHeaders.set('Surrogate-Control', 'no-store');
      newHeaders.set('CDN-Cache-Control', 'no-store, no-cache');
    } else {
      // JS / CSS / Assets: no-cache for revalidation
      newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};

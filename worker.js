/**
 * Cloudflare Workers Script for Amazing Forum Portal
 * 
 * PURPOSE: Forces absolute cache-busting so that:
 * - index.html is NEVER cached by Cloudflare CDN or Browser
 * - Clear-Site-Data: "cache" header forces browser to purge old cached scripts
 * - Always serves the fresh asset from storage
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

    if (isHtml) {
      // 🚨 AGGRESSIVE NO-CACHE + AUTOMATIC BROWSER CACHE PURGE
      newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      newHeaders.set('Pragma', 'no-cache');
      newHeaders.set('Expires', '0');
      newHeaders.set('Surrogate-Control', 'no-store');
      newHeaders.set('CDN-Cache-Control', 'no-store, no-cache');
      newHeaders.set('Clear-Site-Data', '"cache"');
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

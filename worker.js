/**
 * Cloudflare Workers Script for Amazing Forum Portal
 * 
 * PURPOSE: Forces correct HTTP cache headers so that:
 * - index.html is NEVER cached (always fresh)
 * - JS/CSS assets with version tags are cached for 1 year
 * 
 * This prevents the Cloudflare CDN edge from serving stale
 * old versions of the portal to users even after deploys.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Serve static assets from the ASSETS binding
    const response = await env.ASSETS.fetch(request);

    // Clone and modify headers
    const newHeaders = new Headers(response.headers);

    // Determine cache policy by file type
    const isHtml = pathname === '/' || pathname.endsWith('.html') || pathname === '';
    const isVersionedAsset = /\.(js|css)$/.test(pathname) && (url.search.includes('v=') || pathname !== '/');
    const isFavicon = /\.(ico|png|svg|jpg|jpeg|webp)$/.test(pathname);

    if (isHtml) {
      // HTML pages: NEVER cache — always serve fresh
      newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      newHeaders.set('Pragma', 'no-cache');
      newHeaders.set('Expires', '0');
      newHeaders.set('Surrogate-Control', 'no-store');
      newHeaders.set('CDN-Cache-Control', 'no-store');
    } else if (isVersionedAsset) {
      // Versioned JS/CSS: Cache for 1 year (they have ?v= version busting in HTML)
      newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (isFavicon) {
      // Favicons: Cache for 1 day
      newHeaders.set('Cache-Control', 'public, max-age=86400');
    } else {
      // Everything else: short cache
      newHeaders.set('Cache-Control', 'public, max-age=3600');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};

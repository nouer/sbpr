const { Readable } = require('node:stream');

/**
 * Vercel Serverless Function: OpenAI reverse proxy (same-origin)
 *
 * 目的:
 * - ブラウザから api.openai.com を直叩きするとCORSでブロックされるため、
 *   /openai/* (同一オリジン) -> /api/openai/* -> api.openai.com/* に中継する。
 *
 * ルーティング:
 * - vercel.json rewrite: /openai/:path* -> /api/openai/:path*
 * - catch-all route: /api/openai/[...path] でパスセグメントを取得
 *
 * 方針:
 * - クライアントが送った Authorization をそのまま上流へ転送する（ユーザ自身のキー）。
 * - stream(SSE) も可能な範囲でそのまま転送する。
 */
module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    const pathSegments = req.query.path;
    const pathStr = Array.isArray(pathSegments) ? pathSegments.join('/') : String(pathSegments || '');
    if (!pathStr) {
        res.statusCode = 400;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: { message: 'Missing path' } }));
        return;
    }

    const authorization = req.headers.authorization;
    if (!authorization) {
        res.statusCode = 400;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: { message: 'Missing Authorization header' } }));
        return;
    }

    const upstreamUrl = `https://api.openai.com/${pathStr.replace(/^\/+/, '')}`;
    const method = (req.method || 'GET').toUpperCase();
    const hasBody = !['GET', 'HEAD'].includes(method);

    const headers = { authorization };
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
    if (req.headers.accept) headers.accept = req.headers.accept;

    let upstreamRes;
    try {
        upstreamRes = await fetch(upstreamUrl, {
            method,
            headers,
            body: hasBody ? req : undefined,
            duplex: hasBody ? 'half' : undefined,
        });
    } catch (e) {
        res.statusCode = 502;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: { message: `Upstream fetch failed: ${e.message}` } }));
        return;
    }

    res.statusCode = upstreamRes.status;

    const contentType = upstreamRes.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    const cacheControl = upstreamRes.headers.get('cache-control');
    if (cacheControl) res.setHeader('cache-control', cacheControl);

    if (upstreamRes.body) {
        Readable.fromWeb(upstreamRes.body).pipe(res);
        return;
    }

    const text = await upstreamRes.text().catch(() => '');
    res.end(text);
};

// Dev-only proxy so the web preview can reach official Turkish endpoints
// that don't set CORS headers. Same-origin fetch → no browser block.
// Native / Expo Go builds hit the real hosts directly and never touch this.

const { getDefaultConfig } = require('expo/metro-config');
const https = require('https');
const { URL } = require('url');

const config = getDefaultConfig(__dirname);

const PROXIES = [
  // /api/afad/... → https://deprem.afad.gov.tr/apiv2/...
  { prefix: '/api/afad/', target: 'https://deprem.afad.gov.tr/apiv2/' },
  // /api/aa/rss?cat=politika → https://www.aa.com.tr/tr/rss/default?cat=politika
  { prefix: '/api/aa/', target: 'https://www.aa.com.tr/tr/' },
];

config.server = config.server || {};
const previous = config.server.enhanceMiddleware;

config.server.enhanceMiddleware = (middleware, metroServer) => {
  const wrapped = previous ? previous(middleware, metroServer) : middleware;
  return (req, res, next) => {
    const route = PROXIES.find((p) => req.url && req.url.startsWith(p.prefix));
    if (!route) return wrapped(req, res, next);

    const upstreamUrl = new URL(req.url.replace(route.prefix, ''), route.target);
    const fetchFollow = (url, hops) => {
      if (hops > 4) {
        res.statusCode = 508;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end('Too many redirects');
        return;
      }
      https
        .get(url, { headers: { 'User-Agent': 'GundemDevProxy/1.0' } }, (upstream) => {
          const code = upstream.statusCode || 200;
          if (code >= 300 && code < 400 && upstream.headers.location) {
            upstream.resume(); // drain
            const next = new URL(upstream.headers.location, url);
            fetchFollow(next, hops + 1);
            return;
          }
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/json');
          res.statusCode = code;
          upstream.pipe(res);
        })
        .on('error', (err) => {
          res.statusCode = 502;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ error: String(err) }));
        });
    };
    fetchFollow(upstreamUrl, 0);
  };
};

module.exports = config;

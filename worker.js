/**
 * 小破站 AI · 免费中转（Cloudflare Worker）
 * ------------------------------------------------------------
 * 作用：把 Toy 页面发来的请求转发给智谱 BigModel 免费模型，
 *      解决浏览器跨域（CORS）问题，并把 API Key 藏在服务端。
 *
 * 部署：
 *   1) npm i -g wrangler && wrangler login
 *   2) wrangler secret put ZHIPU_API_KEY     # 粘贴你的 Key
 *   3) wrangler secret put TOY_TOKEN         # 可选，自定义一串口令
 *   4) wrangler deploy
 *
 * 环境变量：
 *   ZHIPU_API_KEY  必填，https://open.bigmodel.cn/usercenter/apikeys
 *   TOY_TOKEN      可选，填了之后前端要带同样的 X-Toy-Token
 *   ALLOW_ORIGIN   可选，默认 *，可收紧为 https://www.bilibili.com
 */

// 官方免费档（0 元）
const FREE_MODELS = [
  'glm-4.7-flash',
  'glm-4-flash-250414',
  'glm-4.5-flash',
  'glm-4-flash',
  'glm-4.6v-flash',
  'glm-4v-flash',
];

// 允许调用的模型 = 免费档 + 按量计费的主力模型（作者垫付）
// 只想跑纯免费的话，把 PAID_MODELS 清空即可
const PAID_MODELS = ['glm-5.3-flash'];
const ALLOWED_MODELS = new Set([...FREE_MODELS, ...PAID_MODELS]);

const UPSTREAM = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 极简内存限流（每个 isolate 独立，近似值，够防手滑脚本）
const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_MIN = 20;

function rateLimited(ip) {
  const now = Date.now();
  const key = ip + ':' + Math.floor(now / WINDOW_MS);
  const n = (buckets.get(key) || 0) + 1;
  buckets.set(key, n);
  if (buckets.size > 5000) buckets.clear(); // 防内存膨胀
  return n > MAX_PER_MIN;
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors),
  });
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Toy-Token, X-User-Key',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    let path = url.pathname;
    while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    if (path === '') path = '/';

    if (path === '/health' || path === '/') {
      return json({
        ok: true,
        service: 'bili-toy-ai-relay',
        model: 'glm-4.7-flash',
        freeModels: FREE_MODELS,
        paidModels: PAID_MODELS,
        hasKey: !!env.ZHIPU_API_KEY,
      }, 200, cors);
    }

    if (path !== '/v1/chat') return json({ error: { message: 'Not Found' } }, 404, cors);
    if (request.method !== 'POST') return json({ error: { message: '只支持 POST' } }, 405, cors);

    // 口令（可选）
    if (env.TOY_TOKEN) {
      const got = request.headers.get('X-Toy-Token') || '';
      if (got !== env.TOY_TOKEN) {
        return json({ error: { message: '中转口令不正确，请检查前端 CONFIG.TOY_TOKEN' } }, 401, cors);
      }
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (rateLimited(ip)) {
      return json({ error: { message: '请求太频繁啦，歇一分钟再来' } }, 429, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: { message: '请求体不是合法 JSON' } }, 400, cors);
    }

    const model = String(body.model || 'glm-5.3-flash');
    if (!ALLOWED_MODELS.has(model)) {
      return json({ error: { message: '不支持这个模型，可选：' + Array.from(ALLOWED_MODELS).join(', ') } }, 400, cors);
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return json({ error: { message: 'messages 不能为空' } }, 400, cors);
    if (messages.length > 40) return json({ error: { message: '上下文太长了，清空对话再来' } }, 400, cors);

    let total = 0;
    const clean = [];
    for (const m of messages) {
      const role = m && m.role;
      const content = m && m.content;
      if (!['system', 'user', 'assistant'].includes(role)) continue;
      if (typeof content !== 'string' || !content.trim()) continue;
      total += content.length;
      if (total > 60000) return json({ error: { message: '内容太长了，清空对话再来' } }, 400, cors);
      clean.push({ role, content: content.slice(0, 20000) });
    }

    const key = (request.headers.get('X-User-Key') || '').trim() || env.ZHIPU_API_KEY;
    if (!key) {
      return json({ error: { message: '中转没有配置 ZHIPU_API_KEY，请在 Worker 里 wrangler secret put ZHIPU_API_KEY' } }, 500, cors);
    }

    const temperature = Math.min(1, Math.max(0.1, Number(body.temperature) || 0.7));

    const payload = {
      model,
      messages: clean,
      temperature,
      stream: true,
    };

    let upstream;
    try {
      upstream = await fetch(UPSTREAM, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      return json({ error: { message: '连不上智谱：' + String(e && e.message || e) } }, 502, cors);
    }

    if (!upstream.ok) {
      let detail = '';
      try { detail = await upstream.text(); } catch (e) {}
      let msg = detail;
      try {
        const j = JSON.parse(detail);
        msg = (j.error && (j.error.message || j.error.code)) || j.message || detail;
      } catch (e) {}
      return new Response(JSON.stringify({ error: { message: msg || ('上游 HTTP ' + upstream.status) } }), {
        status: upstream.status,
        headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors),
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: Object.assign({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      }, cors),
    });
  },
};

// BiliTA relay mini
const U = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const F = ['glm-4.7-flash', 'glm-4-flash', 'glm-4.5-flash', 'glm-4-flash-250414', 'glm-4v-flash', 'glm-4.6v-flash'];
const C = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Toy-Token'};
const J = (d, s) => new Response(JSON.stringify(d), {status: s || 200, headers: Object.assign({'Content-Type': 'application/json'}, C)});
export default {async fetch(r, e) {
  const p = new URL(r.url).pathname;
  if (r.method === 'OPTIONS') return new Response(null, {status: 204, headers: C});
  const k = e.ZHIPU_API_KEY;
  if (p !== '/v1/chat') return J({ok: true, service: 'bilita', hasKey: !!k, freeModels: F});
  if (!k) return J({error: {message: 'no key'}}, 500);
  let b; try { b = await r.json(); } catch (x) { return J({error: {message: 'bad json'}}, 400); }
  if (!F.includes(b.model)) b.model = 'glm-4.7-flash';
  b.stream = true;
  let u;
  try { u = await fetch(U, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + k}, body: JSON.stringify(b)}); } catch (x) { return J({error: {message: 'upstream: ' + x.message}}, 502); }
  if (!u.ok) { let t = await u.text(); try { const o = JSON.parse(t); t = (o.error && (o.error.message || o.error.code)) || o.message || t; } catch (x) {} return J({error: {message: t}}, u.status); }
  return new Response(u.body, {status: 200, headers: Object.assign({'Content-Type': 'text/event-stream'}, C)});
}};

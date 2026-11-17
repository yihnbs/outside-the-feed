// OUTSIDE / THE FEED — data/raw_pool.json → docs/videos.js
// 영상마다 분류기(collect/classifier.js — 웹과 같은 코드)로 분야·세부 분야를 붙이고,
// 분야·세부 분야별로 균형을 맞춰 페이지가 읽는 videos.js 를 만든다.
// 같은 분류 체계에서 다음 날 검색어 목록(collect/queries.json)도 만든다.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const C = new Function(fs.readFileSync(path.join(__dirname, 'classifier.js'), 'utf8') +
  ';return {TAXONOMY,TOPIC_IDS,UNKNOWN,classifyText};')();

// ---------- 검색어 목록 (분류 체계 → 회전 검색) ----------
function buildQueries() {
  const out = [], durations = ['', 'medium', 'short', 'long'];
  let n = 0;
  for (const t of C.TAXONOMY) for (const [sub, list] of Object.entries(t.subs)) {
    const clean = list.filter(k => !k.endsWith('?')).map(k => k.trim());
    const ko = clean.filter(k => /[가-힣]/.test(k) && k.length >= 2).slice(0, 4);
    const en = clean.filter(k => /^[a-z0-9 &'.-]+$/i.test(k) && k.length >= 4).slice(0, 1);
    for (const q of ko) out.push({ q, topic: t.id, sub, lang: 'ko', duration: durations[n++ % 4] });
    for (const q of en) out.push({ q, topic: t.id, sub, lang: 'global', duration: '' });
  }
  // 분야가 섞이도록 고르게 섞기 (고정 시드)
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ---------- 형식 ----------
const FORMAT_RULES = [
  ['documentary', /다큐|documentary|다큐멘터리|추적|탐사/i],
  ['interview', /인터뷰|interview|대담|만나다|만나봤|q&a/i],
  ['podcast', /팟캐스트|podcast|토크|talk|라디오|radio|수다|ep\.?\s*\d+|에피소드/i],
  ['vlog', /브이로그|vlog|일상|하루|여행기|day in/i],
  ['explainer', /강의|해설|설명|정리|원리|explained|lecture|why |how |이유|총정리|알아보/i],
];
function formatOf(v) {
  if (v.shorts) return 'shorts';
  const text = (v.title || '') + ' ' + (v.desc || '').slice(0, 120);
  for (const [f, rx] of FORMAT_RULES) if (rx.test(text)) return f;
  return 'video';
}

// ---------- 분야 (영상 단위) ----------
const CATEGORY_PRIOR = { '10': 'music', '17': 'sports', '20': 'gaming', '25': 'news', '19': 'travel', '28': 'science', '2': 'science',
  '24': 'entertainment', '23': 'entertainment', '1': 'entertainment', '27': 'history', '15': 'health', '26': 'health' };
function topicOf(v) {
  const text = (v.title || '') + ' ' + (v.tags || []).join(' ');
  // 채널 RSS 영상은 채널 분야가 이미 있으니 채널명 키워드는 빼고 제목·태그만 본다
  const c = C.classifyText(text, v.src === 'rss' ? '' : (v.channel || ''));
  const prior = v.prior_topic || CATEGORY_PRIOR[v.category] || C.UNKNOWN;
  if (c.method === 'none') return { tp: prior, sb: v.prior_sub || '', how: v.prior_topic ? (v.src === 'search' ? 'query' : 'channel') : 'category' };
  if (c.topic === prior) return { tp: prior, sb: c.sub || v.prior_sub || '', how: 'video' };
  // 채널/검색어 분야와 다를 때: 신호가 약하거나(점수<2) 기존 분야에도 근거가 있으면 기존 분야 유지
  if (prior !== C.UNKNOWN && (c.score < 2 || (c.scores[prior] || 0) > 0)) return { tp: prior, sb: v.prior_sub || '', how: 'prior_kept' };
  return { tp: c.topic, sb: c.sub || '', how: 'video_override' };
}

// ---------- main ----------
function main() {
  fs.writeFileSync(path.join(__dirname, 'queries.json'), JSON.stringify(buildQueries(), null, 0));
  const rawPath = path.join(ROOT, 'data', 'raw_pool.json');
  if (!fs.existsSync(rawPath)) { console.log('raw_pool.json 없음 — queries.json만 생성'); return; }
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const now = Date.now(), age = d => Math.max(0, (now - Date.parse(d || '2000-01-01')) / 864e5);
  const rows = raw.videos.map(v => ({ v, ...topicOf(v), f: formatOf(v) })).filter(r => r.tp !== C.UNKNOWN);

  // 분야당 최대 PER_TOPIC개, 세부 분야별 균형 (최근·조회수 우선)
  const PER_TOPIC = +(process.env.PER_TOPIC || 650), picked = [];
  for (const t of C.TOPIC_IDS) {
    const inT = rows.filter(r => r.tp === t).sort((a, b) =>
      (Math.log10(1 + (b.v.views || 0)) * .4 - age(b.v.published) / 20) - (Math.log10(1 + (a.v.views || 0)) * .4 - age(a.v.published) / 20));
    const subs = [...new Set(inT.map(r => r.sb || '기타'))], cap = Math.ceil(PER_TOPIC / Math.max(1, subs.length) * 1.6), perSub = {};
    let nT = 0;
    for (const pass of [0, 1]) for (const r of inT) {
      if (nT >= PER_TOPIC) break;
      if (r._in) continue; const s = r.sb || '기타';
      if (!pass && (perSub[s] || 0) >= cap) continue;
      perSub[s] = (perSub[s] || 0) + 1; r._in = true; picked.push(r); nT++;
    }
  }

  const chIndex = new Map(), channels = [];
  const videos = picked.map(r => {
    const key = r.v.channel_id || r.v.channel;
    if (!chIndex.has(key)) { chIndex.set(key, channels.length); channels.push({ channel_id: r.v.channel_id || '', title: r.v.channel || '', topic: r.tp, sub: r.sb, lang: r.v.lang || 'ko' }); }
    return { id: r.v.id, t: r.v.title, c: chIndex.get(key), d: r.v.published || r.v.first_seen, v: r.v.views || 0, f: r.f, tp: r.tp, sb: r.sb, lg: r.v.lang || 'ko', s: r.v.src };
  });
  const pool = { generated_at: raw.generated_at, source: 'youtube_rss+data_api', channels, videos };
  fs.writeFileSync(path.join(ROOT, 'docs', 'videos.js'), 'window.OTF_VIDEO_POOL=' + JSON.stringify(pool) + ';\n');

  const count = (arr, k) => arr.reduce((o, x) => (o[x[k]] = (o[x[k]] || 0) + 1, o), {});
  console.log(`videos.js: 영상 ${videos.length}개 · 채널 ${channels.length}개 · ${(fs.statSync(path.join(ROOT, 'docs', 'videos.js')).size / 1024).toFixed(0)}KB`);
  console.log('분야:', JSON.stringify(count(videos, 'tp')));
  console.log('출처:', JSON.stringify(count(videos, 's')), '· 언어:', JSON.stringify(count(videos, 'lg')));
  console.log('분야 판정 방식:', JSON.stringify(count(rows, 'how')));
}
main();

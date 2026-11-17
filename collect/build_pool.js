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
  // 세부 분야마다 구체적인 검색어(query_seeds.json). 없으면 3글자 이상 키워드로 대체
  const seeds = JSON.parse(fs.readFileSync(path.join(__dirname, 'query_seeds.json'), 'utf8'));
  const out = [], durations = ['', 'medium', 'short', 'long'];
  let n = 0;
  for (const t of C.TAXONOMY) for (const [sub, list] of Object.entries(t.subs)) {
    const fallback = list.filter(k => !k.endsWith('?') && /[가-힣]/.test(k) && k.length >= 3).slice(0, 3);
    const qs = seeds[t.id + '|' + sub] || fallback;
    for (const q of qs) {
      const latin = /^[\x00-\x7F]+$/.test(q);
      out.push({ q, topic: t.id, sub, lang: latin ? 'global' : 'ko', duration: latin ? '' : durations[n++ % 4] });
    }
  }
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
const hashtags = d => ((d || '').match(/#[^\s#]+/g) || []).slice(0, 10).join(' ');
function topicOf(v) {
  const text = (v.title || '') + ' ' + (v.tags || []).join(' ') + ' ' + hashtags(v.desc);
  // 채널 RSS 영상은 채널 분야가 이미 있으니 채널명 키워드는 빼고 제목·태그·해시태그만 본다
  const c = C.classifyText(text, v.src === 'rss' ? '' : (v.channel || ''));
  const prior = v.prior_topic || CATEGORY_PRIOR[v.category] || C.UNKNOWN;
  const priorEvidence = (c.scores[prior] || 0) >= 1;   // 약한 키워드(0.5) 하나로는 근거로 안 침
  if (v.src === 'search') {
    // 검색 영상은 '검색한 분야와 내용이 맞는지' 확인: 근거가 없으면 버린다
    if (c.score >= 1 && c.topic === prior) return { tp: prior, sb: c.sub || v.prior_sub || '', how: 'video' };
    if (c.method !== 'none' && c.score >= 2 && !priorEvidence) return { tp: c.topic, sb: c.sub || '', how: 'video_override' };
    if (priorEvidence) return { tp: prior, sb: v.prior_sub || '', how: 'prior_kept' };
    if (CATEGORY_PRIOR[v.category] === prior && (c.method === 'none' || c.topic === prior)) return { tp: prior, sb: v.prior_sub || '', how: 'query+category' };
    return { tp: C.UNKNOWN, how: 'search_mismatch' };
  }
  if (c.method === 'none') return { tp: prior, sb: v.prior_sub || '', how: v.prior_topic ? 'channel' : 'category' };
  if (c.topic === prior) return { tp: prior, sb: c.sub || v.prior_sub || '', how: 'video' };
  // 채널 분야와 다를 때: 신호가 약하거나(점수<2) 채널 분야에도 근거가 있으면 채널 분야 유지
  if (prior !== C.UNKNOWN && (c.score < 2 || priorEvidence)) return { tp: prior, sb: v.prior_sub || '', how: 'prior_kept' };
  return { tp: c.topic, sb: c.sub || '', how: 'video_override' };
}

// ---------- main ----------
function main() {
  fs.writeFileSync(path.join(__dirname, 'queries.json'), JSON.stringify(buildQueries(), null, 0));
  const rawPath = path.join(ROOT, 'data', 'raw_pool.json');
  if (!fs.existsSync(rawPath)) { console.log('raw_pool.json 없음 — queries.json만 생성'); return; }
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const now = Date.now(), age = d => Math.max(0, (now - Date.parse(d || '2000-01-01')) / 864e5);
  const unesc = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // 검색으로 들어온 영상 품질 필터: 조회수 3,000 미만 제외, 해외는 영어 영상만
  const MIN_VIEWS = +(process.env.MIN_VIEWS || 3000);
  const okSearch = v => {
    if (v.src !== 'search') return true;
    if ((v.views || 0) < MIN_VIEWS) return false;
    if (v.lang === 'global') {
      const al = (v.audio_lang || '').toLowerCase();
      if (al) return al.startsWith('en');
      const t = (v.title || '').replace(/[#@][^\s]+/g, '');
      return /^[\x00-\x7F\u2000-\u2BFF\uFE00-\uFFFF\u{1F000}-\u{1FAFF}]*$/u.test(t);   // 라틴 문자·기호·이모지만
    }
    return true;
  };
  raw.videos.forEach(v => { v.title = unesc(v.title); v.channel = unesc(v.channel); });
  // 채널 구독자 수: 알면 5천 미만 채널의 검색 영상 제외 (뉴스·정치는 5만 미만 제외)
  let stats = {}; try { stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'channel_stats.json'), 'utf8')); } catch (e) {}
  const listed = new Set(fs.readFileSync(path.join(__dirname, 'channels.csv'), 'utf8').split('\n').map(l => l.split(',')[4]).filter(Boolean));
  const CLICKBAIT = /ㄷㄷ|ㅋㅋ|충격|경악|발칵|난리|미친|미칠|소름|폭로|참교육|사이다|박살|역대급|초비상|대참사|긴급|속보\s*[!]|[!?]{2,}|…\s*$|\.\.\.?\s*$|이유\?$|결국\s/;
  // 영어: 5글자 이상 전부 대문자 단어(FLEES, SHOCKING 등), 자극어
  const CLICKBAIT_EN = /\b(shocking|insane|destroyed|exposed|meltdown|wild|humiliat\w*|panic\w*|flees?)\b|!\s*$/i;
  const CAPS_WORD = /\b[A-Z]{5,}\b/;
  const qualityOk = r => {
    if (r.v.src !== 'search') return true;
    const subs = (stats[r.v.channel_id] || {}).subs, isNews = r.tp === 'news';
    if (listed.has(r.v.channel_id)) return true;
    if (isNews) {
      const t = r.v.title || '';
      if (CLICKBAIT.test(t) || (r.v.lang === 'global' && (CAPS_WORD.test(t) || CLICKBAIT_EN.test(t)))) return false;
      if (subs != null) return subs >= 50000;
      return (r.v.views || 0) >= 20000;                 // 구독자 수를 아직 모르면 조회수로 대신
    }
    return subs == null || subs >= 5000;
  };
  const scored = raw.videos.filter(okSearch).map(v => ({ v, ...topicOf(v), f: formatOf(v) }));
  const rows = scored.filter(r => r.tp !== C.UNKNOWN && qualityOk(r));
  console.log('검색 영상 제외 — 분야 불일치:', scored.filter(r => r.how === 'search_mismatch').length, '· 품질 기준 미달:', scored.filter(r => r.tp !== C.UNKNOWN && !qualityOk(r)).length);

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

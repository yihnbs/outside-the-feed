"""OUTSIDE / THE FEED — 영상 풀 수집기 (영상 단위)

1) 채널 RSS: channels.csv 채널들의 최신 영상 (무료, 할당량 없음)
2) YouTube Data API 검색: 분류 체계의 세부 분야 키워드를 날마다 돌려가며 검색 (하루 최대 SEARCH_LIMIT회)
3) YouTube Data API videos.list: 길이·언어·카테고리·태그·조회수 (50개당 1단위)
결과는 data/raw_pool.json 에 누적(최근 KEEP_DAYS일)되고, build_pool.js 가 영상마다 분야를 붙여 docs/videos.js 를 만든다.

  YOUTUBE_API_KEY=... python3 collect/collect_videos.py     # 키가 없으면 RSS만 수집
"""
import csv, json, os, re, sys, time, urllib.parse, urllib.request, urllib.error
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHANNELS = os.path.join(ROOT, 'collect', 'channels.csv')
QUERIES = os.path.join(ROOT, 'collect', 'queries.json')       # build_pool.js 가 분류 체계에서 생성
RAW = os.path.join(ROOT, 'data', 'raw_pool.json')
KEY = os.environ.get('YOUTUBE_API_KEY', '').strip()
SEARCH_LIMIT = int(os.environ.get('SEARCH_LIMIT', '90'))      # 기본 할당량 100회/일 중 여유 10회
KEEP_DAYS = int(os.environ.get('KEEP_DAYS', '60'))
SEARCH_WINDOW_DAYS = 21
NS = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015', 'media': 'http://search.yahoo.com/mrss/'}
UA = {'User-Agent': 'Mozilla/5.0 (OUTSIDE-THE-FEED collector)'}
NOW = datetime.now(timezone.utc)

def http(url, tries=2):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code in (400, 403, 404):
                return e.code, body
        except Exception:
            pass
        time.sleep(1.5 * (i + 1))
    return 0, b''

# ---------- 1. channel RSS ----------
def rss(channel):
    tail, out = channel['channel_id'][2:], []
    for kind, prefix in (('long', 'UULF'), ('shorts', 'UUSH')):
        st, body = http(f'https://www.youtube.com/feeds/videos.xml?playlist_id={prefix}{tail}')
        if st != 200:
            continue
        try:
            root = ET.fromstring(body)
        except ET.ParseError:
            continue
        for e in root.findall('a:entry', NS):
            vid = e.findtext('yt:videoId', '', NS)
            stt = e.find('media:group/media:community/media:statistics', NS)
            if vid:
                out.append({'id': vid, 'title': e.findtext('a:title', '', NS), 'desc': (e.findtext('media:group/media:description', '', NS) or '')[:400],
                            'channel': channel['channel_title'], 'channel_id': channel['channel_id'], 'published': (e.findtext('a:published', '', NS) or '')[:10],
                            'views': int(stt.get('views', 0)) if stt is not None else 0, 'shorts': kind == 'shorts',
                            'src': 'rss', 'prior_topic': channel['topic'], 'prior_sub': channel['sub'], 'lang': (channel.get('lang') or 'ko').strip()})
    time.sleep(0.2)
    return out

# ---------- 2. API search (rotating queries) ----------
def api(path, **params):
    params['key'] = KEY
    st, body = http('https://www.googleapis.com/youtube/v3/' + path + '?' + urllib.parse.urlencode(params))
    try:
        data = json.loads(body or b'{}')
    except Exception:
        data = {}
    if st != 200:
        reason = (data.get('error', {}).get('errors') or [{}])[0].get('reason', str(st))
        return None, reason
    return data, None

def todays_queries():
    try:
        qs = json.load(open(QUERIES, encoding='utf-8'))
    except FileNotFoundError:
        return []
    day = (NOW.date() - datetime(2026, 1, 1).date()).days
    # 하루에 SEARCH_LIMIT개: 전체 검색어 목록을 날짜에 따라 회전
    start = (day * SEARCH_LIMIT) % max(1, len(qs))
    return [qs[(start + i) % len(qs)] for i in range(min(SEARCH_LIMIT, len(qs)))]

def search_all():
    found, used, stop = {}, 0, None
    after = (NOW - timedelta(days=SEARCH_WINDOW_DAYS)).strftime('%Y-%m-%dT%H:%M:%SZ')
    for i, q in enumerate(todays_queries()):
        params = dict(part='snippet', type='video', maxResults=50, q=q['q'], publishedAfter=after, safeSearch='moderate',
                      order=('date' if i % 3 == 2 else 'relevance'))                    # 인기 편향 완화: 1/3은 최신순
        if q.get('lang') == 'global':
            params.update(relevanceLanguage='en')
        else:
            params.update(regionCode='KR', relevanceLanguage='ko')
        if q.get('duration'):
            params['videoDuration'] = q['duration']
        data, err = api('search', **params)
        used += 1
        if err:
            stop = err
            if err in ('quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'keyInvalid', 'accessNotConfigured', 'forbidden'):
                break
            continue
        for it in data.get('items', []):
            vid = it.get('id', {}).get('videoId')
            sn = it.get('snippet', {})
            if not vid or sn.get('liveBroadcastContent') in ('live', 'upcoming'):
                continue
            found.setdefault(vid, {'id': vid, 'title': sn.get('title', ''), 'channel': sn.get('channelTitle', ''), 'channel_id': sn.get('channelId', ''),
                                   'published': sn.get('publishedAt', '')[:10], 'src': 'search', 'prior_topic': q['topic'], 'prior_sub': q['sub'],
                                   'lang': q.get('lang', 'ko'), 'query': q['q']})
    return found, used, stop

# ---------- 3. details (50 per call, 1 unit) ----------
def iso_seconds(d):
    m = re.match(r'P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', d or '')
    if not m:
        return 0
    dd, h, mi, s = (int(x or 0) for x in m.groups())
    return dd * 86400 + h * 3600 + mi * 60 + s

def enrich(videos):
    ids, calls = list(videos), 0
    for i in range(0, len(ids), 50):
        data, err = api('videos', part='snippet,contentDetails,statistics', id=','.join(ids[i:i + 50]), maxResults=50)
        calls += 1
        if err:
            print('videos.list 오류:', err)
            break
        for it in data.get('items', []):
            v = videos.get(it['id'])
            sn, cd, stt = it.get('snippet', {}), it.get('contentDetails', {}), it.get('statistics', {})
            secs = iso_seconds(cd.get('duration'))
            text = (sn.get('title', '') + ' ' + sn.get('description', '')[:300]).lower()
            v.update(desc=sn.get('description', '')[:400], tags=(sn.get('tags') or [])[:12], category=sn.get('categoryId', ''),
                     duration=secs, views=int(stt.get('viewCount', 0) or 0),
                     shorts=bool(secs and (secs <= 60 or (secs <= 180 and '#shorts' in text))))
            lang = (sn.get('defaultAudioLanguage') or sn.get('defaultLanguage') or '').lower()
            if lang.startswith('ko') or re.search('[가-힣]', sn.get('title', '')):
                v['lang'] = 'ko'
            elif lang:
                v['lang'] = 'global'
    return calls

def main():
    chans = [r for r in csv.DictReader(open(CHANNELS, encoding='utf-8-sig')) if (r.get('enabled') or '1').strip() != '0']
    with ThreadPoolExecutor(8) as ex:
        rss_items = [v for chunk in ex.map(rss, chans) for v in chunk]
    print(f'RSS: 채널 {len(chans)}개 → 영상 {len(rss_items)}개')

    searched, used, stop = ({}, 0, 'no_key') if not KEY else search_all()
    calls = enrich(searched) if searched else 0
    print(f'API 검색: {used}회 → 새 영상 {len(searched)}개, 상세정보 {calls}회' + (f' (중단 사유: {stop})' if stop else ''))

    # 누적 저장소 병합 (RSS 정보가 최신이면 덮어씀), 최근 KEEP_DAYS일만 유지
    try:
        store = {v['id']: v for v in json.load(open(RAW, encoding='utf-8'))['videos']}
    except (FileNotFoundError, KeyError, json.JSONDecodeError):
        store = {}
    today = NOW.strftime('%Y-%m-%d')
    for v in list(searched.values()) + rss_items:
        old = store.get(v['id'], {})
        merged = {**old, **{k: val for k, val in v.items() if val not in (None, '', [])}}
        merged.setdefault('first_seen', today)
        store[v['id']] = merged
    cutoff = (NOW - timedelta(days=KEEP_DAYS)).strftime('%Y-%m-%d')
    keep = [v for v in store.values() if (v.get('published') or v.get('first_seen', today)) >= cutoff]
    os.makedirs(os.path.dirname(RAW), exist_ok=True)
    json.dump({'generated_at': NOW.strftime('%Y-%m-%dT%H:%MZ'), 'search_calls': used, 'search_stop': stop, 'videos': keep},
              open(RAW, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'누적 풀: {len(keep)}개 (최근 {KEEP_DAYS}일)')
    if stop and stop not in ('no_key',) and used <= 1:
        sys.exit(f'API 키 확인 필요: {stop}')

if __name__ == '__main__':
    main()

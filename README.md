# OUTSIDE / THE FEED

유튜브 시청 기록을 분석하고(MY FEED), 내 피드 바깥의 영상을 찾아주는(DISCOVER) 웹앱.
시청 기록은 브라우저 안에서만 처리되고 어디에도 업로드되지 않습니다.

## 구조
| 경로 | 내용 |
|---|---|
| `docs/index.html` | 서비스 화면 (GitHub Pages로 배포) |
| `docs/videos.js` | DISCOVER 영상 풀 — 매일 자동 갱신 |
| `collect/channels.csv` | RSS로 최신 영상을 받을 채널 목록 (분야·세부 분야·언어) |
| `collect/collect_videos.py` | 채널 RSS + YouTube Data API 검색·상세정보 수집 → `data/raw_pool.json` (최근 60일 누적) |
| `collect/build_pool.js` | 영상마다 분야를 붙이고 균형을 맞춰 `docs/videos.js` 생성, 검색어 목록 생성 |
| `collect/classifier.js` | 분류기 (웹 화면과 같은 규칙) |
| `.github/workflows/collect.yml` | 매일 06:07 KST 수집 → 커밋 → Pages 배포 |

## 할당량
- 검색: 하루 90회 (기본 100회 중 여유 10회), 회당 최대 50개
- 상세정보: 50개당 1단위
- API 키는 저장소 Secrets(`YOUTUBE_API_KEY`)에만 저장

## 로컬 실행
```
node collect/build_pool.js
YOUTUBE_API_KEY=... python3 collect/collect_videos.py   # 키 없으면 RSS만
node collect/build_pool.js
```

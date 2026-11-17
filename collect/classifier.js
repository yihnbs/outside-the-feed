// ===== TOPIC CLASSIFIER =====
// Level 1: fixed 12 topics shared by MY FEED and DISCOVER (so "LESS SEEN" means something).
// Level 2: sub-labels + channels + frequent words extracted from the uploaded history.
// Method: keyword scoring (longest keyword consumed first, English matched as whole words,
// channel name weighted x2) -> channel-level propagation for unclear records.
const TAXONOMY=[
{id:'music',label:'음악',yt:'Music',subs:{
'케이팝':['케이팝','kpop','k-pop','아이돌','뮤비','뮤직비디오','m/v','mv','컴백','엠카운트다운','엠카','인기가요','음악중심','뮤직뱅크','쇼챔피언','안무?','댄스','dance practice','choreography','직캠','fancam','bts','블랙핑크','blackpink','뉴진스','newjeans','세븐틴','seventeen','에스파','aespa','아이브','르세라핌','le sserafim','트와이스','스트레이키즈','stray kids','엔시티','nct','라이즈','riize','투어스','아일릿','illit','데이식스','day6','로제','rosé','코인노래방'],
'라이브·커버':['라이브?','live?','커버','cover','버스킹','콘서트','concert','어쿠스틱','acoustic','킬링보이스','killing voice','딩고 뮤직','it\'s live','리무진서비스','딩고뮤직','dingo music','온스테이지','세로라이브','colors show','tiny desk'],
'플레이리스트':['플리','플레이리스트','playlist','노동요','lofi','lo-fi','bgm'],
'음악 일반':['노래','음악','music','뮤직','가사','lyrics','official audio','official video','official music video','ost','앨범','album','피아노','piano','기타 연주','guitar','작곡','편곡','보컬','vocal','가수','singer','밴드','band?','힙합','hiphop','hip hop','rap','래퍼','쇼미더머니','재즈','jazz','클래식','classical','오케스트라','orchestra','vevo','트로트','발라드','ballad']}},
{id:'entertainment',label:'예능·엔터',yt:'Entertainment · Comedy · Film',subs:{
'예능':['예능','런닝맨','무한도전','나혼자산다','나 혼자 산다','놀면 뭐하니','1박2일','신서유기','지구오락실','유퀴즈','라디오스타','아는형님','전참시','미우새','짠한형','핑계고','뜬뜬','채널십오야','십오야','워크맨','문명특급','피식대학','숏박스','코미디','comedy','개그','콩트','sketch','몰카','prank','챌린지','challenge','밈','meme','웃긴','funny'],
'연예인':['연예','연예인','배우','셀럽','celeb','시상식','레드카펫','화보','비하인드','behind','팬미팅'],
'영화·드라마':['영화','movie','film','예고편','trailer','결말','줄거리','넷플릭스','netflix','디즈니플러스','티빙','tving','쿠팡플레이','드라마','drama','시트콤','애니메이션','애니','anime','웹툰','애니박스','anibox','치이카와','먼작귀','하치와레','짱구','포켓몬스터'],
'스트리머':['유튜버','스트리머','침착맨','리액션?','reaction?']}},
{id:'news',label:'뉴스·정치',yt:'News & Politics',subs:{
'뉴스 보도':['뉴스플레이리스트','뉴스 플레이리스트','news playlist','뉴스','news','조선일보','속보','breaking','단독?','앵커','jtbc news','jtbc뉴스','ytn','연합뉴스','mbn뉴스','뉴스룸','뉴스데스크','기자','보도','cnn','bbc','reuters'],
'정치':['정치','politics','국회','대통령','president','대선','총선','선거','election','여당','야당','민주당','국민의힘','장관?','탄핵','청문회','정부','정책','외교','white house'],
'국제':['국제','전쟁?','war?','우크라이나','ukraine','러시아','russia','이스라엘','israel','가자지구','gaza','북한','north korea','중동'],
'사회':['사회?','사건','사고?','재판','판결','검찰','경찰','시사?','pd수첩','그것이 알고싶다','그알','추적60분','시사기획']}},
{id:'economy',label:'경제·재테크',yt:'News & Politics · Education',subs:{
'투자':['주식','투자','증시','코스피','코스닥','나스닥','nasdaq','s&p','etf','배당','매수','매도','코인','비트코인','bitcoin','crypto','이더리움','stock','stocks','investing','trading'],
'거시경제·시장':['경제','economy','economics','금리','환율','인플레이션','inflation','물가','연준','fed','한국은행','gdp','경기침체','recession','관세','tariff','슈카','삼프로','머니인사이드','월급쟁이부자들'],
'재테크':['재테크','저축','적금','예금','연금','절세','세금','월급','부자?','짠테크','사회초년생','통장','통장관리','통장 쪼개기','신용카드','대출','personal finance'],
'부동산':['부동산','아파트','청약','전세','월세','집값','분양','재개발','재건축','real estate'],
'취업·커리어':['취업','이직','면접','이력서','자소서','직장인','회사생활','커리어','career','창업','스타트업','startup','사업','마케팅','marketing','브랜딩','branding','ceo','매출','business','비즈니스']}},
{id:'science',label:'과학·기술',yt:'Science & Technology · Autos',subs:{
'AI':['ai','인공지능','llm','chatgpt','gpt','gemini','claude','openai','머신러닝','machine learning','딥러닝','deep learning','생성형','프롬프트','prompt','클로드','제미나이','챗gpt','챗지피티','코파일럿','copilot','로컬 llm'],
'개발·코딩':['코딩','개발자','개발','프로그래밍','programming','coding','파이썬','python','javascript','자바스크립트','sql','github','깃허브','데이터분석','데이터 분석','data science','데이터사이언스','알고리즘','algorithm','developer','software','노마드코더','코딩애플','생활코딩'],
'IT 기기':['아이폰','iphone','갤럭시','맥북','macbook','맥미니','mac mini','아이패드','ipad','애플','apple','삼성전자','노트북','laptop','언박싱','unboxing','스마트폰','smartphone','키보드','keyboard','모니터','테크','tech?','gadget','잇섭','itsub','mkbhd'],
'과학·우주':['과학','science','물리학','physics','화학','chemistry','생물','biology','우주','nasa','블랙홀','black hole','양자','quantum','천문','행성','로켓','rocket','spacex','진화론','유전자','dna','안될과학','과학쿠키','kurzgesagt','veritasium','vsauce','3blue1brown','수학','math','mathematics'],
'생산성':['생산성','productivity','노션','notion','슬랙','slack','엑셀','excel','업무자동화','자동화','automation','협업툴','옵시디언','obsidian','구글시트'],
'자동차':['자동차','전기차','테슬라','tesla','현대차','시승','supercar','cars?']}},
{id:'food',label:'음식·요리',yt:'Howto & Style · People & Blogs',subs:{
'요리·레시피':['요리','레시피','recipe','cooking','백종원','만개의레시피','집밥','반찬','자취요리','에어프라이어','베이킹','baking','디저트','dessert','케이크','베이커리','빵집'],
'먹방':['먹방','mukbang','쯔양','히밥','eating show','술먹방'],
'맛집':['맛집','restaurant','오마카세','omakase','노포','식당','골목식당','카페투어','카페 투어','미슐랭','michelin','먹을텐데','또간집','food tour','street food','길거리 음식'],
'음식·음료':['음식','food','신라면','컵라면','라면 먹방','ramen','도시락','치킨','chicken','삼겹살','스테이크','steak','초밥','sushi','커피','coffee','와인','wine','위스키','whisky','whiskey','소주','막걸리','맥주','beer','편의점']}},
{id:'travel',label:'여행·장소',yt:'Travel & Events',subs:{
'여행':['여행','travel','trip?','배낭여행','수학여행','해외여행','국내여행','비행기','flight','호텔','hotel?','숙소','리조트','resort','공항','airport','캠핑','camping','차박','빠니보틀','곽튜브'],
'도시·장소':['도쿄','tokyo','오사카','osaka','후쿠오카','교토','kyoto','paris','런던','london','뉴욕','new york','방콕','bangkok','다낭','발리','bali','유럽','europe','제주도','제주','강릉','경주','산책','골목','walking tour','4k walk']}},
{id:'arts',label:'예술·문화',yt:'Film & Animation · Education',subs:{
'책':['독서','책 추천','책추천','책리뷰','책 리뷰','북튜버','소설','novel','작가','시집','문학','literature','에세이','book review','books'],
'미술·디자인':['미술','art?','그림','drawing','painting','일러스트','illustration','전시','exhibition','미술관','museum','박물관','디자인?','design?','건축','architecture','사진','photography','작품'],
'공연':['뮤지컬','musical','연극','theater','theatre','오페라','opera','발레','ballet','현대무용']}},
{id:'sports',label:'스포츠',yt:'Sports',subs:{
'야구':['야구','kbo','mlb','라이온즈','lions','타이거즈','트윈스','베어스','자이언츠','랜더스','이글스','다이노스','히어로즈','kt wiz','한국시리즈','코시','홈런','home run','homerun','투수','타자','피칭','pitching','오타니','ohtani','이정후','김하성','최강야구','다저스','dodgers','yankees','양키스','불펜','구단주','이재희','ks4'],
'축구':['축구','soccer','football','손흥민','프리미어리그','premier league','epl','챔피언스리그','champions league','라리가','분데스리가','k리그','월드컵','world cup','토트넘','tottenham','맨유','맨시티','리버풀','liverpool','아스날','arsenal','바르셀로나','이강인','김민재'],
'농구':['농구','nba','kbl','basketball','르브론'],
'골프·라켓':['골프','golf','테니스','tennis','배드민턴','badminton','탁구','볼링'],
'격투기':['ufc','격투','복싱','boxing','mma','레슬링','wrestling','주짓수'],
'배구':['배구','volleyball','kovo','v리그','v-리그'],'당구':['당구','billiards','pba','3쿠션','포켓볼'],'모터스포츠':['f1','formula 1','포뮬러','motogp','레이싱','그랑프리'],'기타 스포츠':['스포츠','sports','sport','경기 하이라이트','올림픽','olympic','olympics','마라톤','marathon','수영','swimming','쇼트트랙','득점','선수?','spotv','스포티비','차전','결승전']}},
{id:'gaming',label:'게임',yt:'Gaming',subs:{
'롤·e스포츠':['롤드컵','리그오브레전드','리그 오브 레전드','league of legends','lck','t1','페이커','faker','e스포츠','esports','이스포츠','솔랭','풍월량','우왁굳',' 롤 '],
'게임 일반':['게임','game','games','gaming','gameplay','공략','walkthrough','마인크래프트','minecraft','배그','배틀그라운드','pubg','발로란트','valorant','오버워치','overwatch','메이플스토리','메이플','로스트아크','fc온라인','fifa','포켓몬','pokemon','pokémon','닌텐도','nintendo','플스','ps5','playstation','xbox','젤다','zelda','엘든링','elden ring','스타크래프트','starcraft','인디게임','indie game','speedrun','스피드런','고전게임']}},
{id:'history',label:'역사·교양',yt:'Education',subs:{
'역사':['역사','history','한국사','세계사','조선','고려','삼국','왕조?','전쟁사','고대사','고대 문명','ancient','민주화운동','중세','medieval','로마','roman','이집트','egypt','고고학','archaeology','문명','civilization','일제강점기','근현대사','썬킴','벌거벗은 세계사','설민석','큰별쌤','최태성'],
'철학·심리':['철학','philosophy','심리학','psychology','인문학','humanities','니체','nietzsche','칸트','소크라테스','스토아','stoic'],
'사회·도시':['도시?','도시계획','urban','인구?','저출산','지방소멸','젠트리피케이션','사회학','sociology','인류학','anthropology'],
'강의·학습':['강의','lecture','강연','ted','tedx','세바시','교양?','지식?','공부법','영어공부','영어 공부','영어회화','영어 회화','learn english','토익','toeic','수능','일본어','중국어','language learning']}},
{id:'health',label:'건강·라이프',yt:'Howto & Style · Pets & Animals',subs:{
'운동':['운동','workout','헬스','gym','홈트','홈트레이닝','필라테스','pilates','요가','yoga','스트레칭','stretching','러닝','running','러닝머신','다이어트','diet','근력','스쿼트','squat','벌크업','바디프로필','피트니스','fitness','땅끄부부'],
'건강':['건강','health','수면','sleep','명상','meditation','멘탈?','mental health','스트레스','stress','힐링?','물리치료','의학','의사','병원','약사','영양제','supplement','자세 교정','통증','수면 asmr','sleep asmr'],
'패션·뷰티':['패션','fashion','코디','룩북','lookbook','ootd','하울','haul','메이크업','makeup','화장','뷰티','beauty','스킨케어','skincare','헤어스타일','헤어컷','hair','네일','향수','perfume','퍼스널컬러','옷','쇼핑'],
'살림·생활':['인테리어','interior','자취','살림','청소','cleaning','정리정돈','미니멀','minimalism','집꾸미기','룸투어','room tour','홈카페','가전','육아','parenting','아기','baby?'],
'반려동물':['강아지','dog','dogs','고양이','cat?','cats','반려견','반려묘','반려동물','pet?','pets','동물','animal','animals','댕댕이','냥이','동물농장','애니멀','애니멀봐']}}
];
// Compounds consumed before shorter keywords so they don't score (e.g. 책상, 화장실, 의사결정).
const STOP_PHRASES=['사회생활','사회성','사고방식','사고력','화장실','의사결정','의사소통','배우기','배우는','배우고','배워','헤어지','사상최대','사상 최대','사회자','경기도','정리','청소년','역사상','eng sub','english sub','kor sub'];
const TOPIC_IDS=TAXONOMY.map(t=>t.id),UNKNOWN='unknown';
const TOPIC_BY_ID=Object.fromEntries(TAXONOMY.map(t=>[t.id,t]));
const KEYWORDS=(()=>{const seen=new Map();for(const t of TAXONOMY)for(const[sub,list]of Object.entries(t.subs))for(const raw of list){const weak=raw.endsWith('?'),kw=(weak?raw.slice(0,-1):raw).toLowerCase();if(!seen.has(kw))seen.set(kw,{kw,topic:t.id,sub,w:weak?.5:1})}
for(const s of STOP_PHRASES){const kw=s.toLowerCase();if(!seen.has(kw))seen.set(kw,{kw,topic:null,sub:null,w:0})}
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
return[...seen.values()].sort((a,b)=>b.kw.length-a.kw.length).map(k=>{const latin=/^[a-z0-9 &'\/.\-é]+$/.test(k.kw.trim());return{...k,latin,re:latin?new RegExp('(^|[^a-z0-9])'+esc(k.kw.trim())+'(?=$|[^a-z0-9])','g'):null}})})();
function scoreText(text,weight,scores,subScores){
let s=' '+String(text||'').toLowerCase().normalize('NFC')+' ';
for(const k of KEYWORDS){let hits=0;
if(k.latin){if(s.indexOf(k.kw.trim())<0)continue;s=s.replace(k.re,(m,pre)=>{hits++;return pre+' '.repeat(m.length-pre.length)});}
else{let i;while((i=s.indexOf(k.kw))>=0){hits++;s=s.slice(0,i)+' '.repeat(k.kw.length)+s.slice(i+k.kw.length)}}
if(hits&&k.topic){const add=Math.min(hits,2)*weight*k.w;scores[k.topic]=(scores[k.topic]||0)+add;const key=k.topic+'|'+k.sub;subScores[key]=(subScores[key]||0)+add;}}
}
const classifyCache=new Map();
function classifyText(title,channel){
const key=title+'\u0001'+channel;if(classifyCache.has(key))return classifyCache.get(key);
const scores={},subScores={},titleScores={};scoreText(title,1,titleScores,{});scoreText(title,1,scores,subScores);scoreText(channel,2,scores,subScores);
const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);let out;
if(!ranked.length)out={topic:UNKNOWN,sub:'',method:'none',candidates:[],score:0,scores};
else{const best=ranked[0][1],tied=ranked.filter(r=>r[1]===best).map(r=>r[0]);
// 동점이면 제목 근거가 더 큰 쪽 → 그래도 같으면 분류 체계 순서
const topic=tied.length===1?tied[0]:tied.sort((a,b)=>(titleScores[b]||0)-(titleScores[a]||0)||TOPIC_IDS.indexOf(a)-TOPIC_IDS.indexOf(b))[0];
const sub=Object.entries(subScores).filter(([k])=>k.startsWith(topic+'|')).sort((a,b)=>b[1]-a[1])[0]?.[0].split('|')[1]||'';
out={topic,sub,method:tied.length>1?'tie':'keyword',candidates:tied,score:best,scores};}
classifyCache.set(key,out);return out;
}
// Channel propagation: a channel with >=2 clearly classified videos and a >=60% majority
// lends its topic to its unclassified / tied videos.
function classifyRecords(records){
const byChannel=new Map();
const rows=records.map(r=>{const c=classifyText(r.title,r.channel);return{...r,category:c.topic,subtopic:c.sub,topic_method:c.method,_cand:c.candidates}});
rows.forEach(r=>{if(!r.channel||r.topic_method!=='keyword')return;let m=byChannel.get(r.channel);if(!m){m={n:0,topics:{},subs:{}};byChannel.set(r.channel,m)}m.n++;m.topics[r.category]=(m.topics[r.category]||0)+1;const sk=r.category+'|'+r.subtopic;m.subs[sk]=(m.subs[sk]||0)+1;});
const channelTopic=new Map();byChannel.forEach((m,ch)=>{const[top,n]=Object.entries(m.topics).sort((a,b)=>b[1]-a[1])[0];if(m.n>=2&&n/m.n>=.6){const sub=Object.entries(m.subs).filter(([k])=>k.startsWith(top+'|')).sort((a,b)=>b[1]-a[1])[0][0].split('|')[1];channelTopic.set(ch,{topic:top,sub})}});
rows.forEach(r=>{const ct=channelTopic.get(r.channel);
if(r.topic_method==='none'&&ct){r.category=ct.topic;r.subtopic=ct.sub;r.topic_method='channel';}
else if(r.topic_method==='tie'){if(ct&&r._cand.includes(ct.topic)){r.category=ct.topic;r.subtopic=ct.sub;r.topic_method='channel';}else r.topic_method='keyword';}
delete r._cand;});
return rows;
}
// Level 2 profile from the upload itself: sub-labels, channels and frequent title words per topic.
const WORD_STOP=new Set(('the and for with from this that you your are was not all how what why when official video videos shorts short full ver version eng sub kor clip clips part feat ep vol live new best top vs '+
'영상 이번 진짜 그냥 오늘 우리 이거 근데 하는 하고 있는 없는 이런 저런 무슨 정말 너무 모든 다시 처음 마지막 공개 최초 단독 풀버전 하이라이트 모음 편집 리뷰 shorts 쇼츠 1부 2부 3부 이래 저래 오늘의 내가 나의 이제 지금 이렇게 vlog 브이로그').split(/\s+/));
function topicProfile(records,topic){
const rows=records.filter(r=>r.category===topic),subs={},channels={},words={};
rows.forEach(r=>{if(r.subtopic)subs[r.subtopic]=(subs[r.subtopic]||0)+1;if(r.channel)channels[r.channel]=(channels[r.channel]||0)+1;
const seen=new Set();String(r.title||'').toLowerCase().replace(/\[[^\]]*\]|\([^)]*\)/g,' ').split(/[^0-9a-z가-힣]+/).forEach(w=>{if(w.length<2||/^\d+$/.test(w)||WORD_STOP.has(w)||seen.has(w))return;seen.add(w);words[w]=(words[w]||0)+1;});});
const top=(o,n,min=1)=>Object.entries(o).filter(e=>e[1]>=min).sort((a,b)=>b[1]-a[1]).slice(0,n);
return{count:rows.length,subs:top(subs,4),channels:top(channels,4),words:top(words,8,2),methods:{keyword:rows.filter(r=>r.topic_method==='keyword').length,channel:rows.filter(r=>r.topic_method==='channel').length}};
}
function topicLabel(id){return id==='all'?'전체':id===UNKNOWN?'미분류':TOPIC_BY_ID[id]?.label||id;}
// ===== END TOPIC CLASSIFIER =====

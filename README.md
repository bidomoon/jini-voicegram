# 보이스그램

음성 또는 텍스트로 콘텐츠 제작을 준비하는 비공개 SNS 콘텐츠 스튜디오.

## 구현한 기능
- 한국어 Web Speech 입력(지원 브라우저), 키보드 입력 대체 경로.
- 명시적 음성 수정 명령: 글씨 크게/작게, 밝은/차분한/발랄한 분위기, 제목 변경, 공유 확인창 열기. 자유 대화형 에이전트는 아님.
- JPG/PNG/WebP 사진 첨부, 비율별 캔버스 문구 합성, PNG 출력.
- MediaRecorder 지원 브라우저에서 6초 무음 사진 영상 출력. MP4 지원을 우선하며 WebM은 SNS별 호환성 확인 필요.
- 기기별 localStorage 초안 저장/불러오기, PNG/영상 저장, Web Share API 및 수동 업로드 경로.
- AI 이미지 생성/편집 및 비동기 Sora 영상 생성 서버 어댑터. 계정 연결 전에는 명시적으로 차단.
- AI 비용 확인 화면, 서버 인증, 동일 출처 검사, 입력 형식/용량 검사, 사용자별 HMAC 영상 조회 토큰.
- WebMCP stage_content_request: 요청 입력/수정만 수행. 생성 비용/게시 부작용 없음.

## 연결 상태
AI API 키와 사용료 승인 없음. AI 생성 실동작 미검증.
Instagram/Meta OAuth 및 게시 API는 아직 구현·연결되지 않음. 공유창은 직접 게시가 아니며, 게시 완료를 표시하지 않음.
업로드 사진/초안은 기기에만 머무르며 AI 생성 승인 시에만 사진/요청을 OpenAI에 전송.
Web Speech 음성은 해당 브라우저의 인식 서비스에서 처리할 수 있음.
자동 생성·예약 게시·오토스테이션 연동 없음. 지니오토스테이션 기존 프로젝트는 수정하지 않음.

## 운영 전 연결 순서
1. 소유자가 OpenAI Developers 플러그인을 연결하고 API 사용 비용/한도를 승인.
2. 호스팅 비밀값 OPENAI_API_KEY와 명시적 AI_ENABLED=true 설정. 모델은 OPENAI_IMAGE_MODEL로 변경 가능.
3. 실제 생성 1건씩 이미지/사진 편집/영상 생성, 실패 및 잔액 한도, 모바일 다운로드 확인.
4. Meta 게시 연동은 별도 앱 등록, 계정 인증, 최소 권한, 토큰 보관, 미디어 저장소, 사용자 확인, idempotency, 성공 응답 확인이 필요.
5. 일반 사용자 공개 전 비용 제한과 영속 작업/결과 저장을 추가. 현재 소유자 비공개 테스트용.

## 검증
TypeScript 정적 검사 통과. 한국어 명령 6개 시나리오 통과.
허용된 브라우저 테스트 도구 미제공으로 실제 브라우저/360·390·430·768px 시각 검수 및 WebMCP 실행 검증은 미수행.
마이크 권한, 실제 음성인식, 모바일 MP4 생성/공유는 실제 기기 검증 필요.

## 개발
의존성 설치 및 배포는 Sites 스킬 워크플로를 사용. .env.example은 변수 이름만 포함. 비밀값을 클라이언트 또는 저장소에 넣지 말 것.

## Netlify 배포
- 대상 팀: jini-nova / 프로젝트: jini-voicegram
- 빌드: `npm run build:netlify` / 출력: `dist-netlify`
- 동일한 React 편집 화면을 Vite로 빌드하며 Sites 빌드는 유지.
- `/api/studio`는 Netlify Function으로 연결. 현재 생성 미연결 상태와 명확한 503 응답을 제공.
- Netlify에서는 ChatGPT 인증 헤더를 신뢰하지 않음. 별도 검증된 로그인/사용량 한도 구성 전 AI 생성을 열지 말 것.
- 기존 Sites 서버용 AI 어댑터는 `app/api/studio/route.ts`에 유지. Netlify 생성 어댑터 이식은 아직 미완료.
- GitHub 저장과 Netlify 자동 배포는 별도 연결이며, 수동 소스 업로드 배포가 자동 배포 연결을 의미하지 않음.

### 검증된 Netlify 게시 경로
Netlify 원격 의존성 설치는 실패하여, 로컬 빌드 결과를 게시하는 경로를 사용합니다.
`npm run build:netlify` → `node scripts/package-netlify.mjs` → `outputs/netlify-deploy`를 Netlify에 업로드.
패키지는 정적 앱과 의존성 없는 상태 확인 Function을 포함합니다. GitHub 자동 빌드 연결은 아직 설정되지 않았습니다.

## 제품 방향 · 2026-09-26 수정
매버릭의 지시: 업소 홍보에 국한하지 않고, 누구나 말로 이미지·영상·게시물을 만드는 개인 창작/공유 앱. “말로 하는 인스타”는 사용 경험의 방향이며 Instagram 공식 제품 또는 제휴를 뜻하지 않음.
- 일상, 여행/산책, 축하/마음, 반려동물, 취미/도전, 추억/친구의 예시를 제공.
- 중심 흐름: 말하기 → 결과 확인 → 말로 수정 → 공유. 타이핑은 계속 지원.
- 현재 AI 생성/직접 게시/자유 대화 해석은 미연결. “이대로 만들어줘”는 현재 편집 결과를 렌더링하며 유료 AI 모드에서는 확인창만 열림.
- WebMCP 준비 도구는 제작/저장/공유를 실행하지 않도록 제한.
- 현재 Netlify 배포를 우선 업데이트. 기존 Sites 주소는 앞선 버전으로 남아 있음.

## Conversational editing (Netlify)
The chat UI carries recent conversation and current edit state to `/api/chat`; it supports undo and text visibility. Photo pixels are not sent to chat. Without configuration it clearly labels deterministic basic edits and does not pretend freeform AI is active.

To enable a private pilot, securely set `OPENAI_API_KEY`, `CHAT_ENABLED=true`, and a random `VOICEGRAM_ACCESS_CODE` of at least 24 characters in this site's Netlify environment. Optional `OPENAI_CHAT_MODEL` defaults to `gpt-4.1-mini`. Never enter API keys into chat or commit them. The tester code creates an 8-hour secure HttpOnly session. Maintain the existing Netlify team protection. This pilot gate is not production user authentication or a durable spending limit. On 2026-09-26 an authorized real API call through the local server handler returned HTTP 200 and a contextual Korean edit. Production end-to-end UI verification remains pending behind team SSO. Image/video generation and direct external posting remain disconnected on Netlify.

Launch target and outstanding commercial requirements: [docs/launch-plan.md](docs/launch-plan.md).

# 보이스그램 미디어·인스타 연결 (2026-09-26)

## 구현 범위
- 인증한 사용자가 생성 비용을 확인한 뒤 OpenAI 이미지 생성/참조 사진 편집을 요청한다. 테스트 기본값은 gpt-image-1.5, low, 한 장. 모델명은 서버 환경변수로 변경한다.
- 영상은 Runway gen4.5, 세로 720:1280, 5초. 비동기 작업 ID를 서명하고 상태 조회/다운로드를 제공한다. 생성 오류/시간 초과 시 유료 요청을 자동 재시도하지 않는다.
- Sora Videos API는 공식 종료일이 2026-09-24로 안내되어 신규 Netlify 경로에서 사용하지 않는다. 기존 app/api/studio/route.ts는 과거 Sites 전용 경로이며 현재 Netlify 배포에는 포함되지 않는다.
- Instagram Login: 대상 @아이디 입력 → 공식 OAuth → 실제 로그인 아이디 일치 확인 → 암호화 HttpOnly 쿠키(최대 약 1시간). 토큰을 프런트엔드/저장소에 노출하지 않는다. 만료 시 재로그인한다. 장기 토큰 갱신/다중 회원 연동은 후속 작업.
- 게시 준비: 완성 파일을 JPG로 변환하거나 MP4 사용(현재 4MB 제한). 서버 미디어 임시 저장, 1시간 서명 URL, 매시간 만료 파일 정리. Meta가 로그인 없이 가져갈 수 있는지 HEAD 검사 후 컨테이너를 만든다.
- 게시 확인: Meta 처리 FINISHED → 대상 계정 최종 확인 → media_publish → 결과 링크. 게시 잠금을 영구 기록하여 요청 결과가 불확실할 때 자동 중복 게시하지 않는다.

## 실제 연결에 필요한 값
현재 OpenAI 키는 연결됨. 아래 값은 확인한 Netlify 환경에 없음:
- RUNWAYML_API_SECRET: Runway 개발자 API 키. ChatGPT에 연결한 Runway 플러그인 인증은 배포 앱의 API 키가 아니다. 별도 과금/크레딧 확인 필요.
- INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET: Instagram Login이 설정된 Meta 개발자 앱. 비밀번호가 아니다.
- OAuth redirect URI: https://jini-voicegram.netlify.app/api/instagram?action=callback (Meta에 정확히 등록)
- 앱 역할/테스터로 허용된 매버릭 본인 프로페셔널 계정. 다른 이용자에게 제공하려면 Meta 권한 검토/앱 심사 요구사항 확인.

## 해결하지 않은 운영 조건
- 현재 사이트의 Netlify 팀 로그인 보호는 유지한다. 이 보호 때문에 Meta의 파일 GET이 차단될 수 있다. 공개된 전용 미디어 호스트 또는 검토된 인증 정책 조정 전 직접 게시가 차단된다. 임의로 사이트 보호를 해제하지 않았다.
- 공용 테스트 코드는 상용 사용자 계정이 아니다. 정식 공개 전 회원 인증, 작업 소유권, 일별 생성 제한/비용 상한, 사용 기록, 결제, 신고/삭제 절차를 구현해야 한다.
- 브라우저 사진 영상 기능은 MP4를 지원하면 바로 게시 가능 형식이지만 WebM만 지원하는 기기는 변환이 필요하다. 영상 제작은 6초 무음 사진 모션이며 AI 장면 생성과 구분한다.
- 실제 인스타 게시 테스트는 계정 소유자 확인 및 OAuth 완료 후, 검토한 콘텐츠를 대상으로 한다. 이번 작업에서 외부 게시하지 않았다.

공식 문서:
https://developers.openai.com/api/docs/guides/image-generation
https://developers.openai.com/api/docs/guides/video-generation
https://docs.dev.runwayml.com/guides/using-the-api/
https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
https://developers.facebook.com/documentation/instagram-platform/content-publishing
https://docs.netlify.com/build/data-and-storage/netlify-blobs/

## 이번 검증 결과
- TypeScript 검사와 프로덕션 빌드 통과.
- 서버 테스트: 미인증 차단, 다른 Origin 차단, 생성 비용 확인 필수, 위조 영상 작업/미디어 링크 차단, Meta 설정 누락 안내 확인.
- 실제 이미지 생성 HTTP 200, JPG 132,706 bytes 수신. 테스트 이미지 외부 게시 없음.
- 자동 브라우저 도구가 시작하지 못해 모바일 화면/실기기 및 배포 사이트 전체 흐름 검증은 미완료.

# 카카오 로그인 · 토스페이 연결 준비 (2026-09-27)

## 구현과 실제 연결을 구분합니다

구현: 카카오 로그인 진입 화면, 서버 OAuth 시작/콜백, 브라우저에 묶인 일회용 state, 동일 카카오 계정의 안정적인 프로필 ID, 기기별 서버 세션, 로그아웃, 로그인 전 작성글 복원. 비밀키와 카카오 토큰은 브라우저로 전달하지 않습니다. 카카오 토큰은 사용자 정보 조회에만 사용하고 저장하지 않습니다. 이메일·전화번호·친구 목록을 요청하지 않습니다. 카카오 앱의 동의항목도 최소화해야 합니다.

현재 배포 설정: `KAKAO_LOGIN_ENABLED=false`, 카카오 REST API 키/클라이언트 시크릿 미등록. 따라서 화면은 연결 준비 중으로 표시되며 실제 로그인 완료를 주장하지 않습니다. 기존 테스트 프로필과 게시물은 그대로 유지하며, 카카오 프로필과 자동 병합하지 않습니다.

토스: v2 주문서형 결제 SDK 연결, 서버 테스트 주문 생성, 금액/주문 소유자 검증, 결제 승인 검증, 재시도 중복 방지와 불확실 결과 조회를 준비했습니다. 테스트 전용 키만 허용합니다. 테스트 상품은 연동 확인용 100원이며 판매 요금제가 아니고 실제 청구·이용권 부여를 하지 않습니다. `PAYMENTS_TEST_ENABLED=false`, 토스 키 미등록 상태로 배포합니다. 실제 결제·정기 구독은 구현/활성화하지 않았습니다.

## 카카오에 등록할 값

| 항목 | 값 |
|---|---|
| 서비스 웹 주소 | https://jini-voicegram.netlify.app |
| Redirect URI | https://jini-voicegram.netlify.app/api/auth/callback |
| 로그인 방식 | 카카오 REST OAuth · 계정 선택 |
| 최소 정보 | 앱별 카카오 회원 식별자, 허용된 경우 닉네임 |
| Netlify 서버 비밀값 | KAKAO_REST_API_KEY / KAKAO_CLIENT_SECRET |
| 서버 기준 주소 | APP_ORIGIN=https://jini-voicegram.netlify.app |

카카오 디벨로퍼스에서 보이스그램용 앱을 선택/등록하고 로그인 활성화, 웹 플랫폼/Redirect URI, 최소 동의항목을 설정합니다. 앱 키는 다른 상품의 앱 키를 임의로 재사용하지 않습니다. 키는 Netlify의 production/functions 범위에 secret으로 입력하고 검증할 때 `KAKAO_LOGIN_ENABLED=true`로 전환합니다. 키를 채팅이나 GitHub에 적지 않습니다.

현재 Netlify 팀 로그인(SSO) 보호가 모든 배포에 적용되어 있습니다. 일반 사용자가 카톡으로 받은 링크를 열려면, 카카오 실로그인·게시 권한·운영 정책을 검증한 뒤 이 보호 설정을 별도로 변경해야 합니다. 이번 작업은 보호를 해제하지 않습니다.

## 토스 테스트에 등록할 값

- 토스페이먼츠의 주문서형/결제창형 테스트 키: `TOSS_TEST_CLIENT_KEY` (`test_gck_...`), `TOSS_TEST_SECRET_KEY` (`test_gsk_...`). 구버전 결제창용 키와 혼용하지 않습니다.
- `TOSS_VARIANT_KEY`: 결제 UI 설정에 지정된 variant, 기본 `DEFAULT`. 약관 기본 `AGREEMENT`.
- 토스페이가 해당 상점의 결제수단에 표시되는지 확인합니다. 상점 설정에 따라 제공 수단이 다르며 코드만으로 계약/심사를 대신할 수 없습니다.
- `PAYMENTS_TEST_ENABLED=true`는 준비된 테스트 키와 함께만 작동합니다. live 키를 넣으면 준비되지 않음으로 처리됩니다.
- 성공 URL: `https://jini-voicegram.netlify.app/?payment=success`
- 실패 URL: `https://jini-voicegram.netlify.app/?payment=fail`
- URL의 성공 표시만 신뢰하지 않고 서버 승인 응답의 주문번호, 결제키, 금액, 통화, `DONE` 상태를 검증합니다.
- 승인 응답이 불확실하면 동일 결제키를 조회해 결과를 확인합니다. 다시 승인 요청하거나 새로운 결제를 자동 실행하지 않습니다.

## 정식 출시 전 남은 작업

카카오 실계정/카카오톡 인앱 브라우저/일반 브라우저 왕복, 동의 취소·만료, 다른 기기 로그인, 프로필 복원 검증. 카카오 연결 해제 웹훅, 회원 탈퇴/데이터 처리와 서비스 약관·개인정보처리방침 확정, 만료 세션 및 OAuth 레코드 정리, 인증 요청 남용 제한이 필요합니다. 현재 소셜 저장 구조는 소규모 테스트 용도입니다.

유료 판매는 가격·제공량·원가·한도·환불 기준을 확정한 뒤 별도로 구현합니다. 결제 승인 이후 이용권 원장, 사용량 차감, 해지·환불·웹훅 검증을 갖추기 전에는 live 결제를 열지 않습니다. 카카오 로그인만으로 유료 AI 접근을 자동 허용하지 않으며 기존 AI 테스트 접근/비용 확인이 유지됩니다.

웹 링크에서의 토스 결제 준비와 앱스토어 결제는 구분합니다. AI 생성 이용권 같은 디지털 기능은 Apple/Google 배포 정책을 검토하여 인앱결제 또는 허용된 대체결제 절차를 별도 구현해야 합니다. iOS의 소셜 로그인 요구사항(4.8)도 제출 시 검토합니다.

## 확인한 공식 문서

- 카카오 OAuth 및 state/토큰: https://developers.kakao.com/docs/ko/kakaologin/rest-api
- 카카오 로그인 디자인: https://developers.kakao.com/docs/ko/kakaologin/design-guide
- 토스 SDK v2 주문서형: https://docs.tosspayments.com/sdk/v2/js/payment-widget
- 토스 결제 구조: https://docs.tosspayments.com/guides/v2/payment-widget
- 토스 승인 처리: https://docs.tosspayments.com/guides/v2/payment-window/integration
- Apple App Review: https://developer.apple.com/app-store/review/guidelines/
- Google 한국 대체결제: https://support.google.com/googleplay/android-developer/answer/11222040?hl=en

## 검증 기록

`node --test tests/*.test.mjs`: 로그인 state 불일치/재사용 차단, 서버에만 토큰 유지, 동일 계정 ID, 세션별 로그아웃, 미설정 차단, live 결제키 차단, 서버 금액/주문 소유자 검증, 승인 중복 방지, 불확실 승인 조회 및 기존 소셜 테스트 통과. 외부 제공자 응답은 테스트 대역으로 검증했으며 실제 카카오 계정 로그인이나 토스 결제는 실행하지 않았습니다.

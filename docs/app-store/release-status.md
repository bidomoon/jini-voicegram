# 보이스그램 iOS 출시 상태

기준: 2026-11-18 한국 시각. 이전 날짜의 기록보다 이 파일과 `registration.json`의 현재 상태를 우선한다.

## 실제 완료

- Apple Developer App ID: `VOICEGRAM / kr.jiniteam.voicegram`, 팀 `5H4Z8667H6`.
- App Store Connect 앱: `6835965836`, 한국어, SKU `JINITEAM-VOICEGRAM-IOS`.
- 버전 `1.0.0`의 설명·홍보 문구·검색어·저작권, 앱 부제와 소셜 네트워킹 카테고리 저장.
- 수동 출시 설정. 앱 상태는 제출 준비 중이며 공개 다운로드·심사 제출 완료가 아니다.
- SwiftUI/WKWebView 프로젝트, 기기 내 음성 초안, 한국어 받아쓰기와 시스템 공유 코드 저장.
- GitHub Actions의 표준 `macos-26` 러너에서 서명 없는 빌드와 기존 네이티브 테스트를 실행하도록 설정. Apple 비밀 키·인증서를 전달하지 않는다.

앱 페이지: https://appstoreconnect.apple.com/apps/6835965836/distribution

첫 네이티브 검증: https://github.com/bidomoon/jini-voicegram/actions/runs/44126184330

첫 실행은 프로젝트 파일 파싱 오류로 실패했고 Swift 컴파일·네이티브 테스트에 도달하지 못했다. DEBUG=1 빌드 설정 문자열의 따옴표를 수정해 다음 실행으로 재검증한다. 새 Apple SDK 빌드 통과·TestFlight 업로드를 완료했다고 간주하지 않는다.

## 남은 단계와 완료 증거

| 순서 | 작업 | 완료로 판단할 증거 |
| --- | --- | --- |
| 1 | Apple SDK에서 빌드·테스트 | 위 Actions 실행의 실제 컴파일·테스트 로그. 대기·설정 파일 작성은 통과가 아님 |
| 2 | Mac에서 첫 Xcode Cloud 연결 | `ios/Voicegram/Voicegram.xcodeproj`의 `Voicegram` 스킴으로 새 Cloud 제품을 연결. 다른 앱의 제품을 재사용하지 않음 |
| 3 | 서명·TestFlight 업로드 | 이 앱의 Bundle ID와 일치하는 처리 완료 빌드가 TestFlight 목록에 표시 |
| 4 | 아이폰 실사용 | 권한 거절·허용, 음성 초안 복원, 사진·영상 게시와 재생, 공유·저장, 로그인 왕복, 계정 삭제 경로 시험 |
| 5 | 심사 접근·운영 조건 | 검증된 일반 회원·심사 로그인, 외부에서 열리는 개인정보/문의 URL, 실제 담당 연락처, 게시 전 콘텐츠 필터링과 신고·차단 운영 검증 |
| 6 | 스토어 최종 응답·제출 | 연령 등급·개인정보 응답·콘텐츠 권한·실제 기기 스크린샷을 제품 동작과 대조한 뒤 제출 |

기존 Netlify 팀 SSO 보호가 유지된다. 이를 해제하거나 비밀 우회 토큰을 앱에 포함하지 않는다. 일반 공개 접근 정책은 별도 결정과 실제 회원 인증 검증이 필요하다.

카카오를 일반 회원의 주요 로그인으로 제공할 때는 Apple 심사 지침 4.8에 맞는 동등한 로그인 선택지를 준비한다. 웹과 연계한 Sign in with Apple의 Services ID를 한국 개발자가 등록·갱신할 경우 서버 간 계정 알림 엔드포인트 요건도 적용한다. 가입·탈퇴·토큰 폐기를 함께 검증해야 한다.

첫 iOS 버전의 AI 유료 생성·토스 운영자 결제 시험은 제외했다. 향후 버전의 기능은 해당 버전의 심사 정보와 실제 동작을 일치시킨다.

## 확인한 공식 기준

2026-11-18 확인:

- Xcode Cloud 첫 연결: https://developer.apple.com/documentation/xcode/configuring-your-first-xcode-cloud-workflow/
- 공개 저장소의 표준 러너 무료 정책: https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- macOS 러너 레이블: https://github.com/actions/runner-images
- 현재 앱 심사 기준: https://developer.apple.com/app-store/review/guidelines/
- 2026-10-16 사용자 생성 콘텐츠 관리 기준 보강: https://developer.apple.com/news/?id=92th7e5i
- 한국 Sign in with Apple 서버 알림: https://developer.apple.com/news/?id=j9zukcr6

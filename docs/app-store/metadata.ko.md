# App Store Connect 입력 초안

확인일: 2026-11-18 (한국). App Store Connect 앱 레코드와 아래 기본 메타데이터를 저장했다. 심사 제출·공개 출시는 완료하지 않았다.

| 항목 | 입력값 또는 상태 |
| --- | --- |
| 앱 이름 | 보이스그램 |
| 플랫폼 | iOS, iPadOS |
| 기본 언어 | 한국어 |
| Bundle ID | kr.jiniteam.voicegram |
| SKU | JINITEAM-VOICEGRAM-IOS |
| 버전 | 1.0.0 |
| 주요 카테고리 | 소셜 네트워킹 |
| 부제 | 말로 기록하고 사진과 영상으로 나누는 일상 |
| 앱 식별자 | Apple Developer 등록 완료 |
| App Store Connect 앱 레코드 | 6835965836 · 1.0.0 제출 준비 중 |
| 출시 방식 | 수동 출시 |
| 네이티브 빌드 | GitHub Actions 첫 실행 대기, 통과 여부 미확인 |
| TestFlight·심사 | 미실행 |
| 요금 | 첫 버전 기본 SNS 무료, 유료 상품 등록 전 |

## 저장한 홍보 문구

말로 적고, 확인하고, 함께 나누는 일상. 사진과 영상에 내 이야기를 더해보세요.

## 설명 구성

보이스그램은 말이나 글로 내 이야기를 작성하고 사진·영상과 함께 나누는 일상 공유 앱입니다.

- 한국어 음성으로 글을 작성하고 내용을 확인합니다.
- 네트워크가 끊겼을 때도 아이폰에 음성 초안을 저장합니다.
- 사진·영상에 내 이야기를 더하고 미리보기 후 게시합니다.
- 이웃의 이야기에 좋아요와 댓글을 남깁니다.
- 내 기록과 계정을 관리하고, 게시물을 신고하거나 사용자를 차단합니다.

실제 제공 상태·공개 회원 접근·실기기 검증을 확인한 뒤 위 설명을 확정한다. AI 이미지·영상 생성 또는 유료 이용권을 첫 iOS 버전의 판매 기능으로 기재하지 않는다.

## 심사 전 확인

정확한 개인정보 정책/문의 URL, 연령 등급, 회원 로그인·탈퇴와 심사 계정, 콘텐츠 필터링·신고 대응, 기기 권한, 앱 개인정보 답변, 스크린샷, 실제 빌드 번호를 입력해야 한다. 없는 계정·스크린샷·정책 URL·심사 결과를 만들어 넣지 않는다. 카카오 등 소셜 로그인을 공개 제공할 경우 Apple 로그인 선택지 요건도 확인한다.

11월 17일 확인한 공식 자료:
- https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/documentation/speech/asking-permission-to-use-speech-recognition
- https://developer.apple.com/documentation/xcode/writing-custom-build-scripts

앱 페이지: https://appstoreconnect.apple.com/apps/6835965836/distribution

Xcode Cloud 첫 프로젝트 연결은 Mac의 Xcode에서 해야 한다. 기존 지니캡의 Cloud 제품은 변경하지 않았다. 공개 GitHub 저장소의 표준 macOS 26 Actions 작업으로 서명 없는 시뮬레이터 빌드·네이티브 테스트를 검증하도록 준비했다. Apple 인증서·API 비밀 키는 이 작업에 사용하지 않는다.

현재의 단계별 완료 증거와 남은 작업은 [출시 상태](release-status.md)에 기록한다.

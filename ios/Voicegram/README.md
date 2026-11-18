# 보이스그램 iOS

앱 이름 보이스그램 · Bundle ID `kr.jiniteam.voicegram` · 개발 팀 `5H4Z8667H6`.

## 구현 구조

SwiftUI 화면과 WKWebView로 기존 SNS를 연결한다. Apple Speech를 사용하는 한국어 받아쓰기, 기기 내 음성 초안의 자동 저장, 시스템 공유·파일 저장, 연결 오류 안내와 재시도를 포함한다. 사진·영상 선택은 WebKit의 시스템 파일 선택기를 사용하고 촬영 권한은 사용자가 누른 시점에 요청한다.

웹의 API 인증·미디어 쿠키를 유지한다. 외부 로그인 페이지는 탐색할 수 있지만 네이티브 기능은 정확한 보이스그램 HTTPS 출처의 메인 프레임에만 허용한다. 인증·TLS 보호를 우회하지 않는다. 네이티브 초안은 원본을 기기에 남기고 웹 초안에 이어 붙이며 게시를 자동 실행하지 않는다. 웹의 2,200 UTF-16 길이 제한을 동일하게 적용한다.

기본 iPhone/iPad 대상으로 iOS 17 이상, Xcode 26 이상을 사용한다. 외부 Swift 패키지와 별도 유료 빌드 도구는 없다. `Voicegram.xcodeproj`와 공유 스킴 `Voicegram`을 저장소에 포함했다.

## 빌드와 시험

Mac 또는 연결된 Xcode Cloud에서 `ios/Voicegram/Voicegram.xcodeproj`를 열고 `Voicegram` 스킴을 빌드한다. 앱 서명은 등록한 팀과 식별자로 자동 서명한다. `VoicegramTests`는 정확한 출처·로그인 페이지와 네이티브 권한 분리·파일 이름 보호를 검사한다. 마이크·카메라·사진 선택·동영상 재생·파일 공유는 실기기에서 별도로 검증해야 한다.

```sh
xcodebuild -project ios/Voicegram/Voicegram.xcodeproj -scheme Voicegram \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Xcode Cloud 설정 시 프로젝트 위치는 `ios/Voicegram/Voicegram.xcodeproj`, 스킴은 `Voicegram`이다. `ci_scripts/ci_pre_xcodebuild.sh`는 CI 빌드 번호를 앱 버전 코드에 적용한다. 이 파일을 작성한 것만으로 Xcode Cloud나 TestFlight가 설정되지는 않는다.

## 아직 완료하지 않은 조건

- 로컬 작업 환경은 Linux다. Apple SDK 컴파일·네이티브 테스트는 GitHub의 macOS에서 검증하며 결과는 `docs/app-store/release-status.md`에 기록한다. 서명된 IPA·TestFlight 업로드·실기기 시험의 완료 여부는 별도로 확인한다.
- 웹 사이트는 Netlify 팀 로그인 보호 중이다. 앱에 저장한 로그인 정보나 우회 토큰을 넣지 않았다. 내부 테스터 접근과 향후 심사 계정·회원 인증을 실제로 확인해야 한다.
- App Store Connect 앱 레코드 `6835965836`을 만들고 1.0.0 기본 정보를 저장했다. 첫 Xcode Cloud 연결은 Mac의 Xcode에서 진행해야 한다. 등록 정보·남은 심사 항목은 `docs/app-store`에서 관리한다.
- 첫 네이티브 버전은 글·사진·영상 SNS와 초대형 베타의 AI 이미지 연결을 포함한다. 실제 유료 생성은 이번 검증에서 요청하지 않았다. AI 영상·운영자 토스 결제 시험은 제외한다. 정식 유료 기능은 StoreKit과 서버 사용량 처리를 검증한 후 출시한다.
- 공개 회원 로그인, Sign in with Apple 요건, 공개 개인정보/문의 URL, 콘텐츠 필터링과 신고 운영, 연령 등급, 앱 개인정보 응답·실제 스크린샷을 마친 뒤 심사를 신청한다.

웹 브리지 변경은 네이티브 설치 이전의 일반 브라우저 경로를 유지한다. 네이티브 지원 여부나 App Store 승인 여부를 웹 배포 성공으로 판단하지 않는다.

## GitHub 자동 검증

`.github/workflows/ios.yml`은 공개 저장소의 표준 `macos-26` 환경에서 iOS 코드 변경 때 서명 없는 시뮬레이터 빌드·iPhone Release Archive와 네이티브 초안·브리지 테스트를 실행한다. 저장소 읽기 권한만 사용하고 Apple 인증서·API 키·유료 대형 러너를 사용하지 않는다. 컴파일·테스트 성공은 이 작업의 실제 결과로 확인하며, 설치용 IPA·TestFlight 업로드와는 별도다.

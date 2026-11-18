# 보이스그램 iOS 출시 상태

기준: 2026-11-18 한국 시각. 이 문서와 `registration.json`이 현재 출시 상태를 관리한다.

## 현재 확인 결과

| 항목 | 확인 상태 |
| --- | --- |
| Apple Developer App ID | `VOICEGRAM / kr.jiniteam.voicegram`, 팀 `5H4Z8667H6` 등록 |
| App Store Connect | 앱 `6835965836`, 버전 `1.0.0`, 제출 준비 중, 수동 출시 |
| 스토어 기본 정보 | 한국어 설명·홍보 문구·검색어·저작권·부제·소셜 네트워킹 카테고리 저장 |
| 웹 자동검사 | TypeScript·88개 검사·프로덕션 빌드 통과 |
| 이전 Apple SDK 검증 | 소스 `9d80318110f02406f6e242085c3fb687fe58adb6`, 실행 `44225816547` completed / success: 서명 없는 Simulator 빌드·네이티브 테스트 |
| iPhone 초안 수정본 | 소스 `a85b6be9d8960111ecb1a632fdcae33ad79b2532`, 실행 `44305294021` completed / success: Simulator 컴파일·서명 없는 iPhone Release Archive·네이티브 8개 테스트 통과 |
| 최종 iPad 회전 설정 보완본 | 소스 `68134f1b31049f0c2eafdfc5c4892193ad022e1d`, 실행 `44307289766` completed / success: 컴파일·Release Archive·네이티브 8개 테스트 통과, Archive의 방향 경고 없음 |
| Xcode Cloud | 보이스그램 전용 제품의 최초 연결 미완료. 기존 JINICAP 제품은 별도 앱이므로 재사용하지 않음 |
| TestFlight | App Store Connect 화면에서 ‘빌드 없음’ 확인. ‘보이스그램 내부 검증’ 그룹만 존재 |
| 실제 iPhone 시험 | 마이크·카메라·공유·새 자동 저장 미완료 |
| 앱 심사 | 제출하지 않음. 공개 다운로드·판매 준비 완료가 아님 |

앱 페이지: https://appstoreconnect.apple.com/apps/6835965836/distribution

새 iOS 검증: https://github.com/bidomoon/jini-voicegram/actions/runs/44307289766

## 구현과 남은 작업

SwiftUI/WKWebView 프로젝트에 한국어 받아쓰기, 기기 내 음성 초안, 자동 저장, 시스템 공유·파일 저장, 연결 오류 안내·재시도가 구현되어 있다. 초기 웹 초안 복원·사진/영상 게시의 브라우저 검증 기록과 새 네이티브 변경은 각각 `docs/reliability-2026-11-18.md`와 `docs/native-draft-reliability-2026-11-18.md`에서 구분한다.

1. 최종 Apple SDK 컴파일·Release Archive·네이티브 8개 검사는 통과했다. 서명 없는 Release Archive는 TestFlight 설치용 IPA가 아니다.
2. Mac의 Xcode에서 `ios/Voicegram/Voicegram.xcodeproj`를 열고 `Voicegram` 스킴으로 첫 Xcode Cloud 워크플로를 연결한다. 저장소 `bidomoon/jini-voicegram`, Bundle ID `kr.jiniteam.voicegram`, 개발 팀 `5H4Z8667H6`를 대조한다.
3. 서명·Archive·업로드 후 보이스그램 TestFlight 목록에 처리 완료 빌드가 표시되어야 업로드 완료다.
4. 실제 아이폰에서 권한 거절·허용, 초안 복원·자동 저장, 사진·영상 게시와 재생, 공유·저장, 로그인 왕복을 검증한다. 실제 계정 삭제는 별도 확인을 거친다.
5. 공개 회원 인증·심사 로그인, 외부에서 열리는 개인정보/문의 URL, 실제 연락처, 콘텐츠 필터링과 신고·차단 운영을 검증한다.
6. 실제 동작에 맞게 연령 등급·개인정보 응답·콘텐츠 권한·실기기 스크린샷을 준비하고 최종 심사 제출을 진행한다.

기존 Netlify 팀 SSO 보호를 유지한다. 로그인 우회 토큰을 앱에 넣지 않는다. 일반 공개 접근은 별도 결정과 실제 회원 인증 검증이 필요하다.

카카오를 일반 회원의 주요 로그인으로 제공할 때는 Apple 심사 지침 4.8에 맞는 동등한 로그인 선택지를 준비한다. 웹과 연계한 Sign in with Apple의 Services ID를 한국 개발자가 등록·갱신할 때 적용되는 서버 간 계정 알림과 가입·탈퇴·토큰 폐기를 검증한다.

첫 iOS 버전의 유료 상품 판매·토스 운영자 결제 시험은 제외했다. 초대형 베타의 AI 이미지 연결은 실제 아이폰 검증과 심사 조건을 확인한 뒤 제출 범위를 확정한다. AI 영상 생성은 후속 단계다.

## 공식 참고

- 첫 Xcode Cloud 연결: https://developer.apple.com/documentation/xcode/configuring-your-first-xcode-cloud-workflow
- TestFlight 배포: https://developer.apple.com/documentation/xcode/distributing-your-xcode-cloud-builds-through-testflight
- 업로드 도구: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
- 앱 심사 기준: https://developer.apple.com/app-store/review/guidelines/
- 기존 2026-11-18 확인 기록의 사용자 생성 콘텐츠 관리 기준: https://developer.apple.com/news/?id=92th7e5i
- 기존 2026-11-18 확인 기록의 한국 Sign in with Apple 서버 알림: https://developer.apple.com/news/?id=j9zukcr6

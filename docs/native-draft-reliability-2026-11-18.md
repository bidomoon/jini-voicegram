# 보이스그램 iPhone 초안 안정성

기준: 2026-11-18 한국 시각. 보이스그램의 기존 Bundle ID와 저장 형식을 유지한다.

## 이번 변경

- 아이폰의 별도 ‘내 음성 초안’ 화면에서 입력·받아쓰기가 400ms 멈추면 기기에 저장한다. 새 입력이 시작되거나 화면이 닫히면 앞선 대기 저장을 취소한다. 기존 백그라운드 이동·닫기·수동 저장도 유지한다.
- 초기 초안을 읽기 전의 빈 화면으로 저장 파일을 덮지 않게 한다.
- 같은 내용을 다시 저장하면 초안 ID를 유지한다. 내용 수정 때만 ID를 갱신하며 기존 JSON 초안도 읽는다.
- 읽을 수 없는 원본 보존, 빈 초안 재시작, 실패 시 저장 완료로 처리하지 않기, 2,200 UTF-16 제한과 이모지 경계를 Apple SDK 테스트에 추가했다.
- iOS 자동 검증에 실제 iPhone 대상 Release Archive를 서명 없이 생성하는 단계를 추가했다. 이 결과는 서명된 IPA·TestFlight 업로드와 별개다.

## 확인 상태

- 로컬 웹 TypeScript 검사·88개 기존 자동검사·Netlify 프로덕션 빌드: 통과.
- 새 Swift 수정본의 Apple SDK 컴파일·Release Archive·네이티브 테스트: GitHub iOS 검증 실행 후 갱신한다.
- 실제 iPhone에서의 자동 저장·음성·카메라·공유 시험: 미완료. 강제 종료 직전 400ms 이내의 편집이나 기기 저장 실패까지 보존을 보장하지 않는다.

## TestFlight 재확인

2026-11-18 App Store Connect의 보이스그램 앱 `6835965836`을 직접 열어 TestFlight ‘빌드 없음’과 기존 ‘보이스그램 내부 검증’ 그룹을 확인했다. Xcode Cloud 전체 목록의 기존 App 제품은 앱 `6835256075`의 JINICAP 저장소와 연결되어 있다. 다른 앱 제품의 설정을 변경하지 않았다.

이 앱의 첫 Xcode Cloud 연결은 Mac의 Xcode에서 `ios/Voicegram/Voicegram.xcodeproj` → `Voicegram` 스킴 → Xcode Cloud 시작으로 진행해야 한다. 보이스그램 저장소 `bidomoon/jini-voicegram`, Bundle ID `kr.jiniteam.voicegram`, 개발 팀 `5H4Z8667H6`가 일치하는지 확인한 뒤 Archive와 TestFlight 배포를 연결한다. 웹 화면의 성공이나 다른 앱의 성공 빌드는 이 앱의 업로드 완료 증거가 아니다.

공식 확인: https://developer.apple.com/documentation/xcode/configuring-your-first-xcode-cloud-workflow

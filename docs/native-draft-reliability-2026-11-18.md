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
- 소스 `a85b6be9d8960111ecb1a632fdcae33ad79b2532`, GitHub 실행 `44305294021` / 작업 `134805167396`: completed / success. Simulator 컴파일·서명 없는 iPhone Release Archive·네이티브 8개 테스트가 각각 통과했다. 실패 0개.
- 첫 Archive에서 확인한 iPad 방향 경고를 수정했다. iPad에 상하 반전 세로 방향을 더해 네 방향을 모두 선언하며 iPhone의 세로 설정은 유지한다. 설정 파싱 검증 통과. 최종 소스 `68134f1b31049f0c2eafdfc5c4892193ad022e1d` / 실행 `44307289766` / 작업 `134812034979`는 completed / success다. Simulator 컴파일·iPhone Release Archive·네이티브 8개 테스트가 모두 통과했고 Archive 로그에서 해당 회전 경고가 사라졌다.
- 기존 웹 운영 배포 `6afd9e608c3caaa73132ec64`는 같은 최종 소스에서 ready다. 배포 오류 없음, 게시 시각 2026-11-18 21:47:54 한국. 네이티브 앱 설치본 배포를 의미하지 않는다.
- 실제 iPhone에서의 자동 저장·음성·카메라·공유 시험: 미완료. 강제 종료 직전 400ms 이내의 편집이나 기기 저장 실패까지 보존을 보장하지 않는다.

## TestFlight 재확인

2026-11-18 App Store Connect의 보이스그램 앱 `6835965836`을 직접 열어 TestFlight ‘빌드 없음’과 기존 ‘보이스그램 내부 검증’ 그룹을 확인했다. Xcode Cloud 전체 목록의 기존 App 제품은 앱 `6835256075`의 JINICAP 저장소와 연결되어 있다. 다른 앱 제품의 설정을 변경하지 않았다.

이 앱의 첫 Xcode Cloud 연결은 Mac의 Xcode에서 `ios/Voicegram/Voicegram.xcodeproj` → `Voicegram` 스킴 → Xcode Cloud 시작으로 진행해야 한다. 보이스그램 저장소 `bidomoon/jini-voicegram`, Bundle ID `kr.jiniteam.voicegram`, 개발 팀 `5H4Z8667H6`가 일치하는지 확인한 뒤 Archive와 TestFlight 배포를 연결한다. 웹 화면의 성공이나 다른 앱의 성공 빌드는 이 앱의 업로드 완료 증거가 아니다.

공식 확인: https://developer.apple.com/documentation/xcode/configuring-your-first-xcode-cloud-workflow

네 방향 선언의 공식 근거: https://developer.apple.com/documentation/uikit/uiviewcontroller/supportedinterfaceorientations

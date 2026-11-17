import AVFoundation
import Combine
import Speech

@MainActor
final class SpeechCapture: ObservableObject {
    @Published private(set) var listening = false
    @Published private(set) var transcript = ""
    @Published private(set) var notice = ""
    var onEvent: ((String, String, String) -> Void)?
    private let engine = AVAudioEngine()
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ko-KR"))
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var session: String?
    private var tapped = false
    private var deadline: Timer?
    private var finishing: DispatchWorkItem?

    func start(id: String) {
        cancel()
        session = id
        transcript = ""
        notice = "권한을 확인하고 있어요."
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self, self.session == id else { return }
                guard status == .authorized else {
                    self.fail("설정에서 보이스그램의 음성 인식을 허용해주세요.")
                    return
                }
                AVAudioApplication.requestRecordPermission { allowed in
                    DispatchQueue.main.async {
                        guard self.session == id else { return }
                        if allowed { self.begin(id: id) }
                        else { self.fail("설정에서 보이스그램의 마이크 사용을 허용해주세요.") }
                    }
                }
            }
        }
    }

    private func begin(id: String) {
        guard let recognizer, recognizer.isAvailable else {
            fail("지금은 음성 인식을 연결할 수 없어요. 글로 입력하거나 잠시 후 다시 시도해주세요.")
            return
        }
        do {
            let audio = AVAudioSession.sharedInstance()
            try audio.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audio.setActive(true, options: .notifyOthersOnDeactivation)
            let next = SFSpeechAudioBufferRecognitionRequest()
            next.shouldReportPartialResults = true
            if recognizer.supportsOnDeviceRecognition { next.requiresOnDeviceRecognition = true }
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else {
                fail("마이크를 사용할 수 없어요. 연결된 오디오 기기를 확인해주세요.")
                return
            }
            request = next
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                next.append(buffer)
            }
            tapped = true
            task = recognizer.recognitionTask(with: next) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self, self.session == id else { return }
                    if let result {
                        self.transcript = result.bestTranscription.formattedString.voicegramLimited
                        self.onEvent?(id, "partial", self.transcript)
                        if result.isFinal { self.finish(); return }
                    }
                    if error != nil {
                        if self.transcript.isEmpty { self.fail("말소리를 인식하지 못했어요. 다시 말씀해주세요.") }
                        else { self.finish() }
                    }
                }
            }
            engine.prepare()
            try engine.start()
            listening = true
            notice = "듣고 있어요. 최대 30초 동안 말할 수 있어요."
            onEvent?(id, "start", "")
            deadline = Timer.scheduledTimer(withTimeInterval: 30, repeats: false) { [weak self] _ in
                Task { @MainActor in self?.stop() }
            }
        } catch {
            fail("마이크를 시작하지 못했어요. 다른 앱의 녹음을 종료한 뒤 다시 시도해주세요.")
        }
    }

    func stop(id: String? = nil) {
        if let id, session != id { return }
        guard session != nil else { return }
        if !listening && request == nil { cancel(id: id); return }
        releaseAudio()
        request?.endAudio()
        let ending = DispatchWorkItem { [weak self] in self?.finish() }
        finishing?.cancel()
        finishing = ending
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: ending)
    }

    func cancel(id: String? = nil) {
        if let id, session != id { return }
        let previous = session
        session = nil
        cleanUp()
        if let previous { onEvent?(previous, "end", "") }
    }

    private func finish() {
        guard let id = session else { return }
        session = nil
        let text = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        cleanUp()
        if !text.isEmpty { onEvent?(id, "final", text) }
        else { onEvent?(id, "error", "말소리를 듣지 못했어요. 다시 말씀해주세요.") }
        onEvent?(id, "end", "")
        notice = "내용을 확인하고 사용해주세요."
    }

    private func fail(_ text: String) {
        let id = session
        session = nil
        notice = text
        cleanUp()
        if let id { onEvent?(id, "error", text); onEvent?(id, "end", "") }
    }

    private func releaseAudio() {
        deadline?.invalidate()
        deadline = nil
        engine.stop()
        if tapped { engine.inputNode.removeTap(onBus: 0); tapped = false }
        listening = false
    }

    private func cleanUp() {
        finishing?.cancel()
        finishing = nil
        releaseAudio()
        request?.endAudio()
        request = nil
        task?.cancel()
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

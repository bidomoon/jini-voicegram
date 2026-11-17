import SwiftUI

@main
@MainActor
struct VoicegramApp: App {
    @StateObject private var model = WebModel()
    @StateObject private var drafts = DraftStore()
    @Environment(\.scenePhase) private var phase
    @State private var composing = false

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ZStack {
                    VoicegramWebView(model: model)
                    if let error = model.error {
                        ContentUnavailableView {
                            Label("이야기를 연결하지 못했어요", systemImage: "wifi.exclamationmark")
                        } description: {
                            Text(error + "\n음성 초안은 이 아이폰에 먼저 저장할 수 있어요.")
                        } actions: {
                            Button("다시 연결") { model.reload() }.buttonStyle(.borderedProminent)
                            Button("음성 초안 만들기") { composing = true }
                        }.background(.background)
                    }
                }
                .navigationTitle("보이스그램")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        if model.canGoBack { Button("뒤로", systemImage: "chevron.left") { model.goBack() } }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("내 음성 초안", systemImage: "waveform.badge.plus") {
                            model.cancelSpeech()
                            composing = true
                        }
                    }
                }
                .safeAreaInset(edge: .top, spacing: 0) {
                    if model.loading { ProgressView().frame(maxWidth: .infinity).padding(4) }
                    if let message = model.notice { Text(message).font(.footnote).padding(8).frame(maxWidth: .infinity).background(.thinMaterial) }
                }
                .sheet(isPresented: $composing) {
                    NativeComposer(drafts: drafts) { draft in
                        model.queue(draft)
                        composing = false
                    }
                }
            }
            .tint(Color(red: 0.09, green: 0.25, blue: 0.21))
            .onChange(of: phase) { _, value in if value != .active { model.cancelSpeech() } }
        }
    }
}

@MainActor
private struct NativeComposer: View {
    @ObservedObject var drafts: DraftStore
    let send: (NativeDraft) -> Void
    @StateObject private var speech = SpeechCapture()
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var phase
    @State private var text = ""
    @State private var prefix = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("말로 남기는 나의 이야기") {
                    Text("받아쓴 내용은 확인한 뒤 사용해요. 초안 전달만으로 게시되지는 않습니다.")
                        .font(.footnote).foregroundStyle(.secondary)
                    TextEditor(text: $text).disabled(speech.listening).frame(minHeight: 210).accessibilityLabel("음성 초안 내용")
                        .onChange(of: text) { _, value in if value.utf16.count > 2200 { text = value.voicegramLimited } }
                    Text("\(text.utf16.count)/2,200자").font(.caption).foregroundStyle(.secondary)
                    Button(speech.listening ? "받아쓰기 끝내기" : "눌러서 말하기", systemImage: speech.listening ? "stop.circle.fill" : "mic.fill") {
                        if speech.listening { speech.stop() }
                        else { prefix = text; speech.start(id: UUID().uuidString) }
                    }
                    Text(speech.notice).font(.footnote)
                }
                Section("내 초안 보관") {
                    Button("이 아이폰에 저장") { speech.cancel(); _ = drafts.save(text) }
                    Text(drafts.notice).font(.footnote)
                    Button("보이스그램에서 확인하고 게시") {
                        speech.cancel()
                        if drafts.save(text) { send(drafts.draft) }
                    }.disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                Section {
                    Text("음성은 Apple 음성 인식으로 처리됩니다. 기기 지원 상태에 따라 Apple 서버에 전달될 수 있어요. 연결이 없어도 저장한 초안은 다시 열 수 있습니다.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("내 음성 초안")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("저장하고 닫기") { speech.cancel(); if drafts.save(text) { dismiss() } } } }
            .onAppear { text = drafts.draft.caption }
            .onChange(of: speech.transcript) { _, result in
                text = (prefix + (prefix.isEmpty ? "" : "\n") + result).voicegramLimited
            }
            .onChange(of: phase) { _, value in if value != .active { speech.cancel(); _ = drafts.save(text) } }
            .onDisappear { speech.cancel(); _ = drafts.save(text) }
            .interactiveDismissDisabled()
        }
    }
}

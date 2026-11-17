import AVFoundation
import Combine
import SafariServices
import SwiftUI
import WebKit

enum BridgePolicy {
    static let appURL = URL(string: "https://jini-voicegram.netlify.app/")!
    static func trusted(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == "https" && url.host == appURL.host && (url.port == nil || url.port == 443)
    }
    static func navigationAllowed(_ url: URL?) -> Bool {
        guard let url, url.scheme == "https", url.port == nil || url.port == 443 else { return false }
        // These pages can complete sign-in, but never receive native privileges.
        return [appURL.host!, "kauth.kakao.com", "accounts.kakao.com", "app.netlify.com", "api.netlify.com"].contains(url.host ?? "")
    }
    static func safeFilename(_ value: String) -> Bool {
        !value.isEmpty && value.count <= 100 && !value.contains("/") && !value.contains("\\") && !value.hasPrefix(".") && value.rangeOfCharacter(from: .controlCharacters) == nil
    }
}

@MainActor
final class WebModel: ObservableObject {
    @Published var loading = true
    @Published var error: String?
    @Published var notice: String?
    @Published var canGoBack = false
    weak var webView: WKWebView?
    weak var coordinator: WebCoordinator?
    var pending: NativeDraft?
    func reload() { error = nil; webView?.reload() }
    func goBack() { webView?.goBack() }
    func cancelSpeech() { coordinator?.speech.cancel() }
    func queue(_ draft: NativeDraft) {
        pending = draft
        notice = "초안은 이 아이폰에 보관되어 있어요. 연결 후 작성 화면으로 전달합니다."
        coordinator?.deliverDraft(reset: true)
    }
}

@MainActor
struct VoicegramWebView: UIViewRepresentable {
    @ObservedObject var model: WebModel
    func makeCoordinator() -> WebCoordinator { WebCoordinator(model) }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = [.audio, .video]
        config.applicationNameForUserAgent = "Voicegram-iOS/1.0"
        config.userContentController.add(context.coordinator, name: "voicegram")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.scrollView.keyboardDismissMode = .interactive
        web.allowsBackForwardNavigationGestures = true
        model.webView = web
        model.coordinator = context.coordinator
        web.load(URLRequest(url: BridgePolicy.appURL))
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) { context.coordinator.deliverDraft() }
    static func dismantleUIView(_ uiView: WKWebView, coordinator: WebCoordinator) {
        coordinator.speech.cancel()
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "voicegram")
        uiView.navigationDelegate = nil
        uiView.uiDelegate = nil
    }
}

@MainActor
final class WebCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    let speech = SpeechCapture()
    private let model: WebModel
    private var ready = false
    private var awaitingDraft: String?
    private var exportBusy = false
    private var interrupted: NSObjectProtocol?

    init(_ model: WebModel) {
        self.model = model
        super.init()
        speech.onEvent = { [weak self] id, phase, text in
            self?.emit("voicegram-native-speech", ["id": id, "phase": phase, "text": text])
        }
        interrupted = NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.speech.cancel() }
        }
    }
    deinit { if let interrupted { NotificationCenter.default.removeObserver(interrupted) } }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              BridgePolicy.trusted(message.frameInfo.request.url),
              BridgePolicy.trusted(model.webView?.url),
              let value = message.body as? [String: Any], let action = value["action"] as? String else { return }
        let id = value["id"] as? String ?? ""
        switch action {
        case "ready": ready = true; deliverDraft()
        case "draft.imported":
            guard id == model.pending?.id else { return }
            model.pending = nil; awaitingDraft = nil
            model.notice = "초안을 작성 화면으로 전달했어요. 내용을 확인한 뒤 게시해주세요."
        case "draft.rejected":
            guard id == model.pending?.id else { return }
            awaitingDraft = id
            model.notice = "작성 중인 글이 있어 초안을 보관했어요. 기존 글을 저장한 뒤 다시 전달해주세요."
        case "speech.start": if UUID(uuidString: id) != nil { speech.start(id: id) }
        case "speech.stop": if UUID(uuidString: id) != nil { speech.stop(id: id) }
        case "speech.cancel": speech.cancel(id: id)
        case "share":
            guard let raw = value["url"] as? String, let url = URL(string: raw), BridgePolicy.trusted(url) else { return }
            let text = String((value["text"] as? String ?? "").prefix(2200))
            presentShare([text, url])
        case "file.export": export(value, id: id)
        default: break
        }
    }

    func deliverDraft(reset: Bool = false) {
        if reset { awaitingDraft = nil }
        guard ready, BridgePolicy.trusted(model.webView?.url), let draft = model.pending,
              awaitingDraft != draft.id else { return }
        awaitingDraft = draft.id
        emit("voicegram-native-draft", ["id": draft.id, "caption": draft.caption])
    }

    private func emit(_ name: String, _ payload: [String: Any]) {
        guard BridgePolicy.trusted(model.webView?.url),
              let bytes = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: bytes, encoding: .utf8) else { return }
        model.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('\(name)', {detail: \(json)}));", completionHandler: nil)
    }

    private func export(_ value: [String: Any], id: String) {
        guard !exportBusy, UUID(uuidString: id) != nil,
              let name = value["filename"] as? String, BridgePolicy.safeFilename(name),
              let encoded = value["base64"] as? String, encoded.utf8.count <= 28_000_000,
              let bytes = Data(base64Encoded: encoded), bytes.count <= 20_000_000,
              !bytes.isEmpty else {
            emit("voicegram-native-result", ["id": id, "error": "파일을 준비하지 못했어요. 파일 크기와 이름을 확인해주세요."])
            return
        }
        exportBusy = true
        do {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let file = folder.appendingPathComponent(name)
            try bytes.write(to: file, options: .completeFileProtectionUnlessOpen)
            let presented = presentShare([file]) { [weak self] in
                try? FileManager.default.removeItem(at: folder)
                self?.exportBusy = false
            }
            guard presented else { throw CocoaError(.userCancelled) }
            emit("voicegram-native-result", ["id": id, "ok": true])
        } catch {
            exportBusy = false
            emit("voicegram-native-result", ["id": id, "error": "파일을 준비하지 못했어요. 저장 공간을 확인해주세요."])
        }
    }

    @discardableResult
    private func presentShare(_ items: [Any], completion: (() -> Void)? = nil) -> Bool {
        guard let root = model.webView?.window?.rootViewController else { completion?(); return false }
        var presenter = root
        while let shown = presenter.presentedViewController { presenter = shown }
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.popoverPresentationController?.sourceView = presenter.view
        controller.popoverPresentationController?.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
        controller.completionWithItemsHandler = { _, _, _, _ in completion?() }
        presenter.present(controller, animated: true)
        return true
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        speech.cancel(); ready = false; awaitingDraft = nil
        model.loading = true; model.error = nil
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        model.loading = false; model.canGoBack = webView.canGoBack
        if !BridgePolicy.trusted(webView.url) { model.notice = "로그인을 마치면 보이스그램으로 돌아옵니다." }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        speech.cancel(); ready = false; model.loading = false
        model.error = "화면이 중단됐어요. 저장한 초안을 보관한 채 다시 연결할 수 있어요."
    }
    private func failed(_ error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        model.loading = false; model.error = "인터넷 연결을 확인한 뒤 다시 시도해주세요."
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if BridgePolicy.navigationAllowed(url) { decisionHandler(.allow); return }
        if navigationAction.navigationType == .linkActivated, url.scheme == "https",
           let presenter = webView.window?.rootViewController {
            presenter.present(SFSafariViewController(url: url), animated: true)
        }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if BridgePolicy.navigationAllowed(navigationAction.request.url) { webView.load(navigationAction.request) }
        else if let url = navigationAction.request.url, url.scheme == "https", let presenter = webView.window?.rootViewController {
            presenter.present(SFSafariViewController(url: url), animated: true)
        }
        return nil
    }
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(frame.isMainFrame && BridgePolicy.trusted(frame.request.url) && origin.protocol == "https" && origin.host == BridgePolicy.appURL.host ? .prompt : .deny)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard BridgePolicy.trusted(frame.request.url), let presenter = webView.window?.rootViewController else { completionHandler(false); return }
        let alert = UIAlertController(title: "내용 확인", message: String(message.prefix(2000)), preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler(true) })
        presenter.present(alert, animated: true)
    }
}

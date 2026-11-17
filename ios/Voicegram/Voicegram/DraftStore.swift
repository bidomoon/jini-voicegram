import Combine
import Foundation

extension String {
    var voicegramLimited: String {
        var result = "", units = 0
        for character in self {
            let next = String(character)
            if units + next.utf16.count > 2200 { break }
            result += next
            units += next.utf16.count
        }
        return result
    }
}

struct NativeDraft: Codable, Equatable {
    var id = UUID().uuidString
    var caption = ""
}

@MainActor
final class DraftStore: ObservableObject {
    @Published private(set) var draft = NativeDraft()
    @Published private(set) var notice = ""
    private let file: URL
    private var needsRecovery = false

    init() {
        file = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("voicegram-draft.json")
        if FileManager.default.fileExists(atPath: file.path) {
            do { draft = try JSONDecoder().decode(NativeDraft.self, from: Data(contentsOf: file)) }
            catch { needsRecovery = true; notice = "저장된 초안을 읽지 못했어요. 새 내용은 별도 파일에 보존합니다." }
        }
    }

    @discardableResult
    func save(_ caption: String) -> Bool {
        let next = NativeDraft(caption: caption.voicegramLimited)
        do {
            let data = try JSONEncoder().encode(next)
            // Do not replace unreadable originals; keep them for recovery.
            if needsRecovery, FileManager.default.fileExists(atPath: file.path) {
                let backup = file.deletingLastPathComponent().appendingPathComponent("voicegram-recovery-\(UUID().uuidString).json")
                try FileManager.default.copyItem(at: file, to: backup)
            }
            try data.write(to: file, options: [.atomic, .completeFileProtectionUnlessOpen])
            needsRecovery = false
            draft = next
            notice = "이 아이폰에 초안을 저장했어요. 피드에는 아직 게시하지 않았어요."
            return true
        } catch {
            notice = "초안을 저장하지 못했어요. 내용을 복사해 보관한 뒤 다시 시도해주세요."
            return false
        }
    }
}

import XCTest
@testable import Voicegram

final class BridgePolicyTests: XCTestCase {
    func testNativePrivilegesOnlyBelongToExactHTTPSAppOrigin() {
        XCTAssertTrue(BridgePolicy.trusted(URL(string: "https://jini-voicegram.netlify.app/?post=123")))
        XCTAssertTrue(BridgePolicy.trusted(URL(string: "https://jini-voicegram.netlify.app:443/")))
        for value in ["http://jini-voicegram.netlify.app", "https://jini-voicegram.netlify.app.evil.example", "https://jini-voicegram.netlify.app:444", "https://evil.example/?origin=jini-voicegram.netlify.app", "file:///tmp/index.html", "https://app.netlify.com/"] {
            XCTAssertFalse(BridgePolicy.trusted(URL(string: value)), value)
        }
        XCTAssertFalse(BridgePolicy.trusted(nil))
    }
    func testSignInNavigationDoesNotReceiveNativePrivileges() {
        let login = URL(string: "https://kauth.kakao.com/oauth/authorize")
        XCTAssertTrue(BridgePolicy.navigationAllowed(login))
        XCTAssertFalse(BridgePolicy.trusted(login))
        XCTAssertFalse(BridgePolicy.navigationAllowed(URL(string: "https://kauth.kakao.com.evil.example/")))
    }
    func testExportsCannotEscapeTheirTemporaryDirectory() {
        XCTAssertTrue(BridgePolicy.safeFilename("voicegram-20261117.json"))
        for value in ["", ".hidden", "../private.json", "a/b.json", "a\\b.json", String(repeating: "x", count: 101)] {
            XCTAssertFalse(BridgePolicy.safeFilename(value), value)
        }
    }
}


@MainActor
final class DraftStoreTests: XCTestCase {
    private func temporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        return directory
    }

    func testRepeatedSavesAndRelaunchKeepTheSameDraftIdentity() throws {
        let directory = try temporaryDirectory()
        let store = DraftStore(directory: directory)
        XCTAssertTrue(store.save("오늘의 이야기"))
        let original = store.draft
        XCTAssertTrue(store.save("오늘의 이야기"))
        XCTAssertEqual(store.draft, original)
        let restored = DraftStore(directory: directory)
        XCTAssertEqual(restored.draft, original)
        XCTAssertTrue(restored.save("오늘의 이야기"))
        XCTAssertEqual(restored.draft, original)
        XCTAssertTrue(restored.save("수정한 이야기"))
        XCTAssertNotEqual(restored.draft.id, original.id)
        XCTAssertEqual(DraftStore(directory: directory).draft, restored.draft)
    }

    func testEmptyingDraftDoesNotResurrectPreviousTextAfterRelaunch() throws {
        let directory = try temporaryDirectory()
        let store = DraftStore(directory: directory)
        XCTAssertTrue(store.save("지울 이야기"))
        XCTAssertTrue(store.save(""))
        XCTAssertEqual(DraftStore(directory: directory).draft.caption, "")
    }

    func testUnreadableDraftIsPreservedBeforeReplacement() throws {
        let directory = try temporaryDirectory()
        let file = directory.appendingPathComponent("voicegram-draft.json")
        let unreadable = Data("{incomplete draft".utf8)
        try unreadable.write(to: file)
        let store = DraftStore(directory: directory)
        XCTAssertTrue(store.save("복구한 새 이야기"))
        let backups = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).filter { $0.lastPathComponent.hasPrefix("voicegram-recovery-") }
        XCTAssertEqual(backups.count, 1)
        XCTAssertEqual(try Data(contentsOf: XCTUnwrap(backups.first)), unreadable)
        XCTAssertEqual(DraftStore(directory: directory).draft.caption, "복구한 새 이야기")
        XCTAssertTrue(store.save("다시 수정한 이야기"))
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).count, 2)
    }

    func testWriteFailureDoesNotClaimSavedOrReplaceInMemoryDraft() throws {
        let directory = try temporaryDirectory().appendingPathComponent("missing", isDirectory: true)
        let store = DraftStore(directory: directory)
        let original = store.draft
        XCTAssertFalse(store.save("저장 실패시 남길 이야기"))
        XCTAssertEqual(store.draft, original)
        XCTAssertTrue(store.notice.contains("저장하지 못했어요"))
    }

    func testUTF16LimitPreservesWholeEmojiForWebImport() throws {
        let directory = try temporaryDirectory()
        let store = DraftStore(directory: directory)
        let caption = String(repeating: "가", count: 2199) + "👨‍👩‍👧‍👦"
        XCTAssertTrue(store.save(caption))
        XCTAssertEqual(store.draft.caption, String(repeating: "가", count: 2199))
        XCTAssertLessThanOrEqual(store.draft.caption.utf16.count, 2200)
        XCTAssertEqual(DraftStore(directory: directory).draft, store.draft)
    }
}

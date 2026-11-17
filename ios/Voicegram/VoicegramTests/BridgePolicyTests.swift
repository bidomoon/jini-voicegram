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

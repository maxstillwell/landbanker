import Foundation
struct BridgeMessage {
    let version: Int
    let type: String
    let requestId: String?
    let payload: [String: Any]
    init?(_ body: Any) {
        guard let data = body as? [String: Any], data["version"] as? Int == 1,
              let type = data["type"] as? String, let payload = data["payload"] as? [String: Any] else { return nil }
        self.version = 1; self.type = type; self.requestId = data["requestId"] as? String; self.payload = payload
    }
}
struct WebConfiguration {
    let url: URL
    init?() {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "LAND_BANKER_WEB_URL") as? String,
              let url = URL(string: value), url.scheme == "https", let host = url.host,
              !host.hasSuffix("maxqi.com"), !host.hasSuffix(".invalid") else { return nil }
        self.url = url
    }
    func permits(_ url: URL) -> Bool { url.scheme == self.url.scheme && url.host == self.url.host && url.port == self.url.port }
}

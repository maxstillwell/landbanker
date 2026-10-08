import SwiftUI
import WebKit
import CoreLocation
import PhotosUI
import Network
import ImageIO
import UIKit

struct FieldWebView: UIViewRepresentable {
    @Binding var isReady: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(onReady: { isReady = true })
    }
    func makeUIView(context: Context) -> UIView {
        guard let configuration = WebConfiguration() else {
            let label = UILabel(); label.text = "LandOS preview URL is not configured.\nSet LAND_BANKER_WEB_URL when building."; label.numberOfLines = 0; label.textAlignment = .center
            label.textColor = UIColor(red: 11 / 255, green: 48 / 255, blue: 45 / 255, alpha: 1)
            label.backgroundColor = UIColor(red: 244 / 255, green: 243 / 255, blue: 233 / 255, alpha: 1)
            DispatchQueue.main.async { isReady = true }
            return label
        }
        let preferences = WKWebViewConfiguration()
        preferences.applicationNameForUserAgent = "LandOS/0.1"
        preferences.websiteDataStore = .default() // Persistent cookies/IndexedDB across relaunch.
        preferences.userContentController.add(context.coordinator, name: "landBanker")
        let web = WKWebView(frame: .zero, configuration: preferences)
        web.navigationDelegate = context.coordinator
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.isOpaque = false; web.backgroundColor = UIColor(red: 0.97, green: 0.97, blue: 0.94, alpha: 1)
        context.coordinator.attach(web, configuration: configuration)
        web.load(URLRequest(url: configuration.url))
        return web
    }
    func updateUIView(_ uiView: UIView, context: Context) {}
    static func dismantleUIView(_ uiView: UIView, coordinator: Coordinator) {
        if let web = uiView as? WKWebView { web.configuration.userContentController.removeScriptMessageHandler(forName: "landBanker") }
        coordinator.stop()
    }
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, CLLocationManagerDelegate, UIImagePickerControllerDelegate, UINavigationControllerDelegate, PHPickerViewControllerDelegate {
        weak var web: WKWebView?
        var configuration: WebConfiguration?
        let locationManager = CLLocationManager()
        let network = NWPathMonitor()
        let networkQueue = DispatchQueue(label: "landbanker.network")
        var following = false
        var pendingLocation = false
        var requestId: String?
        var photoObservationId: String?
        var photoCount = 0
        var photoFailures = 0
        var observers: [NSObjectProtocol] = []
        let onReady: () -> Void
        var hasFinishedInitialLoad = false

        init(onReady: @escaping () -> Void) {
            self.onReady = onReady
        }
        func finishInitialPresentation() {
            guard !hasFinishedInitialLoad else { return }
            hasFinishedInitialLoad = true
            onReady()
        }
        func attach(_ web: WKWebView, configuration: WebConfiguration) {
            self.web = web; self.configuration = configuration
            locationManager.delegate = self; locationManager.desiredAccuracy = kCLLocationAccuracyBest
            network.pathUpdateHandler = { [weak self] path in DispatchQueue.main.async { self?.emit("networkStatusChanged", ["online": path.status == .satisfied]) } }
            network.start(queue: networkQueue)
            observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
                self?.emit("appBecameActive", [:]); if self?.following == true { self?.locationManager.startUpdatingLocation() }
            })
            observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
                self?.emit("appBecameInactive", [:]); self?.locationManager.stopUpdatingLocation()
            })
        }
        func stop() { locationManager.stopUpdatingLocation(); network.cancel(); observers.forEach { NotificationCenter.default.removeObserver($0) }; observers.removeAll() }
        func emit(_ type: String, _ payload: [String: Any]) {
            guard let web = web, let url = web.url, configuration?.permits(url) == true else { return }
            let message: [String: Any] = ["version": 1, "type": type, "requestId": requestId ?? "", "payload": payload]
            // Structured arguments prevent string/JavaScript interpolation injection.
            web.callAsyncJavaScript("window.LandBankerBridge?.receive(message)", arguments: ["message": message], in: nil, in: .page) { _ in }
        }
        func fail(_ message: String) { emit("nativeError", ["message": message]) }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            emit("nativeReady", ["platform": "ios", "bridgeVersion": 1])
            emit("networkStatusChanged", ["online": network.currentPath.status == .satisfied])
            finishInitialPresentation()
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finishInitialPresentation() }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { finishInitialPresentation() }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url, configuration?.permits(url) == true else { decisionHandler(.cancel); return }
            decisionHandler(.allow)
        }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, let expected = configuration?.url,
                  message.frameInfo.securityOrigin.host == expected.host,
                  message.frameInfo.securityOrigin.protocol == "https",
                  (message.frameInfo.securityOrigin.port == (expected.port ?? 443) || (expected.port == nil && message.frameInfo.securityOrigin.port == 0)),
                  let current = web?.url, configuration?.permits(current) == true,
                  let command = BridgeMessage(message.body) else { return }
            requestId = command.requestId
            switch command.type {
            case "requestCurrentLocation": following = false; pendingLocation = true; requestLocation()
            case "startLocationFollow": following = true; pendingLocation = true; requestLocation()
            case "stopLocationFollow": following = false; pendingLocation = false; locationManager.stopUpdatingLocation()
            case "openCamera": if beginPhotos(command.payload) { openCamera() }
            case "openPhotoLibrary": if beginPhotos(command.payload) { openLibrary() }
            case "hapticFeedback": UIImpactFeedbackGenerator(style: .light).impactOccurred(); emit("nativeReady", ["platform": "ios", "bridgeVersion": 1])
            case "openExternalNavigation":
                if let latitude = command.payload["latitude"] as? Double, let longitude = command.payload["longitude"] as? Double,
                   (-90...90).contains(latitude), (-180...180).contains(longitude), let url = URL(string: "https://maps.apple.com/?daddr=\(latitude),\(longitude)") { UIApplication.shared.open(url) }
            case "openShareSheet":
                if let value = command.payload["url"] as? String, let url = URL(string: value), configuration?.permits(url) == true {
                    let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                    present(sheet)
                }
            default: fail("Unsupported bridge command")
            }
        }
        func requestLocation() {
            switch locationManager.authorizationStatus {
            case .notDetermined: locationManager.requestWhenInUseAuthorization()
            case .authorizedWhenInUse, .authorizedAlways:
                if following { locationManager.startUpdatingLocation() } else { locationManager.requestLocation() }
            default: pendingLocation = false; emit("locationPermissionChanged", ["status": "denied"])
            }
        }
        func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
            let status = manager.authorizationStatus
            emit("locationPermissionChanged", ["status": status == .authorizedWhenInUse || status == .authorizedAlways ? "granted" : status == .notDetermined ? "prompt" : "denied"])
            if pendingLocation && (status == .authorizedWhenInUse || status == .authorizedAlways) { pendingLocation = false; requestLocation() }
        }
        func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
            guard let location = locations.last, location.horizontalAccuracy >= 0 else { return }
            emit("locationUpdated", ["latitude": location.coordinate.latitude, "longitude": location.coordinate.longitude, "accuracy": location.horizontalAccuracy, "timestamp": location.timestamp.timeIntervalSince1970 * 1000])
        }
        func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { fail(error.localizedDescription) }
        func present(_ controller: UIViewController) {
            guard let root = web?.window?.rootViewController else { fail("Photo picker unavailable"); finishPhotos(); return }
            var presenter = root
            while let presented = presenter.presentedViewController { presenter = presented }
            if let popover = controller.popoverPresentationController { popover.sourceView = web; popover.sourceRect = CGRect(x: 20, y: 20, width: 1, height: 1) }
            presenter.present(controller, animated: true)
        }
        func beginPhotos(_ payload: [String: Any]) -> Bool {
            guard photoObservationId == nil, let id = payload["observationId"] as? String, UUID(uuidString: id) != nil else { fail("Finish the current photo selection first"); return false }
            photoObservationId = id; photoCount = 0; photoFailures = 0
            emit("photoSelectionStarted", ["observationId": id, "count": 0])
            return true
        }
        func finishPhotos() {
            guard let id = photoObservationId else { return }
            emit("photoSelectionFinished", ["observationId": id, "count": photoCount, "failed": photoFailures])
            photoObservationId = nil
        }
        func openCamera() {
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else { fail("Camera unavailable on this device or Simulator"); finishPhotos(); return }
            let picker = UIImagePickerController(); picker.sourceType = .camera; picker.delegate = self; present(picker)
        }
        func openLibrary() {
            var config = PHPickerConfiguration(photoLibrary: .shared()); config.filter = .images; config.selectionLimit = 10
            config.preferredAssetRepresentationMode = .current
            let picker = PHPickerViewController(configuration: config); picker.delegate = self; present(picker)
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { picker.dismiss(animated: true); finishPhotos() }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            picker.dismiss(animated: true)
            photoCount = 1
            emit("photoSelectionStarted", ["observationId": photoObservationId ?? "", "count": 1])
            guard let image = info[.originalImage] as? UIImage else { photoFailures = 1; fail("No camera image"); finishPhotos(); return }
            var payload: [String: Any] = ["capturedAt": ISO8601DateFormatter().string(from: Date())]
            if let location = locationManager.location, abs(location.timestamp.timeIntervalSinceNow) < 60 { payload["latitude"] = location.coordinate.latitude; payload["longitude"] = location.coordinate.longitude }
            sendImage(image, metadata: payload)
            finishPhotos()
        }
        func sendImage(_ image: UIImage, metadata: [String: Any]) {
            // Bound JPEG transfer size before crossing WebKit; all bytes enter durable web IndexedDB.
            let ratio = min(1, 2400 / max(image.size.width, image.size.height))
            let size = CGSize(width: image.size.width * ratio, height: image.size.height * ratio)
            let format = UIGraphicsImageRendererFormat(); format.scale = 1
            let renderer = UIGraphicsImageRenderer(size: size, format: format)
            let resized = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
            guard let data = resized.jpegData(compressionQuality: 0.85), data.count <= 25 * 1024 * 1024 else { photoFailures += 1; fail("Photo exceeds upload limit"); return }
            var payload = metadata; payload["observationId"] = photoObservationId; payload["base64"] = data.base64EncodedString(); payload["mimeType"] = "image/jpeg"; payload["filename"] = "field-\(UUID().uuidString).jpg"
            emit("photoSelected", payload)
        }
        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)
            photoCount = results.count
            emit("photoSelectionStarted", ["observationId": photoObservationId ?? "", "count": photoCount])
            importPhoto(results, at: 0)
        }
        func importPhoto(_ results: [PHPickerResult], at index: Int) {
            guard index < results.count else { finishPhotos(); return }
                let provider = results[index].itemProvider
                let type = provider.registeredTypeIdentifiers.first(where: { $0.contains("image") || $0.contains("jpeg") || $0.contains("png") || $0.contains("heic") }) ?? "public.image"
                provider.loadDataRepresentation(forTypeIdentifier: type) { [weak self] data, error in
                    guard let data = data, let image = UIImage(data: data) else { DispatchQueue.main.async { self?.photoFailures += 1; self?.fail(error?.localizedDescription ?? "Unable to read photo"); self?.importPhoto(results, at: index + 1) }; return }
                    var metadata: [String: Any] = [:]
                    if let source = CGImageSourceCreateWithData(data as CFData, nil), let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any] {
                        if let exif = properties[kCGImagePropertyExifDictionary as String] as? [String: Any], let date = exif[kCGImagePropertyExifDateTimeOriginal as String] as? String {
                            let format = DateFormatter(); format.locale = Locale(identifier: "en_US_POSIX"); format.dateFormat = "yyyy:MM:dd HH:mm:ss"
                            if let captured = format.date(from: date) { metadata["capturedAt"] = ISO8601DateFormatter().string(from: captured) }
                        }
                        if let gps = properties[kCGImagePropertyGPSDictionary as String] as? [String: Any], let lat = gps[kCGImagePropertyGPSLatitude as String] as? Double, let lng = gps[kCGImagePropertyGPSLongitude as String] as? Double {
                            metadata["latitude"] = gps[kCGImagePropertyGPSLatitudeRef as String] as? String == "S" ? -lat : lat
                            metadata["longitude"] = gps[kCGImagePropertyGPSLongitudeRef as String] as? String == "W" ? -lng : lng
                        }
                    }
                    DispatchQueue.main.async { self?.sendImage(image, metadata: metadata); self?.importPhoto(results, at: index + 1) }
                }
        }
    }
}

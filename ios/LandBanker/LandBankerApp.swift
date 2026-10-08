import SwiftUI

@main
struct LandBankerApp: App {
    @State private var webReady = false

    var body: some Scene {
        WindowGroup {
            ZStack {
                FieldWebView(isReady: $webReady)
                    .ignoresSafeArea(edges: .bottom)
                if !webReady {
                    LandOSLaunchView()
                        .transition(.opacity)
                        .zIndex(1)
                }
            }
            .animation(.easeOut(duration: 0.28), value: webReady)
        }
    }
}

import SwiftUI

struct LandOSLaunchView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        ZStack {
            Color(red: 8 / 255, green: 15 / 255, blue: 25 / 255)
                .ignoresSafeArea()
            LinearGradient(
                colors: [Color.clear, Color(red: 26 / 255, green: 34 / 255, blue: 39 / 255)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 24) {
                Image("LandOSMark")
                    .resizable()
                    .interpolation(.high)
                    .antialiased(true)
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .frame(width: 112, height: 112)
                    .scaleEffect(appeared || reduceMotion ? 1 : 0.94)
                    .opacity(appeared || reduceMotion ? 1 : 0)
                Text("LandOS")
                    .font(.system(size: 38, weight: .bold, design: .rounded))
                    .tracking(-1)
                    .foregroundStyle(Color(red: 244 / 255, green: 243 / 255, blue: 233 / 255))
                Text("MAP · ANALYSE · MANAGE LAND")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(2.1)
                    .foregroundStyle(Color(red: 212 / 255, green: 252 / 255, blue: 52 / 255))
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("LandOS. Map, analyse and manage land.")
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeOut(duration: 0.45)) { appeared = true }
        }
    }
}

import SwiftUI

struct LandOSLaunchView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        ZStack {
            Color(red: 11 / 255, green: 48 / 255, blue: 45 / 255)
                .ignoresSafeArea()
            LinearGradient(
                colors: [Color.clear, Color(red: 18 / 255, green: 62 / 255, blue: 57 / 255)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 24) {
                LandOSMark()
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
                    .foregroundStyle(Color(red: 168 / 255, green: 203 / 255, blue: 113 / 255))
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

private struct LandOSMark: View {
    var body: some View {
        Canvas { context, size in
            let sx = size.width / 64
            let sy = size.height / 64
            func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x * sx, y: y * sy)
            }

            var tile = Path()
            tile.move(to: point(12, 4))
            tile.addLine(to: point(52, 4))
            tile.addLine(to: point(60, 12))
            tile.addLine(to: point(60, 52))
            tile.addLine(to: point(52, 60))
            tile.addLine(to: point(12, 60))
            tile.addLine(to: point(4, 52))
            tile.addLine(to: point(4, 12))
            tile.closeSubpath()
            context.fill(tile, with: .color(Color(red: 18 / 255, green: 62 / 255, blue: 57 / 255)))

            var parcel = Path()
            parcel.move(to: point(17, 43))
            parcel.addLine(to: point(22, 20))
            parcel.addLine(to: point(42, 15))
            parcel.addLine(to: point(49, 28))
            parcel.addLine(to: point(43, 47))
            parcel.addLine(to: point(24, 49))
            parcel.closeSubpath()
            context.stroke(parcel, with: .color(Color(red: 244 / 255, green: 243 / 255, blue: 233 / 255)), style: StrokeStyle(lineWidth: 4 * sx, lineCap: .round, lineJoin: .round))

            var axes = Path()
            axes.move(to: point(22, 20))
            axes.addLine(to: point(43, 47))
            axes.move(to: point(17, 43))
            axes.addLine(to: point(49, 28))
            context.stroke(axes, with: .color(Color(red: 168 / 255, green: 203 / 255, blue: 113 / 255)), style: StrokeStyle(lineWidth: 4 * sx, lineCap: .round))

            let dot = Path(ellipseIn: CGRect(x: 38.5 * sx, y: 42.5 * sy, width: 9 * sx, height: 9 * sy))
            context.fill(dot, with: .color(Color(red: 226 / 255, green: 154 / 255, blue: 85 / 255)))
        }
    }
}

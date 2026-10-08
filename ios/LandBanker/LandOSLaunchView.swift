import SwiftUI

struct LandOSLaunchView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        ZStack {
            Color(red: 10 / 255, green: 15 / 255, blue: 29 / 255)
                .ignoresSafeArea()
            LinearGradient(
                colors: [Color.clear, Color(red: 26 / 255, green: 37 / 255, blue: 59 / 255)],
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

private struct LandOSMark: View {
    var body: some View {
        Canvas { context, size in
            let sx = size.width / 64
            let sy = size.height / 64
            func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x * sx, y: y * sy)
            }

            func diamond(topY: CGFloat, halfWidth: CGFloat, halfHeight: CGFloat) -> Path {
                var path = Path()
                path.move(to: point(32, topY))
                path.addLine(to: point(32 + halfWidth, topY + halfHeight))
                path.addLine(to: point(32, topY + halfHeight * 2))
                path.addLine(to: point(32 - halfWidth, topY + halfHeight))
                path.closeSubpath()
                return path
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
            context.fill(tile, with: .color(Color(red: 18 / 255, green: 26 / 255, blue: 44 / 255)))

            let bottom = diamond(topY: 34, halfWidth: 21, halfHeight: 10)
            context.fill(bottom, with: .color(Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255).opacity(0.22)))
            context.stroke(bottom, with: .color(Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255).opacity(0.75)), lineWidth: 1.3 * sx)

            let middle = diamond(topY: 27, halfWidth: 21, halfHeight: 10)
            context.fill(middle, with: .color(Color(red: 16 / 255, green: 185 / 255, blue: 129 / 255).opacity(0.28)))
            context.stroke(middle, with: .color(Color(red: 16 / 255, green: 185 / 255, blue: 129 / 255)), lineWidth: 1.5 * sx)

            let top = diamond(topY: 19, halfWidth: 21, halfHeight: 10)
            context.fill(top, with: .color(Color(red: 24 / 255, green: 37 / 255, blue: 58 / 255)))
            context.stroke(top, with: .color(Color(red: 163 / 255, green: 230 / 255, blue: 53 / 255)), lineWidth: 2 * sx)

            let active = diamond(topY: 19, halfWidth: 10, halfHeight: 5)
            context.fill(active, with: .color(Color(red: 212 / 255, green: 252 / 255, blue: 52 / 255)))

            var stem = Path()
            stem.move(to: point(32, 19))
            stem.addLine(to: point(32, 13))
            context.stroke(stem, with: .color(Color(red: 212 / 255, green: 252 / 255, blue: 52 / 255)), style: StrokeStyle(lineWidth: 1.5 * sx, dash: [2 * sx, 2 * sx]))
            let node = Path(ellipseIn: CGRect(x: 29 * sx, y: 9 * sy, width: 6 * sx, height: 6 * sy))
            context.fill(node, with: .color(Color(red: 212 / 255, green: 252 / 255, blue: 52 / 255)))
        }
    }
}

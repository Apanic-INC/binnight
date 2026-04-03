import WidgetKit
import SwiftUI

// Data shared from the app via App Group
struct BinData {
    let showWidget: Bool
    let binTypes: [String]
    let collectionDay: String
    let binsAreOut: Bool

    static func load() -> BinData {
        let defaults = UserDefaults(suiteName: "group.com.apanic.binnight")
        return BinData(
            showWidget: defaults?.bool(forKey: "showWidget") ?? false,
            binTypes: (defaults?.string(forKey: "binTypes") ?? "").split(separator: ",").map(String.init),
            collectionDay: defaults?.string(forKey: "collectionDay") ?? "",
            binsAreOut: defaults?.bool(forKey: "binsAreOut") ?? false
        )
    }
}

// Bin display info
struct BinInfo {
    let label: String
    let color: Color
}

let binDisplayMap: [String: BinInfo] = [
    "fogo": BinInfo(label: "Organics", color: Color(red: 0.545, green: 0.765, blue: 0.290)),
    "rubbish": BinInfo(label: "General", color: Color(red: 0.898, green: 0.224, blue: 0.208)),
    "recycling": BinInfo(label: "Recycling", color: Color(red: 0.949, green: 0.788, blue: 0.298)),
    "glass": BinInfo(label: "Glass", color: Color(red: 0.612, green: 0.153, blue: 0.690))
]

let darkGreen = Color(red: 0.106, green: 0.239, blue: 0.184)

// Timeline Provider
struct BinNightProvider: TimelineProvider {
    func placeholder(in context: Context) -> BinNightEntry {
        BinNightEntry(date: Date(), showWidget: true, binTypes: ["fogo", "rubbish"], collectionDay: "Tomorrow", binsAreOut: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (BinNightEntry) -> Void) {
        let data = BinData.load()
        let entry = BinNightEntry(date: Date(), showWidget: data.showWidget, binTypes: data.binTypes, collectionDay: data.collectionDay, binsAreOut: data.binsAreOut)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BinNightEntry>) -> Void) {
        let data = BinData.load()
        let entry = BinNightEntry(date: Date(), showWidget: data.showWidget, binTypes: data.binTypes, collectionDay: data.collectionDay, binsAreOut: data.binsAreOut)

        // Refresh every 30 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// Timeline Entry
struct BinNightEntry: TimelineEntry {
    let date: Date
    let showWidget: Bool
    let binTypes: [String]
    let collectionDay: String
    let binsAreOut: Bool
}

// Small Widget View
struct SmallWidgetView: View {
    let entry: BinNightEntry

    var body: some View {
        ZStack {
            darkGreen

            if !entry.showWidget || entry.binsAreOut {
                VStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(Color(red: 0.545, green: 0.765, blue: 0.290))
                    Text("All good")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else {
                VStack(spacing: 8) {
                    Text(entry.collectionDay)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(Color(red: 0.949, green: 0.788, blue: 0.298))

                    Image(systemName: "trash")
                        .font(.system(size: 32))
                        .foregroundColor(.white)

                    HStack(spacing: 6) {
                        ForEach(entry.binTypes, id: \.self) { bin in
                            if let info = binDisplayMap[bin] {
                                Circle()
                                    .fill(info.color)
                                    .frame(width: 16, height: 16)
                            }
                        }
                    }
                }
            }
        }
    }
}

// Medium Widget View
struct MediumWidgetView: View {
    let entry: BinNightEntry

    var body: some View {
        ZStack {
            darkGreen

            if !entry.showWidget || entry.binsAreOut {
                HStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(Color(red: 0.545, green: 0.765, blue: 0.290))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Bin Night")
                            .font(.headline)
                            .foregroundColor(.white)
                        Text("No bins to put out")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
                .padding()
            } else {
                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(entry.collectionDay)
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .foregroundColor(Color(red: 0.949, green: 0.788, blue: 0.298))
                        Text("Bin Night")
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        Image(systemName: "trash")
                            .font(.system(size: 24))
                            .foregroundColor(.white.opacity(0.7))
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 6) {
                        ForEach(entry.binTypes, id: \.self) { bin in
                            if let info = binDisplayMap[bin] {
                                HStack(spacing: 8) {
                                    Text(info.label)
                                        .font(.caption)
                                        .foregroundColor(.white)
                                    Circle()
                                        .fill(info.color)
                                        .frame(width: 14, height: 14)
                                }
                            }
                        }
                    }
                }
                .padding()
            }
        }
    }
}

// Widget Definition
struct BinNightWidget: Widget {
    let kind: String = "BinNightWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BinNightProvider()) { entry in
            Group {
                if entry.date == entry.date { // always true, just to satisfy type
                    if WidgetFamily.systemSmall == .systemSmall {
                        SmallWidgetView(entry: entry)
                    }
                }
            }
        }
        .configurationDisplayName("Bin Night")
        .description("See which bins to put out tonight")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct BinNightWidgetBundle: WidgetBundle {
    var body: some Widget {
        BinNightWidget()
    }
}

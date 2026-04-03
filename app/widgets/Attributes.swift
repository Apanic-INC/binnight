import ActivityKit

// Required by react-native-widget-extension but we don't use Live Activities
struct BinNightAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var binTypes: String
        var collectionDay: String
    }

    var name: String
}

// Generates src/data/layout-hu-mac.json from the macOS "Hungarian" input source.
// Run: swiftc -O scripts/gen-layout.swift -o /tmp/gen-layout && /tmp/gen-layout > src/data/layout-hu-mac.json
import Carbon
import Foundation

let filter = [kTISPropertyInputSourceID as String: "com.apple.keylayout.Hungarian"] as CFDictionary
guard let list = TISCreateInputSourceList(filter, true)?.takeRetainedValue() as? [TISInputSource],
      let src = list.first,
      let ptr = TISGetInputSourceProperty(src, kTISPropertyUnicodeKeyLayoutData) else {
    FileHandle.standardError.write("Hungarian layout not found\n".data(using: .utf8)!)
    exit(1)
}
let data = Unmanaged<CFData>.fromOpaque(ptr).takeUnretainedValue() as Data
let kbType = UInt32(LMGetKbdType())

struct Entry: Codable { let keyCode: Int; let shift: Bool; let option: Bool }
var map: [String: Entry] = [:]
// fewest modifiers wins: none < shift < option < shift+option
let combos: [(Bool, Bool)] = [(false, false), (true, false), (false, true), (true, true)]
let skip: Set<Int> = [36, 48, 49]  // return, tab, space

data.withUnsafeBytes { raw in
    let layout = raw.baseAddress!.assumingMemoryBound(to: UCKeyboardLayout.self)
    for (shift, option) in combos {
        var mods: UInt32 = 0
        if shift { mods |= UInt32(shiftKey >> 8) }
        if option { mods |= UInt32(optionKey >> 8) }
        for code in 0...50 where !skip.contains(code) {
            var dead: UInt32 = 0
            var len = 0
            var chars = [UniChar](repeating: 0, count: 4)
            // dead-key aware pass: a dead key produces no character in the browser ("Dead")
            let r = UCKeyTranslate(layout, UInt16(code), UInt16(kUCKeyActionDown), mods, kbType,
                                   0, &dead, 4, &len, &chars)
            guard r == noErr, dead == 0, len == 1 else { continue }
            let s = String(utf16CodeUnits: chars, count: len)
            guard let u = s.unicodeScalars.first, u.value > 32, u.value != 127 else { continue }
            if map[s] == nil { map[s] = Entry(keyCode: code, shift: shift, option: option) }
        }
    }
}
let enc = JSONEncoder()
enc.outputFormatting = [.prettyPrinted, .sortedKeys]
print(String(data: try enc.encode(map), encoding: .utf8)!)

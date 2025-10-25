import Foundation
import React

@objc(SpeechModule)
class SpeechModule: NSObject, RCTBridgeModule {
  static func moduleName() -> String! { "SpeechModule" }
  static func requiresMainQueueSetup() -> Bool { true }
}

import Foundation
import React

@objc(SpeechModule)
class SpeechModule: RCTEventEmitter {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func supportedEvents() -> [String]! {
    []
  }

  @objc
  func startTranscribing(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(nil)
  }

  @objc
  func stopTranscribing(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(nil)
  }

  @objc
  func cancelTranscribing(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(nil)
  }

  @objc
  func getPermissionStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve("unavailable")
  }

  @objc
  func requestPermission(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve("unavailable")
  }
}

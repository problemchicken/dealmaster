import Foundation
import Speech
import AVFoundation
import React

@objc(SpeechModule)
class SpeechModule: RCTEventEmitter {
  private let audioEngine = AVAudioEngine()
  private var speechRecognizer: SFSpeechRecognizer?
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var lastTranscription: String = ""
  private var currentLocaleIdentifier: String?
  private var isTranscribing: Bool = false
  private var sessionStartDate: Date?

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["stt.onResult"]
  }

  private func resetSession() {
    recognitionTask?.cancel()
    recognitionTask = nil
    recognitionRequest = nil
    if audioEngine.isRunning {
      audioEngine.stop()
      audioEngine.inputNode.removeTap(onBus: 0)
    }
    try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    isTranscribing = false
    sessionStartDate = nil
  }

  private func permissionDenied(message: String) {
    sendEvent(withName: "stt.onResult", body: [
      "type": "permission_denied",
      "message": message,
    ])
  }

  private func emitError(code: String, message: String) {
    sendEvent(withName: "stt.onResult", body: [
      "type": "error",
      "errorCode": code,
      "message": message,
    ])
  }

  private func emitResult(text: String, isFinal: Bool) {
    var payload: [String: Any] = [
      "type": "result",
      "text": text,
      "isFinal": isFinal,
      "locale": currentLocaleIdentifier ?? Locale.current.identifier,
    ]
    if isFinal, let start = sessionStartDate {
      let duration = Date().timeIntervalSince(start)
      payload["durationMs"] = Int(duration * 1000)
    }
    sendEvent(withName: "stt.onResult", body: payload)
  }

  private func requestSpeechPermission(_ completion: @escaping (Bool) -> Void) {
    SFSpeechRecognizer.requestAuthorization { status in
      completion(status == .authorized)
    }
  }

  private func requestMicrophonePermission(_ completion: @escaping (Bool) -> Void) {
    AVAudioSession.sharedInstance().requestRecordPermission { granted in
      completion(granted)
    }
  }

  private func ensurePermissions(_ completion: @escaping (Bool) -> Void) {
    let speechStatus = SFSpeechRecognizer.authorizationStatus()
    if speechStatus == .authorized {
      requestMicrophonePermission(completion)
      return
    }

    requestSpeechPermission { [weak self] granted in
      guard granted else {
        self?.permissionDenied(message: "Speech recognition permission denied")
        completion(false)
        return
      }
      self?.requestMicrophonePermission { grantedMic in
        if !grantedMic {
          self?.permissionDenied(message: "Microphone access denied")
        }
        completion(grantedMic)
      }
    }
  }

  private func configureAudioSession() throws {
    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.record, mode: .measurement, options: [.duckOthers, .allowBluetooth])
    try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
  }

  private func startRecognition(localeIdentifier: String?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    var identifier = localeIdentifier
    if identifier == nil || identifier?.isEmpty == true {
      identifier = Locale.current.identifier
    }

    guard let localeId = identifier else {
      reject("E_LOCALE", "Unable to determine locale", nil)
      return
    }

    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeId)) else {
      reject("E_RECOGNIZER", "Speech recognition not available for locale", nil)
      return
    }

    if !recognizer.isAvailable {
      reject("E_UNAVAILABLE", "Speech recognizer currently unavailable", nil)
      return
    }

    speechRecognizer = recognizer
    currentLocaleIdentifier = recognizer.locale.identifier

    recognitionTask?.cancel()
    recognitionTask = nil

    recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
    guard let recognitionRequest = recognitionRequest else {
      reject("E_REQUEST", "Unable to create recognition request", nil)
      return
    }

    recognitionRequest.shouldReportPartialResults = true
    if #available(iOS 13, *) {
      recognitionRequest.requiresOnDeviceRecognition = false
    }

    do {
      try configureAudioSession()
    } catch {
      reject("E_AUDIO_SESSION", "Failed to configure audio session", error)
      return
    }

    let inputNode = audioEngine.inputNode
    let recordingFormat = inputNode.outputFormat(forBus: 0)
    inputNode.removeTap(onBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, when in
      self?.recognitionRequest?.append(buffer)
    }

    audioEngine.prepare()

    do {
      try audioEngine.start()
    } catch {
      reject("E_AUDIO_START", "Audio engine failed to start", error)
      return
    }

    sessionStartDate = Date()
    isTranscribing = true
    lastTranscription = ""

    recognitionTask = recognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
      guard let self = self else { return }
      if let result = result {
        self.lastTranscription = result.bestTranscription.formattedString
        self.emitResult(text: self.lastTranscription, isFinal: result.isFinal)
        if result.isFinal {
          self.resetSession()
        }
      }

      if let error = error {
        self.emitError(code: "E_RECOGNITION", message: error.localizedDescription)
        self.resetSession()
      }
    }

    resolve(recognizer.locale.identifier)
  }

  @objc(startTranscribing:resolver:rejecter:)
  func startTranscribing(_ localeIdentifier: String?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      if self.isTranscribing {
        self.resetSession()
      }

      self.ensurePermissions { granted in
        DispatchQueue.main.async {
          guard granted else {
            self.emitError(code: "E_PERMISSION", message: "Required permissions not granted")
            reject("E_PERMISSION", "Required permissions not granted", nil)
            return
          }
          self.startRecognition(localeIdentifier: localeIdentifier, resolve: resolve, reject: reject)
        }
      }
    }
  }

  @objc(stopTranscribing:rejecter:)
  func stopTranscribing(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      if !self.isTranscribing {
        resolve(self.lastTranscription)
        return
      }

      self.recognitionRequest?.endAudio()
      self.resetSession()
      resolve(self.lastTranscription)
    }
  }
}

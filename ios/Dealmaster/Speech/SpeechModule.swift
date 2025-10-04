import Foundation
import Speech
import AVFoundation
import React

@objc(SpeechModule)
class SpeechModule: RCTEventEmitter {
  private let audioEngine = AVAudioEngine()
  private var speechRecognizer: SFSpeechRecognizer? =
    SFSpeechRecognizer(locale: Locale.autoupdatingCurrent)
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var lastTranscription: String?
  private var resolve: RCTPromiseResolveBlock?
  private var reject: RCTPromiseRejectBlock?
  private var sessionStartDate: Date?
  private var isUserInitiatedStop = false
  private var isUserInitiatedCancel = false
  private var isFinishing = false

  deinit {
    resetSession()
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return [
      "stt_partial",
      "stt_final",
      "stt_error",
      "stt_permission_denied"
    ]
  }

  private func resetSession() {
    recognitionTask?.cancel()
    recognitionTask = nil
    recognitionRequest?.endAudio()
    recognitionRequest = nil

    if audioEngine.isRunning {
      audioEngine.stop()
      audioEngine.inputNode.removeTap(onBus: 0)
      audioEngine.reset()
    }

    resolve = nil
    reject = nil
    lastTranscription = nil
    sessionStartDate = nil
    isUserInitiatedStop = false
    isUserInitiatedCancel = false
    isFinishing = false
  }

  private func emitTelemetry(event: String, payload: [String: Any]) {
    sendEvent(withName: event, body: payload)
  }

  private func emitPermissionDenied() {
    emitTelemetry(event: "stt_permission_denied", payload: [:])
  }

  private func emitPartialTranscription(_ transcription: String, isFinal: Bool) {
    guard !transcription.isEmpty else { return }

    let duration = sessionStartDate.map { Date().timeIntervalSince($0) } ?? 0
    let payload: [String: Any] = [
      "text": transcription,
      "isFinal": isFinal,
      "duration": duration,
      "chars": transcription.count
    ]

    if isFinal {
      emitTelemetry(event: "stt_final", payload: payload)
    } else {
      emitTelemetry(event: "stt_partial", payload: payload)
    }
  }

  private func emitSttFinalIfNeeded(_ transcription: String) {
    guard !transcription.isEmpty else { return }
    emitPartialTranscription(transcription, isFinal: true)
  }

  private func emitError(message: String?, errorCode: String) {
    var payload: [String: Any] = [
      "error_code": errorCode
    ]

    if let message, !message.isEmpty {
      payload["message"] = message
    }

    emitTelemetry(event: "stt_error", payload: payload)
  }

  private func normalizedErrorCode(for error: NSError) -> String {
    if error.domain == NSURLErrorDomain {
      return "network_failure"
    }

    if error.domain == SFSpeechRecognitionErrorDomain,
       let speechError = SFSpeechErrorCode(rawValue: error.code) {
      switch speechError {
      case .notAuthorized:
        return "permission_denied"
      case .noSpeech:
        return "no_speech_detected"
      case .canceled:
        return "timeout"
      case .notAvailable, .unsupportedLocale:
        return "native_module_unavailable"
      default:
        return "transient_native_failure"
      }
    }

    return "transient_native_failure"
  }

  private func emitError(_ error: NSError) {
    let code = normalizedErrorCode(for: error)
    emitError(message: error.localizedDescription, errorCode: code)
  }

  private func emitSetupError(message: String, code: String) {
    emitError(message: message, errorCode: code)
  }

  private func isRecognizerAvailable() -> Bool {
    guard let recognizer = speechRecognizer else { return false }
    return recognizer.isAvailable
  }

  private func permissionStatus(
    speech status: SFSpeechRecognizerAuthorizationStatus,
    micPermission: AVAudioSession.RecordPermission
  ) -> String {
    switch (status, micPermission) {
    case (.authorized, .granted):
      return "granted"
    case (.denied, _), (.restricted, _), (_, .denied):
      return "blocked"
    default:
      return "denied"
    }
  }

  private func currentPermissionStatus() -> String {
    guard isRecognizerAvailable() else {
      return "unavailable"
    }
    let speechStatus = SFSpeechRecognizer.authorizationStatus()
    let micStatus = AVAudioSession.sharedInstance().recordPermission
    return permissionStatus(speech: speechStatus, micPermission: micStatus)
  }

  @objc
  func startTranscribing(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    isUserInitiatedStop = false
    isUserInitiatedCancel = false
    isFinishing = false
    lastTranscription = nil

    if speechRecognizer == nil {
      speechRecognizer = SFSpeechRecognizer(locale: Locale.autoupdatingCurrent)
    }

    guard let recognizer = speechRecognizer, recognizer.isAvailable else {
      emitSetupError(message: "Speech recognizer is unavailable", code: "native_module_unavailable")
      DispatchQueue.main.async {
        reject("stt_error", "Speech recognizer is unavailable", nil)
        self.resetSession()
      }
      return
    }

    SFSpeechRecognizer.requestAuthorization { [weak self] authStatus in
      guard let self else { return }

      if authStatus != .authorized {
        DispatchQueue.main.async {
          self.emitPermissionDenied()
          reject("stt_error", "Speech recognition permission denied", nil)
          self.resetSession()
        }
        return
      }

      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        DispatchQueue.main.async {
          guard granted else {
            self.emitPermissionDenied()
            reject("stt_error", "Microphone permission denied", nil)
            self.resetSession()
            return
          }
          do {
            self.sessionStartDate = Date()
            try self.startRecording(with: recognizer)
            resolve(true)
          } catch {
            let nsError = error as NSError
            self.emitError(nsError)
            reject("stt_error", error.localizedDescription, nsError)
            self.resetSession()
          }
        }
      }
    }
  }

  private func startRecording(with recognizer: SFSpeechRecognizer) throws {
    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
    try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

    recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
    guard let recognitionRequest else {
      throw NSError(domain: "SpeechModule", code: -1, userInfo: [NSLocalizedDescriptionKey: "Unable to create recognition request"])
    }
    recognitionRequest.shouldReportPartialResults = true

    recognitionTask = recognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
      guard let self else { return }

      if let result {
        let transcription = result.bestTranscription.formattedString
        self.lastTranscription = transcription
        self.emitPartialTranscription(transcription, isFinal: result.isFinal)
      }

      if result?.isFinal == true {
        self.handleTaskCompletion(error: nil)
        return
      }

      if let error {
        self.handleTaskCompletion(error: error)
      }
    }

    let recordingFormat = audioEngine.inputNode.outputFormat(forBus: 0)
    audioEngine.inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
      self.recognitionRequest?.append(buffer)
    }

    audioEngine.prepare()
    try audioEngine.start()
  }

  @objc
  func stopTranscribing(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard recognitionTask != nil else {
      resolve(lastTranscription ?? "")
      return
    }
    isUserInitiatedStop = true
    isUserInitiatedCancel = false
    self.resolve = resolve
    self.reject = reject
    recognitionRequest?.endAudio()
  }

  @objc
  func cancelTranscribing(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard recognitionTask != nil else {
      resolve("")
      return
    }
    isUserInitiatedStop = false
    isUserInitiatedCancel = true
    self.resolve = resolve
    self.reject = reject
    recognitionTask?.cancel()
  }

  @objc
  func getPermissionStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter _: @escaping RCTPromiseRejectBlock) {
    resolve(currentPermissionStatus())
  }

  @objc
  func requestPermission(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter _: @escaping RCTPromiseRejectBlock) {
    guard isRecognizerAvailable() else {
      resolve("unavailable")
      return
    }
    SFSpeechRecognizer.requestAuthorization { [weak self] speechStatus in
      guard let self else { return }

      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        DispatchQueue.main.async {
          let recordPermission: AVAudioSession.RecordPermission = granted ? .granted : .denied
          if speechStatus != .authorized || !granted {
            self.emitPermissionDenied()
          }
          resolve(self.permissionStatus(speech: speechStatus, micPermission: recordPermission))
        }
      }
    }
  }

  private func handleTaskCompletion(error: Error?) {
    guard !isFinishing else { return }
    isFinishing = true

    let finalText = lastTranscription ?? ""

    if let error = error as NSError? {
      let canceledCode = SFSpeechErrorCode.canceled.rawValue
      if error.domain == SFSpeechRecognitionErrorDomain && error.code == canceledCode {
        if isUserInitiatedCancel {
          resolve?("")
          resetSession()
          return
        }

        if isUserInitiatedStop {
          resolve?(finalText)
          emitSttFinalIfNeeded(finalText)
          resetSession()
          return
        }
      }

      reject?("stt_error", error.localizedDescription, error)
      emitError(error)
      resetSession()
      return
    }

    resolve?(finalText)
    emitSttFinalIfNeeded(finalText)
    resetSession()
  }
}

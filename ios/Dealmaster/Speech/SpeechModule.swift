import Foundation
import Speech
import AVFoundation
import React

@objc(SpeechModule)
class SpeechModule: RCTEventEmitter {
  private let audioEngine = AVAudioEngine()
  private let audioSession = AVAudioSession.sharedInstance()
  private var speechRecognizer: SFSpeechRecognizer? =
    SFSpeechRecognizer(locale: Locale.autoupdatingCurrent)
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var lastTranscription: String?
  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?
  private var sessionStartDate: Date?
  private var isUserInitiatedStop = false
  private var isUserInitiatedCancel = false
  private var isFinishing = false
  private let maxRetryCount = 3
  private var retryCount = 0

  deinit {
    teardownSession()
  }

  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func supportedEvents() -> [String]! {
    [
      "stt_partial",
      "stt_final",
      "stt_error",
      "stt_permission_denied",
    ]
  }

  private func cleanupRecognitionResources() {
    recognitionTask?.cancel()
    recognitionTask = nil
    recognitionRequest?.endAudio()
    recognitionRequest = nil

    if audioEngine.isRunning {
      audioEngine.stop()
      audioEngine.inputNode.removeTap(onBus: 0)
      audioEngine.reset()
    }

    try? audioSession.setActive(false, options: [.notifyOthersOnDeactivation])
  }

  private func teardownSession(resetRetryCount: Bool = true) {
    cleanupRecognitionResources()

    pendingResolve = nil
    pendingReject = nil
    lastTranscription = nil
    sessionStartDate = nil
    isUserInitiatedStop = false
    isUserInitiatedCancel = false
    isFinishing = false

    if resetRetryCount {
      retryCount = 0
    }
  }

  private func emitTelemetry(event: String, payload: [String: Any]) {
    sendEvent(withName: event, body: payload)
  }

  private func emitPermissionDenied() {
    emitTelemetry(
      event: "stt_permission_denied",
      payload: ["error_code": "permission_denied"]
    )
  }

  private func emitPartialTranscription(_ transcription: String, isFinal: Bool) {
    guard !transcription.isEmpty else { return }

    let duration = sessionStartDate.map { Date().timeIntervalSince($0) } ?? 0
    let payload: [String: Any] = [
      "text": transcription,
      "isFinal": isFinal,
      "duration": duration,
      "chars": transcription.count,
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

  private func emitError(
    message: String?,
    errorCode: String,
    retryCount: Int? = nil,
    willRetry: Bool = false
  ) {
    var payload: [String: Any] = [
      "error_code": errorCode,
    ]

    if let message, !message.isEmpty {
      payload["message"] = message
    }

    if let retryCount {
      payload["retry_count"] = retryCount
    }

    payload["will_retry"] = willRetry

    emitTelemetry(event: "stt_error", payload: payload)
  }

  private func formatErrorMessage(_ message: String?, errorCode: String) -> String {
    var payload: [String: Any] = [
      "error_code": errorCode,
    ]

    if let message, !message.isEmpty {
      payload["message"] = message
    }

    if let data = try? JSONSerialization.data(withJSONObject: payload, options: []) {
      return String(data: data, encoding: .utf8) ?? "{\"error_code\":\"\(errorCode)\"}"
    }

    return "{\"error_code\":\"\(errorCode)\"}"
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

  private func emitError(
    _ error: NSError,
    retryCount: Int? = nil,
    willRetry: Bool = false
  ) {
    let code = normalizedErrorCode(for: error)
    emitError(
      message: error.localizedDescription,
      errorCode: code,
      retryCount: retryCount,
      willRetry: willRetry
    )
  }

  private func emitSetupError(message: String, code: String) {
    emitError(message: message, errorCode: code)
  }

  private func isRecognizerAvailable() -> Bool {
    if speechRecognizer == nil {
      speechRecognizer = SFSpeechRecognizer(locale: Locale.autoupdatingCurrent)
    }

    guard let recognizer = speechRecognizer else {
      return false
    }

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
    let micStatus = audioSession.recordPermission
    return permissionStatus(speech: speechStatus, micPermission: micStatus)
  }

  private func shouldAttemptRetry(errorCode: String) -> Bool {
    if retryCount >= maxRetryCount {
      return false
    }

    if isUserInitiatedStop || isUserInitiatedCancel {
      return false
    }

    let nonRetryableCodes: Set<String> = [
      "permission_denied",
      "native_module_unavailable",
    ]

    return !nonRetryableCodes.contains(errorCode)
  }

  private func prepareAudioSession() throws {
    try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
    try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
  }

  private func startRecording(with recognizer: SFSpeechRecognizer) throws {
    try prepareAudioSession()

    recognitionRequest = SFSpeechAudioBufferRecognitionRequest()

    guard let recognitionRequest else {
      throw NSError(
        domain: "SpeechModule",
        code: -1,
        userInfo: [NSLocalizedDescriptionKey: "Unable to create recognition request"]
      )
    }

    recognitionRequest.shouldReportPartialResults = true

    recognitionTask = recognizer.recognitionTask(with: recognitionRequest) {
      [weak self] result, error in
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
    audioEngine.inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) {
      [weak self] buffer, _ in
      self?.recognitionRequest?.append(buffer)
    }

    audioEngine.prepare()
    try audioEngine.start()
  }

  private func handleTaskCompletion(error: Error?) {
    guard !isFinishing else { return }
    isFinishing = true

    let finalText = lastTranscription ?? ""

    if let error = error as NSError? {
      let canceledCode = SFSpeechErrorCode.canceled.rawValue

      if error.domain == SFSpeechRecognitionErrorDomain && error.code == canceledCode {
        if isUserInitiatedCancel {
          pendingResolve?("")
          teardownSession()
          return
        }

        if isUserInitiatedStop {
          pendingResolve?(finalText)
          emitSttFinalIfNeeded(finalText)
          teardownSession()
          return
        }
      }

      let normalizedCode = normalizedErrorCode(for: error)
      let formattedMessage = formatErrorMessage(
        error.localizedDescription,
        errorCode: normalizedCode
      )

      if shouldAttemptRetry(errorCode: normalizedCode),
         let recognizer = speechRecognizer,
         recognizer.isAvailable {
        retryCount += 1
        emitError(
          message: error.localizedDescription,
          errorCode: normalizedCode,
          retryCount: retryCount,
          willRetry: true
        )

        cleanupRecognitionResources()
        lastTranscription = nil
        isFinishing = false

        do {
          try startRecording(with: recognizer)
          sessionStartDate = Date()
          return
        } catch {
          let restartError = error as NSError
          emitError(restartError, retryCount: retryCount, willRetry: false)
          let restartCode = normalizedErrorCode(for: restartError)
          let restartMessage = formatErrorMessage(
            restartError.localizedDescription,
            errorCode: restartCode
          )
          pendingReject?("stt_error", restartMessage, restartError)
          teardownSession()
          return
        }
      }

      emitError(
        message: error.localizedDescription,
        errorCode: normalizedCode,
        retryCount: retryCount,
        willRetry: false
      )
      pendingReject?("stt_error", formattedMessage, error)
      teardownSession()
      return
    }

    pendingResolve?(finalText)
    emitSttFinalIfNeeded(finalText)
    teardownSession()
  }

  @objc
  func startTranscribing(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    isUserInitiatedStop = false
    isUserInitiatedCancel = false
    isFinishing = false
    lastTranscription = nil
    pendingResolve = nil
    pendingReject = nil
    retryCount = 0

    if speechRecognizer == nil {
      speechRecognizer = SFSpeechRecognizer(locale: Locale.autoupdatingCurrent)
    }

    guard let recognizer = speechRecognizer, recognizer.isAvailable else {
      let errorMessage = "Speech recognizer is unavailable"
      let errorCode = "native_module_unavailable"
      emitSetupError(
        message: errorMessage,
        code: errorCode
      )
      DispatchQueue.main.async {
        reject("stt_error", self.formatErrorMessage(errorMessage, errorCode: errorCode), nil)
        self.teardownSession()
      }
      return
    }

    SFSpeechRecognizer.requestAuthorization { [weak self] authStatus in
      guard let self else { return }

      if authStatus != .authorized {
        DispatchQueue.main.async {
          self.emitPermissionDenied()
          reject(
            "stt_error",
            self.formatErrorMessage("Speech recognition permission denied", errorCode: "permission_denied"),
            nil
          )
          self.teardownSession()
        }
        return
      }

      self.audioSession.requestRecordPermission { granted in
        DispatchQueue.main.async {
          guard granted else {
            self.emitPermissionDenied()
            reject(
              "stt_error",
              self.formatErrorMessage("Microphone permission denied", errorCode: "permission_denied"),
              nil
            )
            self.teardownSession()
            return
          }

          do {
            self.sessionStartDate = Date()
            try self.startRecording(with: recognizer)
            resolve(true)
          } catch {
            let nsError = error as NSError
            self.emitError(nsError)
            let normalized = self.normalizedErrorCode(for: nsError)
            reject("stt_error", self.formatErrorMessage(error.localizedDescription, errorCode: normalized), nsError)
            self.teardownSession()
          }
        }
      }
    }
  }

  @objc
  func stopTranscribing(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard recognitionTask != nil else {
      resolve(lastTranscription ?? "")
      return
    }

    isUserInitiatedStop = true
    isUserInitiatedCancel = false
    pendingResolve = resolve
    pendingReject = reject
    recognitionRequest?.endAudio()
  }

  @objc
  func cancelTranscribing(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard recognitionTask != nil else {
      resolve("")
      return
    }

    isUserInitiatedStop = false
    isUserInitiatedCancel = true
    pendingResolve = resolve
    pendingReject = reject
    recognitionTask?.cancel()
  }

  @objc
  func getPermissionStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(currentPermissionStatus())
  }

  @objc
  func requestPermission(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    guard isRecognizerAvailable() else {
      resolve("unavailable")
      return
    }

    SFSpeechRecognizer.requestAuthorization { [weak self] speechStatus in
      guard let self else { return }

      self.audioSession.requestRecordPermission { granted in
        DispatchQueue.main.async {
          let recordPermission: AVAudioSession.RecordPermission =
            granted ? .granted : .denied

          if speechStatus != .authorized || !granted {
            self.emitPermissionDenied()
          }

          resolve(
            self.permissionStatus(
              speech: speechStatus,
              micPermission: recordPermission
            )
          )
        }
      }
    }
  }
}

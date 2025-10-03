import Foundation
import Speech
import AVFoundation
import React

@objc(SpeechModule)
class SpeechModule: RCTEventEmitter {
  private let audioEngine = AVAudioEngine()
  private var speechRecognizer = SFSpeechRecognizer()
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var lastTranscription: String?
  private var resolve: RCTPromiseResolveBlock?
  private var reject: RCTPromiseRejectBlock?
  private var sessionStartDate: Date?
  private var isUserInitiatedStop = false
  private var isFinishing = false

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
    recognitionTask = nil
    recognitionRequest?.endAudio()
    recognitionRequest = nil

    if audioEngine.isRunning {
      audioEngine.stop()
      audioEngine.inputNode.removeTap(onBus: 0)
    }

    resolve = nil
    reject = nil
    lastTranscription = nil
    sessionStartDate = nil
    isUserInitiatedStop = false
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

  private func emitError(_ error: Error) {
    emitTelemetry(event: "stt_error", payload: ["message": error.localizedDescription])
  }

  @objc
  func startTranscribing(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    isUserInitiatedStop = false
    isFinishing = false
    lastTranscription = nil
    sessionStartDate = Date()

    SFSpeechRecognizer.requestAuthorization { [weak self] authStatus in
      guard let self else { return }

      if authStatus != .authorized {
        self.emitPermissionDenied()
        reject("stt_error", "Speech recognition permission denied", nil)
        return
      }

      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        guard granted else {
          self.emitPermissionDenied()
          reject("stt_error", "Microphone permission denied", nil)
          return
        }

        DispatchQueue.main.async {
          self.startRecording()
          resolve(true)
        }
      }
    }
  }

  private func startRecording() {
    let audioSession = AVAudioSession.sharedInstance()
    try? audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
    try? audioSession.setActive(true, options: .notifyOthersOnDeactivation)

    recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
    guard let recognitionRequest else { return }
    recognitionRequest.shouldReportPartialResults = true

    recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
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
    try? audioEngine.start()
  }

  @objc
  func stopTranscribing(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    isUserInitiatedStop = true
    self.resolve = resolve
    self.reject = reject
    recognitionRequest?.endAudio()
  }

  private func handleTaskCompletion(error: Error?) {
    guard !isFinishing else { return }
    isFinishing = true

    let finalText = lastTranscription ?? ""

    if let error = error as NSError? {
      let canceledCode = SFSpeechErrorCode.canceled.rawValue
      if error.domain == SFSpeechRecognitionErrorDomain && error.code == canceledCode && isUserInitiatedStop {
        resolve?(finalText)
        emitSttFinalIfNeeded(finalText)
        resetSession()
        return
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

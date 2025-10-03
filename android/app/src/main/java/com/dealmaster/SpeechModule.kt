package com.dealmaster

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.annotation.VisibleForTesting
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class SpeechModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext),
  LifecycleEventListener,
  PermissionListener {

  private var speechRecognizer: SpeechRecognizer? = null
  private var stopPromise: Promise? = null
  private var permissionPromise: Promise? = null
  private var lastTranscription: String = ""
  private var sessionStartTime: Long = 0L
  private var isUserInitiatedStop = false
  private var isUserInitiatedCancel = false
  private var isFinishing = false
  private val sharedPreferences by lazy {
    reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  }

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName(): String = NAME

  private fun ensureRecognizer(): Boolean {
    if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
      emitError("Speech recognition is not available on this device", "unavailable")
      return false
    }

    if (speechRecognizer == null) {
      speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext).apply {
        setRecognitionListener(object : RecognitionListener {
          override fun onReadyForSpeech(params: Bundle?) = Unit
          override fun onBeginningOfSpeech() = Unit
          override fun onRmsChanged(rmsdB: Float) = Unit
          override fun onBufferReceived(buffer: ByteArray?) = Unit
          override fun onEndOfSpeech() = Unit
          override fun onEvent(eventType: Int, params: Bundle?) = Unit

          override fun onError(error: Int) {
            handleError(error)
          }

          override fun onResults(results: Bundle) {
            val transcript = extractResult(results)
            if (transcript.isNotBlank()) {
              lastTranscription = transcript
              emitTranscription(transcript, isFinal = true)
            }
            resolveStopPromise(lastTranscription)
            cleanupRecognizer()
          }

          override fun onPartialResults(partialResults: Bundle) {
            val transcript = extractResult(partialResults)
            if (transcript.isBlank()) {
              return
            }
            lastTranscription = transcript
            emitTranscription(transcript, isFinal = false)
          }
        })
      }
    }
    return true
  }

  private fun extractResult(bundle: Bundle): String {
    val matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
    return matches?.firstOrNull()?.trim().orEmpty()
  }

  private fun handleError(error: Int) {
    if (isUserInitiatedCancel && error == SpeechRecognizer.ERROR_CLIENT) {
      resolveStopPromise("")
      cleanupRecognizer()
      return
    }

    if (isUserInitiatedStop && (error == SpeechRecognizer.ERROR_CLIENT || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT)) {
      resolveStopPromise(lastTranscription)
      cleanupRecognizer()
      return
    }

    val message = when (error) {
      SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
      SpeechRecognizer.ERROR_CLIENT -> "Client side error"
      SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
      SpeechRecognizer.ERROR_NETWORK -> "Network error"
      SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
      SpeechRecognizer.ERROR_NO_MATCH -> "No match"
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer busy"
      SpeechRecognizer.ERROR_SERVER -> "Server error"
      SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Speech timeout"
      else -> "Unknown error"
    }

    if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
      emitPermissionDenied()
    }

    stopPromise?.reject(ERROR_CODE, message)
    emitError(message, errorCode = error.toString())
    cleanupRecognizer()
  }

  private fun emitTranscription(text: String, isFinal: Boolean) {
    val payload = Arguments.createMap().apply {
      putString("text", text)
      putBoolean("isFinal", isFinal)
      putDouble("duration", durationSeconds())
      putInt("chars", text.length)
    }
    val event = if (isFinal) EVENT_FINAL else EVENT_PARTIAL
    sendEvent(event, payload)
  }

  private fun emitError(message: String, errorCode: String? = null) {
    val payload = Arguments.createMap().apply {
      putString("message", message)
      if (errorCode != null) {
        putString("error_code", errorCode)
      }
    }
    sendEvent(EVENT_ERROR, payload)
  }

  private fun emitPermissionDenied() {
    sendEvent(EVENT_PERMISSION_DENIED, Arguments.createMap())
  }

  private fun sendEvent(eventName: String, params: WritableMap) {
    if (!reactContext.hasActiveCatalystInstance()) {
      return
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  private fun durationSeconds(): Double {
    if (sessionStartTime == 0L) {
      return 0.0
    }
    val elapsed = SystemClock.elapsedRealtime() - sessionStartTime
    return elapsed.toDouble() / 1000.0
  }

  private fun cleanupRecognizer() {
    if (isFinishing) {
      return
    }
    isFinishing = true
    speechRecognizer?.setRecognitionListener(null)
    speechRecognizer?.destroy()
    speechRecognizer = null
    stopPromise = null
    lastTranscription = ""
    sessionStartTime = 0L
    isUserInitiatedStop = false
    isUserInitiatedCancel = false
    isFinishing = false
  }

  private fun ensurePermissionGranted(promise: Promise): Boolean {
    val status = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO)
    if (status == PackageManager.PERMISSION_GRANTED) {
      return true
    }
    emitPermissionDenied()
    promise.reject(ERROR_CODE, "Microphone permission denied")
    return false
  }

  private fun buildRecognitionIntent(locale: String?): Intent {
    return Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      locale?.let {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, it)
      }
    }
  }

  @ReactMethod
  fun startTranscribing(promise: Promise) {
    val locale = currentLocale()
    if (!ensureRecognizer()) {
      promise.reject(ERROR_CODE, "Speech recognizer unavailable")
      return
    }
    if (!ensurePermissionGranted(promise)) {
      return
    }

    sessionStartTime = SystemClock.elapsedRealtime()
    lastTranscription = ""
    isUserInitiatedStop = false
    isUserInitiatedCancel = false
    isFinishing = false

    val intent = buildRecognitionIntent(locale)
    speechRecognizer?.startListening(intent)
    promise.resolve(true)
  }

  @ReactMethod
  fun stopTranscribing(promise: Promise) {
    if (speechRecognizer == null) {
      promise.resolve("")
      return
    }
    stopPromise = promise
    isUserInitiatedStop = true
    speechRecognizer?.stopListening()
  }

  @ReactMethod
  fun cancelTranscribing(promise: Promise) {
    if (speechRecognizer == null) {
      promise.resolve("")
      return
    }
    stopPromise = promise
    isUserInitiatedCancel = true
    speechRecognizer?.cancel()
  }

  @ReactMethod
  fun getPermissionStatus(promise: Promise) {
    if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
      promise.resolve(PERMISSION_UNAVAILABLE)
      return
    }

    val status = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO)
    if (status == PackageManager.PERMISSION_GRANTED) {
      promise.resolve(PERMISSION_GRANTED)
      return
    }

    val activity = currentActivity
    val shouldShowRationale =
      activity != null &&
        ActivityCompat.shouldShowRequestPermissionRationale(
          activity,
          Manifest.permission.RECORD_AUDIO,
        )
    val hasRequested = sharedPreferences.getBoolean(KEY_PERMISSION_REQUESTED, false)
    if (hasRequested && !shouldShowRationale) {
      promise.resolve(PERMISSION_BLOCKED)
      return
    }
    promise.resolve(PERMISSION_DENIED)
  }

  @ReactMethod
  fun requestPermission(promise: Promise) {
    if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
      promise.resolve(PERMISSION_UNAVAILABLE)
      return
    }

    val status = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO)
    if (status == PackageManager.PERMISSION_GRANTED) {
      promise.resolve(PERMISSION_GRANTED)
      return
    }

    val activity = currentActivity
    if (activity is PermissionAwareActivity) {
      permissionPromise = promise
      sharedPreferences.edit().putBoolean(KEY_PERMISSION_REQUESTED, true).apply()
      activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_CODE, this)
    } else {
      promise.reject(ERROR_CODE, "Host activity does not support permission requests")
    }
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray): Boolean {
    if (requestCode != REQUEST_CODE) {
      return false
    }

    val promise = permissionPromise ?: return false
    permissionPromise = null

    if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
      promise.resolve(PERMISSION_GRANTED)
    } else {
      emitPermissionDenied()
      val activity = currentActivity
      val blocked = activity == null || !ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.RECORD_AUDIO)
      promise.resolve(if (blocked) PERMISSION_BLOCKED else PERMISSION_DENIED)
    }
    return true
  }

  private fun resolveStopPromise(result: String) {
    stopPromise?.resolve(result)
    stopPromise = null
  }

  override fun onCatalystInstanceDestroy() {
    cleanupRecognizer()
  }

  override fun onHostResume() = Unit
  override fun onHostPause() = Unit
  override fun onHostDestroy() {
    cleanupRecognizer()
  }

  private fun currentLocale(): String? {
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        reactContext.resources.configuration.locales.get(0)?.toLanguageTag()
      } else {
        @Suppress("DEPRECATION")
        reactContext.resources.configuration.locale?.toString()
      }
    } catch (error: Exception) {
      null
    }
  }

  companion object {
    private const val NAME = "SpeechModule"
    private const val ERROR_CODE = "stt_error"
    private const val EVENT_PARTIAL = "stt_partial"
    private const val EVENT_FINAL = "stt_final"
    private const val EVENT_ERROR = "stt_error"
    private const val EVENT_PERMISSION_DENIED = "stt_permission_denied"
    private const val PERMISSION_GRANTED = "granted"
    private const val PERMISSION_DENIED = "denied"
    private const val PERMISSION_BLOCKED = "blocked"
    private const val PERMISSION_UNAVAILABLE = "unavailable"
    private const val REQUEST_CODE = 0x5345
    private const val PREFS_NAME = "speech_module_prefs"
    private const val KEY_PERMISSION_REQUESTED = "permission_requested"

    @VisibleForTesting
    internal fun mapPermissionStatus(granted: Boolean, showRationale: Boolean): String {
      if (granted) {
        return PERMISSION_GRANTED
      }
      return if (showRationale) PERMISSION_DENIED else PERMISSION_BLOCKED
    }
  }
}

# DealMaster React Native App

A React Native starter project bootstrapped with TypeScript that showcases a simple authentication flow powered by Zustand and Axios. The application includes Login, Home, and Settings screens connected with React Navigation.

## Features

- 🚀 **React Native 0.72** with TypeScript and ESLint configuration
- 🔐 **Authentication state** handled via [Zustand](https://github.com/pmndrs/zustand)
- 🌐 **Axios HTTP client** with an interceptor that injects auth tokens
- 🧭 **React Navigation** native stack navigator (Login → Home → Settings)
- 🎨 Shared design tokens and reusable UI components

## Project Structure

```
.
├── App.tsx
├── index.js
├── src
│   ├── components
│   ├── navigation
│   ├── screens
│   ├── services
│   ├── store
│   └── theme
└── ...
```

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the Metro bundler:

   ```bash
   npm run start
   ```

3. Run the application:

   ```bash
   # For Android
   npm run android

   # For iOS (requires macOS)
   npm run ios
   ```

## Speech-to-Text Input

The shared speech-to-text bridge lives in [`src/services/speech.ts`](src/services/speech.ts) and exposes helper methods for opening the microphone, handling partial results, and submitting transcripts. A minimal usage example:

```ts
import {addSpeechListener, open, stop, send} from '../services/speech';

const subscription = addSpeechListener('stt_final', payload => {
  // Forward the final transcript to your chat flow.
  send(payload.text);
});

await open();
const finalText = await stop();
subscription();
```

### Android-specific setup

- Declare the microphone permission by adding `<uses-permission android:name="android.permission.RECORD_AUDIO" />` to `android/app/src/main/AndroidManifest.xml`.
- Register the native package in `MainApplication`:

  ```kotlin
  override fun getPackages(): List<ReactPackage> =
    listOf(
      MainReactPackage(),
      SpeechPackage(),
    )
  ```

- Call `requestPermission()` before recording so the module can prompt users at runtime. When a user permanently denies access the module emits the `stt_permission_denied` telemetry event and resolves with a `blocked` status.

### iOS-specific setup

- Expo apps automatically merge the `ios.infoPlist` entries declared in [`app.json`](app.json); ensure the microphone and speech recognition usage descriptions are present before submitting to the App Store.
- No extra React Native registration is required — the Swift bridge is exported through `SpeechModuleBridge.m` and is available as `NativeModules.SpeechModule`.
- For local development run `npx pod-install` after installing JavaScript dependencies so the native module is compiled into the iOS project.

### Testing notes

- **Permissions** – Use `requestPermission()` to trigger the native prompt. On the iOS Simulator you can script responses with:

  ```bash
  xcrun simctl privacy booted speech-recognition grant com.dealmaster
  xcrun simctl privacy booted speech-recognition deny com.dealmaster
  xcrun simctl privacy booted microphone grant com.dealmaster
  xcrun simctl privacy booted microphone deny com.dealmaster
  ```

- **Microphone input** – Feed canned audio to the simulator microphone while testing partial/final events:

  ```bash
  xcrun simctl io booted microphone ./fixtures/sample-command.wav
  ```

  End the stream with `Ctrl+C` once you observe `stt_final` firing.

- **Negotiation pipeline** – Use `submitSpeechNegotiationSample()` from [`src/services/speechNegotiation.ts`](src/services/speechNegotiation.ts) to forward captured audio (Base64) to your backend `/api/speech-endpoint`. The helper automatically records end-to-end latency and error rate telemetry via the new `speech_pipeline_complete` event.

- **Telemetry expectations** – Example payloads emitted via `trackSttEvent`:

  ```ts
  // stt_partial
  {
    platform: 'ios',
    provider: 'native',
    sequence_id: 1,
    text_length: 12,
    partial_transcript: 'turn on lights',
  }

  // stt_final
  {
    platform: 'ios',
    provider: 'native',
    duration_ms: 3250,
    text_length: 12,
    transcript: 'turn on lights',
  }

  // stt_error
  {
    platform: 'ios',
    provider: 'native',
    error_code: 'no_speech_detected',
    message: 'SFSpeechErrorCode.noSpeech',
    native_flag: true,
  }

  // stt_permission_denied
  {
    platform: 'ios',
    provider: 'native',
    error_code: 'permission_denied',
    native_flag: true,
  }
  ```

## Environment Variables

Copy `.env.example` to `.env` and update the `API_URL` value to point to your backend service. The value will be used when creating the Axios instance.

For native OCR flag、權限與本機執行說明，請參考 [docs/ocr.md](docs/ocr.md).

## Testing & Linting

- Run `npm run lint` to check for lint issues
- Run `npm run typecheck` to verify TypeScript typings

## License

MIT

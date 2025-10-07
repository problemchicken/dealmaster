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

### 本機一鍵啟動 iOS 模擬器

```bash
chmod +x scripts/run_ios_sim.sh
./scripts/run_ios_sim.sh
```

> 備註：首次編譯需要較長時間屬正常現象；若機器沒有 iPhone 17 Pro 模擬器，腳本會自動回退到現有可用的裝置類型。

### Testing notes

- **Permissions** – Use `requestPermission()` to trigger the native prompt. On the iOS Simulator you can script responses with:

  ```bash
  xcrun simctl privacy booted speech-recognition grant com.dealmaster
  xcrun simctl privacy booted speech-recognition deny com.dealmaster
  xcrun simctl privacy booted microphone grant com.dealmaster
  xcrun simctl privacy booted microphone deny com.dealmaster
  ```

- **Microphone input** – Feed canned audio to the simulator microphone while testing partial/final events。先以 `node scripts/make-sample-wav.js` 產生 `tmp/sample-command.wav`：

  ```bash
  node scripts/make-sample-wav.js tmp/sample-command.wav
  xcrun simctl io booted microphone ./tmp/sample-command.wav
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

## E2E / 真機驗證

### App 內部驗證

- 前往 **Settings → Speech Debug / QA**，可於 `SpeechTest` 頁啟動語音錄製、檢視最新策略建議與 `speech_pipeline_complete` Telemetry。
- 頁面會即時列出最近 25 筆 telemetry payload、最後一次送出的 `/api/speech-endpoint` 請求與回覆，方便 QA 與除錯。

### 本機自動化腳本

1. 需一次授權 iOS 模擬器的麥克風 / 語音辨識權限（macOS）：

   ```bash
   xcrun simctl privacy booted microphone grant com.dealmaster
   xcrun simctl privacy booted speech-recognition grant com.dealmaster
   ```

2. 執行端對端驗證腳本（會啟動內建 mock server、先以 `scripts/make-sample-wav.js` 產生 `tmp/sample-command.wav`，再餵入該檔案並解析回覆／telemetry）：

   ```bash
   bash scripts/e2e-local.sh
   ```

   指令結束時應輸出：

   ```
   ASR final text: ...
   Strategy: ... , EmotionScore: ...
   Telemetry: speech_pipeline_complete total_duration=...ms endpoint_latency=...ms
   ```

3. 相關紀錄（請求、回應、telemetry、伺服器日誌）會寫入 `artifacts/e2e-local/` 供後續檢視。

### CI Smoke 測試

- GitHub Actions 於 Pull Request 中會觸發 `e2e-smoke` job，使用 `scripts/ci-e2e-smoke.sh` 跑一次最短路徑驗證並上傳 `artifacts/e2e-smoke/`。
- 失敗時 job 會回傳非零狀態並顯示 mock 伺服器輸出，協助定位端對端整合問題。

## License

MIT

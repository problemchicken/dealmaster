# STT & OCR Telemetry Schema

本文件統整語音辨識（STT）與文字抽取（OCR）遙測事件，說明共用欄位、事件專屬欄位與錯誤碼對照，並提供每個事件的範例 Payload。

> 範例資料同步維護於 [`docs/examples/telemetryExamples.ts`](./examples/telemetryExamples.ts)，並透過型別檢查確保正確性。

## 共用欄位

| Key | 型別 | 說明 |
| --- | --- | --- |
| `platform` | `'ios' \| 'android'` | 觸發事件的平台。 |
| `provider` | `string` | 觸發事件的辨識/抽取供應來源（例如 `native`、`whisper`、`visionKit`、`mlkit`、`stub` 等）。 |

> 其他欄位皆為事件專屬，請依下列定義傳入。

## STT 事件

| 事件名稱 | 說明 |
| --- | --- |
| `stt_open` | 開啟語音輸入介面。 |
| `stt_partial` | 去抖動後的中繼辨識結果（僅保留最新片段）。 |
| `stt_final` | 辨識完成並提供完整文字。 |
| `stt_error` | 辨識流程中發生錯誤。 |
| `stt_permission_denied` | 使用者拒絕麥克風權限。 |
| `stt_send` | 使用者確認並送出辨識結果。 |

### `stt_open`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `locale?` | `string \| null` | 預設語系。 |
| `native_flag?` | `boolean` | 是否使用原生 STT 管道。 |

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'native',
    locale: 'en-US',
    native_flag: true,
  },
  {
    platform: 'android',
    provider: 'native',
    locale: 'zh-TW',
    native_flag: true,
  },
  {
    platform: 'ios',
    provider: 'whisper',
    locale: 'ja-JP',
  },
]
```

### `stt_partial`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `sequence_id` | `number` | 本次會話內的遞增序號，用於比對延遲片段。 |
| `text_length` | `number` | 目前片段的字元長度。 |
| `partial_transcript` | `string` | 最新一次的部分辨識結果。 |

> **去抖動原則：** 僅在片段內容有變化時上報，避免大量重複事件；完整文字請於 `stt_final` 上報。

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'native',
    sequence_id: 1,
    text_length: 6,
    partial_transcript: 'hello',
  },
  {
    platform: 'android',
    provider: 'native',
    sequence_id: 2,
    text_length: 14,
    partial_transcript: '需要更多資料',
  },
  {
    platform: 'ios',
    provider: 'whisper',
    sequence_id: 3,
    text_length: 9,
    partial_transcript: '注文は',
  },
]
```

### `stt_final`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `duration_ms?` | `number` | 自開啟錄音至產出最終結果的耗時（毫秒）。 |
| `text_length` | `number` | 完整辨識文字長度。 |
| `transcript` | `string` | 最終辨識文字。 |

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'native',
    duration_ms: 1850,
    text_length: 24,
    transcript: 'Hello, I would like to order coffee.',
  },
  {
    platform: 'android',
    provider: 'native',
    duration_ms: 2200,
    text_length: 12,
    transcript: '需要更多資料',
  },
  {
    platform: 'ios',
    provider: 'whisper',
    duration_ms: 3100,
    text_length: 18,
    transcript: '注文はコーヒーです',
  },
]
```

### `stt_error`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `error_code` | `NormalizedErrorCode` | 對齊後的錯誤碼。 |
| `message?` | `string` | 平台回傳的原始錯誤資訊。 |
| `native_flag?` | `boolean` | 是否為原生管道錯誤。 |

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'native',
    error_code: 'network_failure',
    message: 'SFSpeechRecognizerErrorCode.network',
    native_flag: true,
  },
  {
    platform: 'android',
    provider: 'native',
    error_code: 'timeout',
    message: 'RecognizerTimeoutError',
  },
  {
    platform: 'ios',
    provider: 'whisper',
    error_code: 'no_speech_detected',
  },
]
```

### `stt_permission_denied`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `error_code` | `'permission_denied'` | 固定值，利於查詢。 |
| `native_flag?` | `boolean` | 是否來自原生權限流程。 |

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'native',
    error_code: 'permission_denied',
    native_flag: true,
  },
  {
    platform: 'android',
    provider: 'native',
    error_code: 'permission_denied',
  },
  {
    platform: 'ios',
    provider: 'whisper',
    error_code: 'permission_denied',
  },
]
```

### `stt_send`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `duration_ms?` | `number` | 從錄音開始到送出指令的時間。 |
| `text_length` | `number` | 送出文字的長度。 |
| `transcript?` | `string` | 送出時的文字內容（若與 `stt_final` 不同可用於偵測編輯）。 |

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'native',
    duration_ms: 2100,
    text_length: 24,
    transcript: 'Hello, I would like to order coffee.',
  },
  {
    platform: 'android',
    provider: 'native',
    duration_ms: 2350,
    text_length: 12,
    transcript: '需要更多資料',
  },
  {
    platform: 'ios',
    provider: 'whisper',
    duration_ms: 3200,
    text_length: 18,
    transcript: '注文はコーヒーです',
  },
]
```

## OCR 事件

| 事件名稱 | 說明 |
| --- | --- |
| `ocr_open` | 開啟 OCR 流程。 |
| `ocr_extract_ok` | 抽取成功且文字長度大於 0。 |
| `ocr_extract_empty` | 抽取完成但無文字。 |
| `ocr_quota_blocked` | 月度配額已滿而被拒。 |
| `ocr_native_fallback` | 原生抽取失敗後回退至備援方案。 |

### `ocr_open`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `native_flag` | `boolean` | 是否使用原生模組。 |

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'visionKit',
    native_flag: true,
  },
  {
    platform: 'android',
    provider: 'mlkit',
    native_flag: true,
  },
  {
    platform: 'ios',
    provider: 'stub',
    native_flag: false,
  },
]
```

### `ocr_extract_ok`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `native_flag` | `boolean` | 是否使用原生模組。 |
| `duration_ms?` | `number` | 抽取耗時。 |
| `text_length` | `number` | 抽取文字長度。 |

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'visionKit',
    native_flag: true,
    duration_ms: 180,
    text_length: 54,
  },
  {
    platform: 'android',
    provider: 'mlkit',
    native_flag: true,
    duration_ms: 240,
    text_length: 36,
  },
  {
    platform: 'ios',
    provider: 'stub',
    native_flag: false,
    duration_ms: 420,
    text_length: 28,
  },
]
```

### `ocr_extract_empty`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `native_flag` | `boolean` | 是否使用原生模組。 |
| `duration_ms?` | `number` | 抽取耗時。 |
| `text_length` | `number` | 抽取文字長度（通常為 0）。 |
| `error_code?` | `NormalizedErrorCode` | 對齊後的錯誤碼。 |

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'visionKit',
    native_flag: true,
    duration_ms: 160,
    text_length: 0,
    error_code: 'no_text_detected',
  },
  {
    platform: 'android',
    provider: 'mlkit',
    native_flag: true,
    duration_ms: 210,
    text_length: 0,
    error_code: 'no_text_detected',
  },
  {
    platform: 'ios',
    provider: 'stub',
    native_flag: false,
    duration_ms: 400,
    text_length: 0,
    error_code: 'native_module_unavailable',
  },
]
```

### `ocr_quota_blocked`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `native_flag?` | `boolean` | 若可得知觸發前是否使用原生模組則填寫。 |
| `error_code` | `'quota_exhausted'` | 固定值。 |

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'visionKit',
    native_flag: true,
    error_code: 'quota_exhausted',
  },
  {
    platform: 'android',
    provider: 'mlkit',
    error_code: 'quota_exhausted',
  },
  {
    platform: 'ios',
    provider: 'stub',
    native_flag: false,
    error_code: 'quota_exhausted',
  },
]
```

### `ocr_native_fallback`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `native_flag` | `boolean` | 是否原生模組先行嘗試。 |
| `duration_ms?` | `number` | 回退前的耗時。 |
| `error_code` | `'timeout' \| 'native_module_unavailable' \| 'transient_native_failure'` | 對齊後的錯誤碼。 |

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'visionKit',
    native_flag: true,
    duration_ms: 300,
    error_code: 'timeout',
  },
  {
    platform: 'android',
    provider: 'mlkit',
    native_flag: true,
    duration_ms: 360,
    error_code: 'transient_native_failure',
  },
  {
    platform: 'ios',
    provider: 'stub',
    native_flag: false,
    duration_ms: 500,
    error_code: 'native_module_unavailable',
  },
]
```

## 錯誤碼對照

以下表格協助將平台錯誤碼對齊至 `NormalizedErrorCode`：

### STT（iOS）

| 平台錯誤碼 | Normalized | 備註 |
| --- | --- | --- |
| `SFSpeechRecognizerErrorCode.notAuthorized` | `permission_denied` | 使用者尚未授權或於設定中關閉。 |
| `SFSpeechRecognizerErrorCode.network` | `network_failure` | 網路連線失敗。 |
| `SFSpeechRecognizerErrorCode.noSpeech` | `no_speech_detected` | 未偵測到語音。 |
| `SFSpeechRecognizerErrorCode.canceled` | `timeout` | 錄音或辨識逾時。 |

### STT（Android）

| 平台錯誤碼 | Normalized | 備註 |
| --- | --- | --- |
| `ERROR_INSUFFICIENT_PERMISSIONS` | `permission_denied` | 使用者拒絕麥克風權限。 |
| `ERROR_NETWORK` / `ERROR_NETWORK_TIMEOUT` | `network_failure` | 網路相關錯誤。 |
| `ERROR_NO_MATCH` | `no_speech_detected` | 無符合結果。 |
| `ERROR_SPEECH_TIMEOUT` | `timeout` | 語音輸入逾時。 |

### OCR（iOS）

| 平台錯誤碼 | Normalized | 備註 |
| --- | --- | --- |
| `VNErrorDomain.codeTimeout` | `timeout` | VisionKit 辨識逾時。 |
| `VisionKitError.nativeUnavailable` | `native_module_unavailable` | 原生模組不可用。 |
| `VisionKitError.noText` | `no_text_detected` | 無文字內容。 |

### OCR（Android）

| 平台錯誤碼 | Normalized | 備註 |
| --- | --- | --- |
| `MLKitError.Code.UNAVAILABLE` | `native_module_unavailable` | 原生模組尚未初始化或已卸載。 |
| `MLKitError.Code.DEADLINE_EXCEEDED` | `timeout` | 模型推論逾時。 |
| `TextRecognizerResultCode.EMPTY` | `no_text_detected` | 無抽取文字。 |
| `QuotaExceededException` | `quota_exhausted` | 達到月度配額限制。 |

## 語音談判管線事件

為了串接 iOS 語音辨識與後端談判模組，新增 `speech_pipeline_complete` 事件以衡量端到端反應時間與錯誤率。

| 事件名稱 | 說明 |
| --- | --- |
| `speech_pipeline_complete` | 前端上傳語音後，後端完成轉文字、策略生成並回傳結果。 |

### `speech_pipeline_complete`

| Key | 型別 | 說明 |
| --- | --- | --- |
| `duration_ms` | `number` | 從送出語音請求到收到策略回應的總耗時。 |
| `error_rate` | `0 \| 1` | 若請求失敗則為 `1`，成功為 `0`，便於後續統計錯誤率。 |
| `transcript_length?` | `number` | 後端回傳文字長度。 |
| `error_code?` | `NormalizedErrorCode` | 失敗時的標準化錯誤碼。 |
| `error_message?` | `string` | 後端或網路層回傳的錯誤訊息。 |

**範例 Payload**

```ts
[
  {
    platform: 'ios',
    provider: 'speech_pipeline',
    duration_ms: 1250,
    error_rate: 0,
    transcript_length: 42,
  },
  {
    platform: 'ios',
    provider: 'speech_pipeline',
    duration_ms: 980,
    error_rate: 1,
    error_code: 'network_failure',
    error_message: 'ECONNRESET',
  },
]
```

## 實作建議

- 優先完成 `stt_final` 後再觸發 `stt_send`，確保送出的文字與最後一次結果一致。
- `stt_partial` 僅保留最新的片段，減少噪音；若需完整歷史，請在客端自行儲存。
- 每次回退 (`ocr_native_fallback`) 須附上 `error_code` 以利追蹤原生模組健康度。
- 若後續新增欄位或錯誤碼，請同步更新本文件與範例程式並補齊型別檢查。

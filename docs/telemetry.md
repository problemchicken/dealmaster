# OCR Telemetry

本文件列出 OCR 功能相關的遙測事件與屬性，作為產品分析與實作時的參考。

## 事件對照

| 事件名稱 (`eventName`) | 說明 |
| --- | --- |
| `ocr_open` | 使用者開啟 OCR 選單或流程。|
| `ocr_extract_ok` | 抽取成功且 `text_length > 0`。|
| `ocr_extract_empty` | 抽取結果為空 (`text_length = 0`)。|
| `ocr_quota_blocked` | 月度用量達上限，使用者被擋下。|
| `ocr_native_fallback` | 原生管道失敗後，回退至 stub 實作。|

## 推薦屬性

除非另有註記，以下屬性為事件上報時推薦攜帶的欄位：

| Key | 型別 | 範例 | 說明 |
| --- | --- | --- | --- |
| `platform` | `string` | `"ios"`, `"android"` | 觸發事件的平台。|
| `native_flag` | `boolean` | `true`, `false` | 當下是否嘗試透過原生流程。|
| `provider` | `string` | `"visionkit"`, `"mlkit"`, `"stub"` | 使用的 OCR 提供者。|
| `text_length` | `number` | `0`, `42` | 抽取文字長度，僅適用於 `ocr_extract_*` 事件。|
| `duration_ms` | `number` | `180` | OCR 耗時（毫秒），若可計算請提供。|
| `error_code` | `string?` | `"timeout"` | 錯誤或回退時的錯誤代碼，適用於 `ocr_extract_empty`, `ocr_quota_blocked`, `ocr_native_fallback`。|

## 使用建議

- `ocr_extract_ok` 與 `ocr_extract_empty` 應搭配 `text_length` 與 `duration_ms`，以利分析成功率與效率。
- `ocr_quota_blocked` 應標記 `error_code` 以區分是配額耗盡或其他錯誤。
- `ocr_native_fallback` 建議攜帶觸發回退的 `error_code`，並保留 `provider` 以判斷原生模組類型。
- 若後續新增額外屬性，建議保持命名一致並補充於此文件。

## 上報範例

```ts
import {track} from '../lib/telemetry';

track('ocr_open', {
  platform: 'ios',
  native_flag: true,
  provider: 'visionkit',
});

track('ocr_extract_ok', {
  platform: 'ios',
  native_flag: true,
  provider: 'visionkit',
  text_length: 42,
  duration_ms: 180,
});

track('ocr_native_fallback', {
  platform: 'android',
  native_flag: true,
  provider: 'mlkit',
  duration_ms: 240,
  error_code: 'native_timeout',
});
```

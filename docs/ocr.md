# OCR 整合指南

## 功能概觀

整體流程為「Image → OCR → text → chat」。應用會先讓使用者選擇或拍攝影像，經由原生或 stub OCR 模組轉成文字，再把文字送入聊天流程。

## 旗標

- `EXPO_PUBLIC_OCR_NATIVE=true|false`（預設為 `false`）
  - `true`：啟動時嘗試載入 iOS **VisionKit** 以及 Android **ML Kit** 實作。
  - 若載入失敗或模組缺失，會自動回退到 JavaScript stub 版本，不會阻擋流程。
  - `false`：強制使用 stub OCR 實作，不啟用任何原生模組。

## 本機執行步驟

1. 安裝 OCR 所需套件：

   ```bash
   npm i expo-mlkit-ocr expo-constants
   ```

2. 建立原生專案設定（僅需一次）：

   ```bash
   npx expo prebuild -p ios -p android
   ```

3. 執行時依旗標切換：

   ```bash
   # 關閉原生（走 stub）
   EXPO_PUBLIC_OCR_NATIVE=false npx expo run:ios
   EXPO_PUBLIC_OCR_NATIVE=false npx expo run:android

   # 開啟原生
   EXPO_PUBLIC_OCR_NATIVE=true npx expo run:ios
   EXPO_PUBLIC_OCR_NATIVE=true npx expo run:android
   ```

## 權限需求

- **相機**：需要提供拍攝影像的理由（例如「此應用程式需要存取相機以擷取票券影像進行辨識」）。
- **相簿 / 媒體庫**：用於匯入現有照片（例如「允許存取照片以選取現有票券影像進行辨識」）。
- 請確認在各平台 `app.json` 或原生專案設定中加入對應的權限描述，並遵守商店審核政策。

## 風險與回退機制

- 若缺少原生模組（例如 CI 或尚未 `prebuild` 的環境），應用會自動回到 stub OCR 實作，保持功能可用。
- 持續整合環境預設 `EXPO_PUBLIC_OCR_NATIVE=false`，以避免缺少原生依賴造成編譯失敗。

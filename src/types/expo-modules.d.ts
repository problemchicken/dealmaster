declare module 'expo-image-picker' {
  export type PermissionResponse = {
    granted: boolean;
    canAskAgain?: boolean;
    expires?: number | string;
    status?: 'undetermined' | 'granted' | 'denied';
  };

  export type ImagePickerAsset = {
    uri: string;
    width?: number;
    height?: number;
    type?: string | null;
    fileName?: string | null;
  };

  export type ImagePickerResult = {
    canceled: boolean;
    assets?: ImagePickerAsset[];
  };

  export type MediaTypeOption = 'All' | 'Images' | 'Videos';

  export const MediaTypeOptions: {
    All: MediaTypeOption;
    Images: MediaTypeOption;
    Videos: MediaTypeOption;
  };

  export function requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse>;
  export function requestCameraPermissionsAsync(): Promise<PermissionResponse>;
  export function launchImageLibraryAsync(options?: {
    mediaTypes?: MediaTypeOption | typeof MediaTypeOptions[keyof typeof MediaTypeOptions];
    allowsMultipleSelection?: boolean;
    quality?: number;
  }): Promise<ImagePickerResult>;
  export function launchCameraAsync(options?: {
    mediaTypes?: MediaTypeOption | typeof MediaTypeOptions[keyof typeof MediaTypeOptions];
    quality?: number;
  }): Promise<ImagePickerResult>;
}

declare module 'expo-mlkit-ocr' {
  export interface OcrLine {
    text?: string | null;
  }

  export interface OcrBlock {
    lines?: OcrLine[];
  }

  export interface OcrResult {
    blocks?: OcrBlock[];
  }

  export function scanFromUri(uri: string): Promise<OcrResult>;
}

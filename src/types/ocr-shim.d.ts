declare module 'react-native-text-recognition' {
  const TextRecognition: (path: string) => Promise<string[]>;
  export default TextRecognition;
}
declare module 'expo-mlkit-ocr' {
  export function scanFromUriAsync(uri: string): Promise<{ text: string }[]>;
}

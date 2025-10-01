import {Alert, Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
  mimeType?: string | null;
};

type ImageSource = 'camera' | 'library';

const promptImageSource = async (): Promise<ImageSource | null> => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return 'library';
  }

  return new Promise<ImageSource | null>(resolve => {
    Alert.alert('Import image', 'Choose how to add your image', [
      {text: 'Cancel', style: 'cancel', onPress: () => resolve(null)},
      {text: 'Photo Library', onPress: () => resolve('library')},
      {text: 'Take Photo', onPress: () => resolve('camera')},
    ]);
  });
};

const normalizeAsset = (asset: ImagePicker.ImagePickerAsset): PickedImage => ({
  uri: asset.uri,
  width: asset.width ?? 0,
  height: asset.height ?? 0,
  fileName: asset.fileName ?? null,
  mimeType: asset.type ?? null,
});

export const pickImage = async (): Promise<PickedImage | null> => {
  const source = await promptImageSource();
  if (!source) {
    return null;
  }

  if (source === 'library') {
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!mediaPermission.granted) {
      Alert.alert('Permission required', 'Allow photo library access to continue.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    return normalizeAsset(result.assets[0]);
  }

  const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
  if (!cameraPermission.granted) {
    Alert.alert('Permission required', 'Allow camera access to take a photo.');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return normalizeAsset(result.assets[0]);
};

const prepareOcrUri = (value: string): string => {
  if (!value) {
    return '';
  }

  if (Platform.OS === 'ios') {
    return value.replace(/^file:\/\//, '');
  }

  return value;
};

export async function ocrImageToText(uri: string): Promise<string[]> {
  const normalizedUri = prepareOcrUri(uri);
  if (!normalizedUri) {
    return [];
  }

  try {
    const rnTextRecog = require('react-native-text-recognition') as
      | ((path: string) => Promise<string[]>)
      | undefined;
    if (typeof rnTextRecog === 'function') {
      const lines = await rnTextRecog(normalizedUri);
      if (Array.isArray(lines)) {
        return lines;
      }
    }
  } catch {
    // no-op: fall back to other integrations or stub
  }

  try {
    const mlkit = require('expo-mlkit-ocr') as
      | {scanFromUriAsync?: (u: string) => Promise<{text: string}[]>}
      | undefined;
    if (mlkit?.scanFromUriAsync) {
      const blocks = await mlkit.scanFromUriAsync(normalizedUri);
      if (Array.isArray(blocks)) {
        return blocks.map(block => block.text).filter(Boolean);
      }
    }
  } catch {
    // no-op: fall back to stub
  }

  return [];
}

export const extractText = async (uri: string): Promise<string> => {
  const lines = await ocrImageToText(uri);
  if (!lines.length) {
    return '';
  }
  return lines
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
};

export default ocrImageToText;

import {Alert, Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MLKitOcr from 'expo-mlkit-ocr';

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

export const extractText = async (uri: string): Promise<string> => {
  if (!uri) {
    return '';
  }

  const ocrResult = await MLKitOcr.scanFromUri(uri);
  if (!ocrResult?.blocks?.length) {
    return '';
  }

  const lines: string[] = [];

  for (const block of ocrResult.blocks) {
    if (!block.lines?.length) {
      continue;
    }

    for (const line of block.lines) {
      const value = line.text?.trim();
      if (value) {
        lines.push(value);
      }
    }
  }

  return lines.join('\n');
};

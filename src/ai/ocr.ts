import {Alert, Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from 'react-native-text-recognition';

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

  if (Platform.OS === 'android') {
    return value;
  }

  return value;
};

export const extractText = async (uri: string): Promise<string> => {
  if (!uri) {
    return '';
  }

  const normalizedUri = prepareOcrUri(uri);
  if (!normalizedUri) {
    return '';
  }

  const lines = await TextRecognition(normalizedUri);
  if (!lines?.length) {
    return '';
  }

  return lines
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
};

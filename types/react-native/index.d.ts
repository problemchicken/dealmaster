declare module 'react-native' {
  import * as React from 'react';

  type AnyStyle = {[key: string]: any};

  export type ViewStyle = AnyStyle;
  export type TextStyle = AnyStyle;
  export type ImageStyle = AnyStyle;
  export type StyleProp<T> = T | null | undefined | Array<StyleProp<T>>;

  export interface GestureResponderEvent {
    [key: string]: any;
  }

  export interface TouchableOpacityProps {
    onPress?: (event: GestureResponderEvent) => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export const View: React.ComponentType<any>;
  export const Text: React.ComponentType<any>;
  export const SafeAreaView: React.ComponentType<any>;
  export const ScrollView: React.ComponentType<any>;
  export const FlatList: React.ComponentType<any>;
  export const RefreshControl: React.ComponentType<any>;
  export const TouchableOpacity: React.ComponentType<TouchableOpacityProps>;
  export const TextInput: React.ComponentType<any>;
  export const Switch: React.ComponentType<any>;
  export const ActivityIndicator: React.ComponentType<any>;
  export const StatusBar: React.ComponentType<any>;
  export const KeyboardAvoidingView: React.ComponentType<any>;
  export const SafeAreaViewBase: React.ComponentType<any>;
  export const Platform: {OS: string};
  export const Alert: {
    alert: (...args: any[]) => void;
  };

  export const StyleSheet: {
    create<T extends {[key: string]: AnyStyle}>(styles: T): T;
  };

  export function useColorScheme(): 'light' | 'dark' | null;
}

declare namespace React {
  type ReactNode = any;
  interface FC<P = {}> {
    (props: P & {children?: ReactNode}): ReactNode;
  }
  interface FunctionComponent<P = {}> extends FC<P> {}
  function useState<S>(initialState: S | (() => S)): [S, (value: S) => void];
  function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  function useCallback<T extends (...args: any[]) => any>(fn: T, deps: readonly any[]): T;
  function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  const Fragment: any;
}

declare module 'react' {
  export = React;
  export const useState: typeof React.useState;
  export const useEffect: typeof React.useEffect;
  export const useCallback: typeof React.useCallback;
  export const useMemo: typeof React.useMemo;
  export const Fragment: typeof React.Fragment;
  export type FC<P = {}> = React.FC<P>;
  export type ReactNode = React.ReactNode;
}

declare namespace JSX {
  type Element = any;
  interface ElementClass {}
  interface ElementAttributesProperty {
    props: any;
  }
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module 'react-native' {
  export type ColorSchemeName = 'light' | 'dark' | null;
  export function useColorScheme(): ColorSchemeName;
  export const StatusBar: any;
  export const StyleSheet: {create<T extends {[key: string]: any}>(styles: T): T};
  export const View: any;
  export const Text: any;
  export const TextInput: any;
  export const Button: any;
  export const Alert: {alert(title: string, message?: string): void};
  export const SafeAreaView: any;
  export const ScrollView: any;
  export const Switch: any;
  export const TouchableOpacity: any;
  export const ActivityIndicator: any;
  export const FlatList: any;
  export const RefreshControl: any;
  export const KeyboardAvoidingView: any;
  export const Platform: {OS: string; select<T>(options: {[key: string]: T}): T};
  export interface TouchableOpacityProps {
    style?: any;
    [key: string]: any;
  }
}

declare module 'react-native-safe-area-context' {
  import type {FC} from 'react';
  export const SafeAreaProvider: FC<any>;
  export function useSafeAreaInsets(): {top: number; right: number; bottom: number; left: number};
}

declare module '@react-navigation/native' {
  import type {FC, ReactNode} from 'react';
  export const NavigationContainer: FC<{children?: ReactNode}>;
  export const DarkTheme: any;
  export const DefaultTheme: any;
}

declare module '@react-navigation/native-stack' {
  export function createNativeStackNavigator<T>(): any;
  export type NativeStackScreenProps<T extends Record<string, any>, K extends keyof T = keyof T> = {
    navigation: any;
    route: {name: K; params: T[K]};
  };
}

declare module 'zustand' {
  export type ZustandHook<T> = {
    (): T;
    <U>(selector: (state: T) => U): U;
    getState(): T;
    setState(partial: Partial<T>): void;
  };
  export function create<T>(initializer: (set: (partial: Partial<T>) => void, get: () => T) => T): ZustandHook<T>;
}

declare module 'axios' {
  export interface AxiosRequestConfig {
    [key: string]: any;
  }
  export interface AxiosResponse<T = any> {
    data: T;
  }
  export interface AxiosInstance {
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    interceptors: {
      request: {
        use(onFulfilled: (config: AxiosRequestConfig) => AxiosRequestConfig): void;
      };
    };
  }
  export interface AxiosStatic {
    create(config?: AxiosRequestConfig): AxiosInstance;
  }
  const axios: AxiosStatic;
  export default axios;
}

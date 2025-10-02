declare module '@react-native-async-storage/async-storage' {
  export type MultiGetResult = [string, string | null][];

  export interface AsyncStorageStatic {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    multiGet(keys: readonly string[]): Promise<MultiGetResult>;
    multiSet(entries: readonly [string, string][]): Promise<void>;
    removeItem(key: string): Promise<void>;
  }

  const AsyncStorage: AsyncStorageStatic;
  export default AsyncStorage;
}

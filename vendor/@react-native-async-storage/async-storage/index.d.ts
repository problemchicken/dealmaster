export type AsyncStorageValue = string | null;

export interface AsyncStorageStatic {
  getItem(key: string): Promise<AsyncStorageValue>;
  setItem(key: string, value: string): Promise<void | null>;
  removeItem(key: string): Promise<void | null>;
  clear(): Promise<void | null>;
  getAllKeys(): Promise<string[]>;
  multiGet(keys: string[]): Promise<[string, AsyncStorageValue][]>;
  multiSet(entries: [string, string][]): Promise<void | null>;
  multiRemove(keys: string[]): Promise<void | null>;
}

declare const AsyncStorage: AsyncStorageStatic;
export default AsyncStorage;

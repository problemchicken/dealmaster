export type AsyncStorageStatic = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
  multiGet(keys: string[]): Promise<[string, string | null][]>;
  multiSet(entries: [string, string][]): Promise<void>;
};

declare const AsyncStorage: AsyncStorageStatic;
export default AsyncStorage;

declare module 'zustand' {
  export type StateCreator<T> = (
    set: (
      partial: Partial<T> | ((state: T) => Partial<T>),
      replace?: boolean,
    ) => void,
    get: () => T,
  ) => T;

  export interface UseBoundStore<T> {
    (): T;
    <U>(selector: (state: T) => U): U;
    getState: () => T;
  }

  export function create<T>(initializer: StateCreator<T>): UseBoundStore<T>;
}

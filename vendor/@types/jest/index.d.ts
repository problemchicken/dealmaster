declare namespace jest {
  interface Matchers<R> {
    toBe(expected: unknown): R;
    toEqual(expected: unknown): R;
    toContain(expected: unknown): R;
    toBeCloseTo(expected: number, numDigits?: number): R;
    toHaveLength(length: number): R;
  }

  interface Expect {
    <T = unknown>(actual: T): Matchers<void>;
    arrayContaining<T = unknown>(expected: readonly T[]): unknown;
  }

  type TestFn = () => void | Promise<void>;
  type DescribeFn = () => void | Promise<void>;
}

declare const expect: jest.Expect;

declare function describe(name: string, fn: jest.DescribeFn): void;
declare namespace describe {
  function only(name: string, fn: jest.DescribeFn): void;
  function skip(name: string, fn: jest.DescribeFn): void;
}

declare function it(name: string, fn: jest.TestFn): void;
declare namespace it {
  function only(name: string, fn: jest.TestFn): void;
  function skip(name: string, fn: jest.TestFn): void;
}

declare function test(name: string, fn: jest.TestFn): void;
declare namespace test {
  function only(name: string, fn: jest.TestFn): void;
  function skip(name: string, fn: jest.TestFn): void;
}

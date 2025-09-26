declare namespace React {
  type ReactNode = any;
  interface ReactElement<P = any, T = any> {
    type: T;
    props: P;
    key: string | number | null;
  }
  interface FunctionComponent<P = {}> {
    (props: P & {children?: ReactNode}): ReactElement | null;
  }
  type FC<P = {}> = FunctionComponent<P>;
  type ComponentType<P = {}> = FunctionComponent<P>;
  type SetStateAction<S> = S | ((prevState: S) => S);
  type Dispatch<A> = (value: A) => void;
  function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps?: readonly any[]): T;
  function useMemo<T>(factory: () => T, deps?: readonly any[]): T;
  const Fragment: unique symbol;
}

declare module 'react' {
  export = React;
}

declare namespace JSX {
  interface Element extends React.ReactElement<any, any> {}
  interface ElementClass {
    render?: any;
  }
  interface ElementAttributesProperty {
    props: any;
  }
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

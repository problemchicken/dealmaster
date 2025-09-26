declare module '@react-navigation/native' {
  import * as React from 'react';

  export type ParamListBase = Record<string, object | undefined>;

  export const NavigationContainer: React.ComponentType<{children?: React.ReactNode}>;

  export type NavigationProp<
    ParamList extends ParamListBase = ParamListBase,
  > = {
    navigate<RouteName extends keyof ParamList>(
      ...args: RouteName extends keyof ParamList
        ? [RouteName, ParamList[RouteName]?]
        : [string, any]
    ): void;
    goBack(): void;
    setParams(params: Partial<ParamList[keyof ParamList]>): void;
  };

  export function useNavigation<ParamList extends ParamListBase = ParamListBase>(): NavigationProp<ParamList>;
}

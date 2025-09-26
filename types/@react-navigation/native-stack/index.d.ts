declare module '@react-navigation/native-stack' {
  import * as React from 'react';
  import {ParamListBase} from '@react-navigation/native';

  export type NativeStackScreenProps<
    ParamList extends ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList,
  > = {
    navigation: {
      navigate<Route extends keyof ParamList>(
        ...args: Route extends keyof ParamList
          ? [Route, ParamList[Route]?]
          : [string, any]
      ): void;
      goBack(): void;
      setParams(params: Partial<ParamList[keyof ParamList]>): void;
    };
    route: {
      key: string;
      name: RouteName;
      params: ParamList[RouteName];
    };
  };

  export function createNativeStackNavigator<ParamList extends ParamListBase = ParamListBase>(): {
    Navigator: React.ComponentType<{children?: React.ReactNode}>;
    Screen: React.ComponentType<any>;
  };
}

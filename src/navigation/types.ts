import type {ChatScreenParams} from '../types/chat';

export type RootStackParamList = {
  Home: undefined;
  ChatList: undefined;
  Chat: ChatScreenParams | undefined;
  Settings: undefined;
  Login: undefined;
};

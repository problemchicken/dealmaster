export type RootStackParamList = {
  Home: undefined;
  ChatList: undefined;
  Chat: {sessionId?: string; title?: string} | undefined;
  Settings: undefined;
  ChatList: undefined;
  Chat: {chatId: number; title: string};
  Login: undefined;
};

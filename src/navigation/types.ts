import type {ChatScreenParams} from '../types/chat';

export type RootStackParamList = {
  Home: undefined;
  ChatList: undefined;
  Chat: ChatScreenParams | undefined;
  OcrConfirm: {extractedText: string; sessionId?: string; title?: string};
  Settings: undefined;
  SpeechTest: undefined;
  Login: undefined;
};

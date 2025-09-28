import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ListRenderItem} from 'react-native';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {colors} from '../theme/colors';
import {generateChat} from '../ai/generateChat';
import type {ChatMessage} from '../ai/types';
import {RootStackParamList} from '../navigation/types';
import {useSettingsStore} from '../store/useSettingsStore';
import {getEnvVar} from '../utils/env';
import {chatMemory, DEFAULT_SESSION_TITLE} from '../services/chatMemory';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const SYSTEM_PROMPT: ChatMessage = {
  role: 'system',
  content:
    'You are DealMaster AI, an enthusiastic shopping assistant that helps users discover amazing deals.',
};

const ChatScreen: React.FC<Props> = ({route, navigation}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(
    route.params?.sessionId ?? null,
  );
  const sessionIdRef = useRef<string | null>(sessionId);
  const [initializing, setInitializing] = useState(true);
  const abortController = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const envOverrides = useSettingsStore(state => state.envOverrides);

  const hasApiKey = useMemo(() => {
    const override = envOverrides.GPT5_API_KEY ?? envOverrides.OPENAI_API_KEY;
    if (override) {
      return true;
    }
    return Boolean(getEnvVar('GPT5_API_KEY') ?? getEnvVar('OPENAI_API_KEY'));
  }, [envOverrides]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const persistMessages = useCallback(
    async (
      conversation: ChatMessage[],
      options: {updateTitle?: boolean} = {},
    ) => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) {
        return;
      }
      await chatMemory.saveConversation(currentSessionId, conversation);
      if (options.updateTitle) {
        const updatedTitle = await chatMemory.updateTitle(
          currentSessionId,
          conversation,
        );
        navigation.setParams({title: updatedTitle});
      }
    },
    [navigation],
  );

  const updateMessages = useCallback(
    (
      updater: (prev: ChatMessage[]) => ChatMessage[],
      options: {persist?: boolean; updateTitle?: boolean} = {},
    ) => {
      setMessages(prev => {
        const next = updater(prev);
        messagesRef.current = next;
        if (options.persist !== false) {
          persistMessages(next, {updateTitle: options.updateTitle}).catch(
            () => undefined,
          );
        }
        return next;
      });
    },
    [persistMessages],
  );

  const routeParams = route.params ?? {};
  const routeSessionId = routeParams.sessionId;
  const routeTitle = routeParams.title;

  useEffect(() => {
    let isMounted = true;

    const ensureSession = async () => {
      await chatMemory.initialize();
      if (!isMounted) {
        return;
      }

      if (routeSessionId) {
        const existing = await chatMemory.getSession(routeSessionId);
        if (!isMounted) {
          return;
        }
        if (existing) {
          setSessionId(existing.id);
          updateMessages(() => existing.messages ?? [], {persist: false});
          if (existing.title !== routeTitle) {
            navigation.setParams({title: existing.title});
          }
          setInitializing(false);
          return;
        }
      }

      const created = await chatMemory.createSession(
        typeof routeTitle === 'string' && routeTitle.length > 0
          ? routeTitle
          : DEFAULT_SESSION_TITLE,
      );
      if (!isMounted) {
        return;
      }
      setSessionId(created.id);
      updateMessages(() => created.messages ?? [], {persist: false});
      navigation.setParams({sessionId: created.id, title: created.title});
      setInitializing(false);
    };

    ensureSession();

    return () => {
      isMounted = false;
    };
  }, [navigation, routeSessionId, routeTitle, updateMessages]);

  const appendMessage = useCallback(
    (message: ChatMessage, options?: {updateTitle?: boolean}) => {
      updateMessages(prev => [...prev, message], options);
    },
    [updateMessages],
  );

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !sessionId) {
      return;
    }

    if (!hasApiKey) {
      setError('Add your GPT-5 API key in Settings to start chatting.');
      return;
    }

    setError(null);
    setInput('');
    const userMessage: ChatMessage = {role: 'user', content: trimmed};
    const conversation = [...messagesRef.current, userMessage];
    appendMessage(userMessage, {updateTitle: true});
    setIsStreaming(true);

    const controller = new AbortController();
    abortController.current = controller;

    let didStream = false;

    try {
      const result = await generateChat({
        messages: [SYSTEM_PROMPT, ...conversation],
        signal: controller.signal,
        onToken: token => {
          didStream = true;
          updateMessages(prev => {
            if (prev.length === 0) {
              return [{role: 'assistant', content: token}];
            }

            const last = prev[prev.length - 1];
            if (last.role === 'assistant') {
              const next = [...prev];
              next[next.length - 1] = {
                ...last,
                content: last.content + token,
              };
              return next;
            }

            return [...prev, {role: 'assistant', content: token}];
          });
        },
      });

      if (didStream) {
        updateMessages(prev => {
          if (prev.length === 0) {
            return [result.message];
          }
          const next = [...prev];
          const last = next[next.length - 1];
          if (last.role === 'assistant') {
            next[next.length - 1] = result.message;
            return next;
          }
          return [...next, result.message];
        });
      } else {
        appendMessage(result.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      updateMessages(prev => {
        if (prev.length === 0) {
          return prev;
        }
        const next = [...prev];
        const last = next[next.length - 1];
        if (last.role === 'assistant' && last.content.length === 0) {
          next.pop();
        }
        return next;
      });
    } finally {
      setIsStreaming(false);
      abortController.current = null;
    }
  }, [appendMessage, hasApiKey, input, isStreaming, sessionId, updateMessages]);

  const handleStop = () => {
    abortController.current?.abort();
    abortController.current = null;
    setIsStreaming(false);
  };

  const handleClear = () => {
    abortController.current?.abort();
    abortController.current = null;
    setIsStreaming(false);
    setError(null);
    updateMessages(() => [], {updateTitle: true});
  };

  const renderMessage: ListRenderItem<ChatMessage> = ({item}) => {
    if (item.role === 'system') {
      return null;
    }

    const isUser = item.role === 'user';
    const bubbleStyle = [
      styles.messageBubble,
      isUser ? styles.userBubble : styles.assistantBubble,
    ];
    const textStyle = isUser ? styles.userText : styles.assistantText;

    return (
      <View style={styles.messageRow}>
        <View style={bubbleStyle}>
          <Text style={textStyle}>{item.content}</Text>
        </View>
      </View>
    );
  };

  const trimmedInput = input.trim();
  const disableSendButton =
    initializing || !sessionId || (!isStreaming && trimmedInput.length === 0);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={16}>
        <View style={styles.header}>
          <Text style={styles.title}>DealMaster Chat</Text>
          <TouchableOpacity onPress={handleClear} accessibilityRole="button">
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>
        {!hasApiKey && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Add your GPT-5 API key in settings to enable responses.
            </Text>
          </View>
        )}
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.messagesContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Start chatting</Text>
              <Text style={styles.emptySubtitle}>
                Ask DealMaster for personalized shopping tips and curated deals.
              </Text>
            </View>
          }
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about the best deals..."
            style={styles.input}
            multiline
            editable={!isStreaming}
            accessibilityLabel="Chat input"
          />
          <TouchableOpacity
            onPress={isStreaming ? handleStop : sendMessage}
            style={[styles.sendButton, disableSendButton && styles.sendButtonDisabled]}
            disabled={disableSendButton}>
            {isStreaming ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  clearText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  banner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  bannerText: {
    color: colors.error,
    fontSize: 14,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  messageRow: {
    marginBottom: 12,
  },
  messageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  userText: {
    color: colors.white,
    fontSize: 15,
  },
  assistantText: {
    color: colors.text,
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
});

export default ChatScreen;

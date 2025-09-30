import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {
  AUTO_SUMMARY_PREFIX,
  buildContextForPreview,
  generateChat,
  summarizeChatToDate,
} from '../services/chatService';
import {getMessagesForChat} from '../storage/chatRepository';
import {MessageRecord} from '../storage/types';
import PrimaryButton from '../components/PrimaryButton';
import {colors} from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const ChatScreen: React.FC<Props> = ({route}) => {
  const {chatId} = route.params;
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [contextPreview, setContextPreview] = useState<MessageRecord[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<MessageRecord | null>(null);

  const pinnedSummary = useMemo(() => {
    return [...messages].reverse().find(message => message.role === 'summary');
  }, [messages]);

  const summaryDisplayContent = useMemo(() => {
    if (!pinnedSummary) {
      return '';
    }
    if (pinnedSummary.content.startsWith(AUTO_SUMMARY_PREFIX)) {
      return pinnedSummary.content.slice(AUTO_SUMMARY_PREFIX.length).trimStart();
    }
    return pinnedSummary.content;
  }, [pinnedSummary]);

  const nonSummaryMessages = useMemo(() => {
    return messages.filter(message => message.role !== 'summary');
  }, [messages]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const history = await getMessagesForChat(chatId);
      setMessages(history);
      setStreamingMessage(null);
      const preview = await buildContextForPreview(chatId);
      setContextPreview(preview);
    } catch (error) {
      console.error('Failed to load chat history', error);
      Alert.alert('載入失敗', '無法載入對話歷史，請稍後再試。');
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [loadMessages]),
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }
    try {
      setSending(true);
      setInput('');
      setStreamingMessage(null);
      await generateChat(chatId, trimmed, {
        onUserMessage: message => {
          setMessages(prev => [...prev, message]);
        },
        onToken: token => {
          setStreamingMessage(prev => {
            const base =
              prev ??
              ({
                id: Number.MAX_SAFE_INTEGER,
                chat_id: chatId,
                role: 'assistant',
                content: '',
                created_at: new Date().toISOString(),
              } as MessageRecord);
            return {...base, content: base.content + token};
          });
        },
        onAssistantMessage: message => {
          setStreamingMessage(null);
          setMessages(prev => [...prev, message]);
        },
      });
      await loadMessages();
    } catch (error) {
      console.error('Failed to send chat message', error);
      Alert.alert('傳送失敗', '請稍後再試一次。');
    } finally {
      setStreamingMessage(null);
      setSending(false);
    }
  }, [chatId, input, loadMessages]);

  const handleSummarize = useCallback(async () => {
    try {
      setSummarizing(true);
      setStreamingMessage(null);
      await summarizeChatToDate(chatId);
      await loadMessages();
    } catch (error) {
      console.error('Failed to summarize chat history', error);
      Alert.alert('摘要失敗', '產生摘要時發生問題，請稍後再試。');
    } finally {
      setSummarizing(false);
    }
  }, [chatId, loadMessages]);

  const displayMessages = useMemo(() => {
    if (!streamingMessage) {
      return nonSummaryMessages;
    }
    return [...nonSummaryMessages, streamingMessage];
  }, [nonSummaryMessages, streamingMessage]);

  const summaryBadgeLabel = useMemo(() => {
    if (!pinnedSummary) {
      return undefined;
    }
    return pinnedSummary.content.startsWith(AUTO_SUMMARY_PREFIX) ? '自動產生' : '手動產生';
  }, [pinnedSummary]);

  const renderMessage = ({item}: {item: MessageRecord}) => {
    const isUser = item.role === 'user';
    const isSummary = item.role === 'summary';
    const containerStyle = [
      styles.messageBubble,
      isUser ? styles.userBubble : styles.assistantBubble,
      isSummary && styles.summaryBubble,
    ];
    const textStyle = [styles.messageText, isUser ? styles.userText : styles.assistantText];
    const label = isSummary
      ? '摘要'
      : isUser
      ? '你'
      : item.role === 'assistant'
      ? 'DealMaster AI'
      : '系統';

    return (
      <View style={containerStyle}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={[...textStyle, isSummary && styles.summaryText]}>{item.content}</Text>
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

  if (loading && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>載入歷史訊息中…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        {pinnedSummary ? (
          <View style={styles.pinnedSummary}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>一鍵總結</Text>
              {summaryBadgeLabel ? (
                <Text style={styles.summaryBadge}>{summaryBadgeLabel}</Text>
              ) : null}
            </View>
            <Text style={styles.summaryContent}>{summaryDisplayContent}</Text>
          </View>
        ) : null}
        <FlatList
          data={displayMessages}
          keyExtractor={item => `${item.id}-${item.created_at}`}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            contextPreview.length > 0 ? (
              <View style={styles.contextPreview}>
                <Text style={styles.contextTitle}>模型輸入預覽</Text>
                {contextPreview.map(message => {
                  const roleLabel =
                    message.role === 'user'
                      ? '你'
                      : message.role === 'assistant'
                      ? 'DealMaster AI'
                      : message.role === 'summary'
                      ? '摘要'
                      : '系統';
                  return (
                    <Text
                      key={`${message.id}-${message.created_at}`}
                      style={styles.contextText}>{`${roleLabel}：${message.content}`}</Text>
                  );
                })}
              </View>
            ) : undefined
          }
        />
        <View style={styles.actions}>
          <PrimaryButton
            title={summarizing ? '摘要中…' : '一鍵總結到目前'}
            onPress={handleSummarize}
            disabled={summarizing}
          />
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="輸入訊息…"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <PrimaryButton
            title={sending ? '傳送中…' : '送出'}
            onPress={handleSend}
            disabled={sending}
            style={styles.sendButton}
          />
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
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  pinnedSummary: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#C8DCFF',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#DCE6FF',
    color: '#1A3A8C',
    fontSize: 12,
  },
  summaryContent: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  messageBubble: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
  },
  userBubble: {
    backgroundColor: '#D6F5D6',
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  assistantBubble: {
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  summaryBubble: {
    backgroundColor: '#FFF5D6',
    borderColor: '#FFDD99',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: colors.text,
  },
  assistantText: {
    color: colors.text,
  },
  summaryText: {
    color: '#8A5A00',
  },
  metaLabel: {
    fontSize: 12,
    marginBottom: 4,
    color: colors.muted,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-end',
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
  },
  sendButton: {
    marginLeft: 12,
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  contextPreview: {
    padding: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    marginBottom: 16,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: colors.text,
  },
  contextText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: colors.muted,
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

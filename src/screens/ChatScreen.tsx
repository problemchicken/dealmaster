import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ListRenderItem} from 'react-native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
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
import {chatSessionsService} from '../services/chatSessions';
import {pickImage, extractTextFromImage} from '../ai/ocr';
import {track} from '../lib/telemetry';
import {useSubscriptionStore} from '../store/useSubscriptionStore';
import UpgradeModal from '../components/UpgradeModal';
import {track as trackEvent} from '../services/telemetry';
import {
  addSttListener,
  getLastFinalResult,
  startTranscription,
  stopTranscription,
} from '../ai/stt';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const SYSTEM_PROMPT: ChatMessage = {
  role: 'system',
  content:
    'You are DealMaster AI, an enthusiastic shopping assistant that helps users discover amazing deals.',
};

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
  const pendingMessageRef = useRef<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const abortController = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const envOverrides = useSettingsStore(state => state.envOverrides);
  const {
    plan,
    consumeChat,
    upgradeModalVisible,
    openUpgradeModal,
    closeUpgradeModal,
    setPlan,
  } = useSubscriptionStore(state => ({
    plan: state.plan,
    consumeChat: state.consumeChat,
    upgradeModalVisible: state.upgradeModalVisible,
    openUpgradeModal: state.openUpgradeModal,
    closeUpgradeModal: state.closeUpgradeModal,
    setPlan: state.setPlan,
  }));
  const canUseChat = useSubscriptionStore(state => state.canUseChat);
  const canUseOcr = useSubscriptionStore(state => state.canUseOcr);
  const isQuotaExceeded = useSubscriptionStore(state => state.isQuotaExceeded());
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [isSttActive, setIsSttActive] = useState(false);
  const [sttElapsedMs, setSttElapsedMs] = useState(0);
  const sttInteractionRef = useRef<'idle' | 'holdActive' | 'holdCompleted'>('idle');
  const sttStartTimestampRef = useRef<number | null>(null);
  const sttLocaleRef = useRef<string | null>(null);
  const sttLastResultRef = useRef<string | null>(null);
  const sttLastDurationRef = useRef<number | undefined>(undefined);

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

  useEffect(() => {
    const unsubscribe = addSttListener(event => {
      if (event.type === 'result') {
        setInput(event.text);
        if (!event.isFinal) {
          setIsSttActive(true);
          if (sttStartTimestampRef.current == null) {
            sttStartTimestampRef.current = Date.now();
          }
          if (event.locale) {
            sttLocaleRef.current = event.locale;
          }
        } else {
          const startedAt = sttStartTimestampRef.current;
          const computedDuration =
            event.durationMs ??
            (startedAt != null
              ? Date.now() - startedAt
              : sttLastDurationRef.current);
          setIsSttActive(false);
          sttInteractionRef.current = 'idle';
          sttLocaleRef.current = event.locale ?? sttLocaleRef.current;
          sttLastResultRef.current = event.text;
          sttLastDurationRef.current =
            computedDuration ?? sttLastDurationRef.current;
          setSttElapsedMs(computedDuration ?? 0);
          sttStartTimestampRef.current = null;
        }
        return;
      }

      if (event.type === 'permission_denied') {
        sttInteractionRef.current = 'idle';
        sttStartTimestampRef.current = null;
        setIsSttActive(false);
        setSttElapsedMs(0);
        sttLastResultRef.current = null;
        sttLastDurationRef.current = undefined;
        sttLocaleRef.current = null;
        const openSettings = () => {
          if (typeof Linking.openSettings === 'function') {
            Linking.openSettings().catch(() => {
              Linking.openURL('app-settings:').catch(() => undefined);
            });
            return;
          }
          Linking.openURL('app-settings:').catch(() => undefined);
        };
        Alert.alert('需要權限', '請前往設定開啟麥克風與語音辨識權限。', [
          {text: '取消', style: 'cancel'},
          {text: '前往設定', onPress: openSettings},
        ]);
        return;
      }

      if (event.type === 'error') {
        sttInteractionRef.current = 'idle';
        sttStartTimestampRef.current = null;
        setIsSttActive(false);
        setSttElapsedMs(0);
        sttLastResultRef.current = null;
        sttLastDurationRef.current = undefined;
        sttLocaleRef.current = null;
        const message = event.message ?? '請稍後再試。';
        Alert.alert('語音輸入失敗', message);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSttActive) {
      setSttElapsedMs(0);
      return;
    }

    const interval = setInterval(() => {
      if (sttStartTimestampRef.current != null) {
        setSttElapsedMs(Date.now() - sttStartTimestampRef.current);
      }
    }, 200);

    return () => {
      clearInterval(interval);
    };
  }, [isSttActive]);

  useEffect(() => {
    return () => {
      if (Platform.OS === 'ios') {
        stopTranscription().catch(() => undefined);
      }
    };
  }, []);

  const persistMessages = useCallback(async (conversation: ChatMessage[]) => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) {
        return;
      }
      const metadata = await chatSessionsService.saveConversation(
        currentSessionId,
        conversation,
      );
      if (!metadata) {
        return;
      }

      const hasManualTitle = typeof metadata.title === 'string' && metadata.title.length > 0;

      if (!hasManualTitle) {
        navigation.setParams({
          title: chatSessionsService.getDisplayTitle(metadata),
        });
      }
    }, [navigation]);

  const updateMessages = useCallback(
    (
      updater: (prev: ChatMessage[]) => ChatMessage[],
      options: {persist?: boolean; updateTitle?: boolean} = {},
    ) => {
      setMessages(prev => {
        const next = updater(prev);
        messagesRef.current = next;
        if (options.persist !== false) {
          persistMessages(next).catch(() => undefined);
        }
        return next;
      });
    },
    [persistMessages],
  );

  const routeParams = route.params ?? {};
  const routeSessionId = routeParams.sessionId;
  const routeTitle = routeParams.title;
  const routePendingMessage = routeParams.pendingMessage;
  const routePendingMessageSource = routeParams.pendingMessageSource;

  useEffect(() => {
    let isMounted = true;

    const ensureSession = async () => {
      await chatSessionsService.initialize();
      if (!isMounted) {
        return;
      }

      if (routeSessionId) {
        const existing = await chatSessionsService.getSession(routeSessionId);
        if (!isMounted) {
          return;
        }
        if (existing) {
          setSessionId(existing.id);
          updateMessages(() => existing.messages ?? [], {persist: false});
          const displayTitle = chatSessionsService.getDisplayTitle(existing);
          if (displayTitle !== routeTitle) {
            navigation.setParams({title: displayTitle});
          }
          setInitializing(false);
          return;
        }
      }

      const created = await chatSessionsService.createSession();
      if (!isMounted) {
        return;
      }
      setSessionId(created.id);
      updateMessages(() => created.messages ?? [], {persist: false});
      navigation.setParams({
        sessionId: created.id,
        title: chatSessionsService.getDisplayTitle(created),
      });
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

  type SendOptions = {
    clearInput?: boolean;
    skipQuotaCheck?: boolean;
    shouldConsumeQuota?: boolean;
  };

  const sendUserMessage = useCallback(
    async (content: string, options: SendOptions = {}) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming || !sessionId) {
        if (options?.clearInput) {
          setInput('');
        }
        return;
      }

      if (!hasApiKey) {
        setError('Add your GPT-5 API key in Settings to start chatting.');
        return;
      }

      if (!options.skipQuotaCheck && !canUseChat()) {
        openUpgradeModal();
        return;
      }

      setError(null);
      if (options?.clearInput) {
        setInput('');
      }

      if (options.shouldConsumeQuota !== false) {
        const consumed = await consumeChat()
          .then(result => result)
          .catch(err => {
            console.error('Failed to record usage', err);
            return false;
          });

        if (!consumed) {
          openUpgradeModal();
          setIsStreaming(false);
          abortController.current = null;
          return;
        }
      }

      const wasSttMessage =
        sttLastResultRef.current != null &&
        trimmed === sttLastResultRef.current.trim();

      const userMessage: ChatMessage = {role: 'user', content: trimmed};
      const conversation = [...messagesRef.current, userMessage];
      appendMessage(userMessage, {updateTitle: true});
      if (wasSttMessage) {
        trackEvent('stt_send', {
          platform: Platform.OS,
          locale: sttLocaleRef.current ?? undefined,
          duration_ms: sttLastDurationRef.current,
          chars: trimmed.length,
        });
      }
      sttLastResultRef.current = null;
      sttLastDurationRef.current = undefined;

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
    },
    [
      appendMessage,
      canUseChat,
      consumeChat,
      hasApiKey,
      isStreaming,
      openUpgradeModal,
      sessionId,
      updateMessages,
    ],
  );

  const sendMessage = useCallback(() => {
    sendUserMessage(input, {clearInput: true});
  }, [input, sendUserMessage]);

  useEffect(() => {
    const pending = routePendingMessage;
    if (!pending) {
      return;
    }
    if (!sessionId || initializing || isStreaming) {
      return;
    }
    if (pendingMessageRef.current === pending) {
      navigation.setParams({
        pendingMessage: undefined,
        pendingMessageSource: undefined,
      });
      return;
    }
    pendingMessageRef.current = pending;
    const skipQuotaCheck = routePendingMessageSource === 'ocr';
    const shouldConsumeQuota = routePendingMessageSource === 'ocr' ? false : true;
    sendUserMessage(pending, {
      skipQuotaCheck,
      shouldConsumeQuota,
    })
      .catch(() => undefined)
      .finally(() => {
        navigation.setParams({
          pendingMessage: undefined,
          pendingMessageSource: undefined,
        });
      });
  }, [
    initializing,
    isStreaming,
    navigation,
    routePendingMessage,
    routePendingMessageSource,
    sendUserMessage,
    sessionId,
  ]);

  const handleStartOcr = useCallback(async () => {
    if (!canUseOcr()) {
      trackEvent('quota_block', {feature: 'ocr'});
      openUpgradeModal();
      return;
    }

    setError(null);
    setIsOcrProcessing(true);
    try {
      const image = await pickImage();
      if (!image) {
        track('ocr_cancel', {source: 'ui'});
        return;
      }

      track('ocr_start', {source: 'ui', uriPresent: Boolean(image.uri)});

      const result = await extractTextFromImage(image.uri);
      const text = (result.text ?? '').trim();
      if (!text) {
        track('ocr_empty', {source: 'ui', meta: result.meta});
        setError('未能擷取到文字，請重試或更換圖片。');
        return;
      }

      track('ocr_success', {
        source: 'ui',
        chars: text.length,
        meta: result.meta,
      });

      navigation.navigate('OcrConfirm', {
        extractedText: text,
        sessionId: sessionIdRef.current ?? undefined,
        title: routeTitle,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`OCR 失敗：${message}`);
      track('ocr_error', {source: 'ui', message});
      console.error('Failed to process OCR', err);
    } finally {
      setIsOcrProcessing(false);
    }
  }, [canUseOcr, navigation, openUpgradeModal, routeTitle, setError]);

  const startVoiceInput = useCallback(async () => {
    if (isSttActive) {
      return;
    }

    if (Platform.OS === 'android') {
      await startTranscription();
      return;
    }

    try {
      const locale = await startTranscription();
      sttStartTimestampRef.current = Date.now();
      sttLocaleRef.current = locale ?? null;
      sttLastResultRef.current = null;
      sttLastDurationRef.current = undefined;
      setSttElapsedMs(0);
      setIsSttActive(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('語音輸入失敗', message);
      sttInteractionRef.current = 'idle';
      sttStartTimestampRef.current = null;
      setIsSttActive(false);
      setSttElapsedMs(0);
    }
  }, [isSttActive]);

  const stopVoiceInput = useCallback(async () => {
    if (Platform.OS === 'android') {
      await stopTranscription();
      return;
    }

    const startedAt = sttStartTimestampRef.current;

    try {
      const finalText = await stopTranscription();
      const finalResult = getLastFinalResult();
      if (finalResult) {
        sttLocaleRef.current = finalResult.locale ?? sttLocaleRef.current;
        sttLastDurationRef.current =
          finalResult.durationMs ??
          (startedAt != null ? Date.now() - startedAt : sttLastDurationRef.current);
        sttLastResultRef.current = finalResult.text;
        setInput(finalResult.text);
      } else if (typeof finalText === 'string') {
        sttLastResultRef.current = finalText;
        sttLastDurationRef.current =
          startedAt != null ? Date.now() - startedAt : sttLastDurationRef.current;
        setInput(finalText);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('語音輸入失敗', message);
    } finally {
      sttInteractionRef.current = 'idle';
      sttStartTimestampRef.current = null;
      setIsSttActive(false);
      setSttElapsedMs(0);
    }
  }, [setInput]);

  const handleMicLongPress = useCallback(() => {
    if (isStreaming || initializing) {
      return;
    }

    sttInteractionRef.current = 'holdActive';
    startVoiceInput().catch(() => undefined);
  }, [initializing, isStreaming, startVoiceInput]);

  const handleMicPressOut = useCallback(() => {
    if (sttInteractionRef.current === 'holdActive') {
      stopVoiceInput().catch(() => undefined);
      sttInteractionRef.current = 'holdCompleted';
    }
  }, [stopVoiceInput]);

  const handleMicPress = useCallback(() => {
    if (sttInteractionRef.current === 'holdCompleted') {
      sttInteractionRef.current = 'idle';
      return;
    }

    if (isStreaming || initializing) {
      return;
    }

    if (isSttActive) {
      stopVoiceInput().catch(() => undefined);
    } else {
      sttInteractionRef.current = 'idle';
      startVoiceInput().catch(() => undefined);
    }
  }, [initializing, isStreaming, isSttActive, startVoiceInput, stopVoiceInput]);

  const handleChangeInput = useCallback((text: string) => {
    setInput(text);
    if (
      sttLastResultRef.current &&
      text.trim() !== sttLastResultRef.current.trim()
    ) {
      sttLastResultRef.current = null;
      sttLastDurationRef.current = undefined;
    }
  }, []);

  const handleUpgrade = useCallback(async () => {
    await setPlan('pro');
    closeUpgradeModal();
  }, [closeUpgradeModal, setPlan]);

  const handleStop = () => {
    abortController.current?.abort();
    abortController.current = null;
    setIsStreaming(false);
  };

  const handleClear = () => {
    if (isSttActive) {
      stopVoiceInput().catch(() => undefined);
    }
    sttLastResultRef.current = null;
    sttLastDurationRef.current = undefined;
    sttLocaleRef.current = null;
    sttStartTimestampRef.current = null;
    sttInteractionRef.current = 'idle';
    setIsSttActive(false);
    setSttElapsedMs(0);
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
  const recordingDurationLabel = useMemo(
    () => formatDuration(sttElapsedMs),
    [sttElapsedMs],
  );
  const disableSendButton =
    initializing ||
    !sessionId ||
    isSttActive ||
    (!isStreaming && (trimmedInput.length === 0 || isQuotaExceeded));
  const disableOcrButton =
    !canUseOcr() || isOcrProcessing || initializing || isStreaming;
  const disableMicButton = initializing || isStreaming;

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
          <View style={styles.inputWrapper}>
            <TextInput
              value={input}
              onChangeText={handleChangeInput}
              placeholder="Ask about the best deals..."
              style={[styles.input, isSttActive && styles.inputRecording]}
              multiline
              editable={!isStreaming && !isSttActive}
              accessibilityLabel="Chat input"
            />
            {isSttActive ? (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>{recordingDurationLabel}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="語音輸入"
            accessibilityHint="長按開始語音輸入，放開以結束"
            disabled={disableMicButton}
            onLongPress={handleMicLongPress}
            onPressOut={handleMicPressOut}
            onPress={handleMicPress}
            delayLongPress={150}
            style={({pressed}) => [
              styles.micButton,
              (isSttActive || pressed) ? styles.micButtonActive : undefined,
              disableMicButton ? styles.micButtonDisabled : undefined,
            ]}>
            <Text style={styles.micText}>{isSttActive ? '聆聽中' : '語音'}</Text>
          </Pressable>
          <TouchableOpacity
            onPress={handleStartOcr}
            style={[styles.ocrButton, disableOcrButton && styles.ocrButtonDisabled]}
            disabled={disableOcrButton}
            accessibilityRole="button"
            accessibilityLabel="Start OCR">
            {isOcrProcessing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.ocrButtonText}>OCR</Text>
            )}
          </TouchableOpacity>
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
        {isQuotaExceeded ? (
          <Text style={styles.quotaWarning}>
            免費方案本月 Chat/OCR 額度已用完，升級 Pro 享無限次數。
          </Text>
        ) : null}
      </KeyboardAvoidingView>
      <UpgradeModal
        visible={upgradeModalVisible}
        plan={plan}
        onClose={closeUpgradeModal}
        onUpgrade={handleUpgrade}
      />
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
  inputWrapper: {
    flex: 1,
    position: 'relative',
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
    paddingRight: 72,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
  inputRecording: {
    borderColor: colors.primary,
  },
  recordingIndicator: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  micButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: colors.white,
  },
  micButtonActive: {
    borderColor: colors.primary,
    backgroundColor: '#eef2ff',
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
  micText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  ocrButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: colors.white,
  },
  ocrButtonDisabled: {
    opacity: 0.6,
  },
  ocrButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
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
  quotaWarning: {
    color: colors.primary,
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    fontSize: 13,
  },
});

export default ChatScreen;

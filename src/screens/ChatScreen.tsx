import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {
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

  const pinnedSummary = useMemo(() => {
    return [...messages].reverse().find(message => message.role === 'summary');
  }, [messages]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const history = await getMessagesForChat(chatId);
      setMessages(history);
      const preview = await buildContextForPreview(chatId);
      setContextPreview(preview);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) {
      return;
    }
    try {
      setSending(true);
      await generateChat(chatId, input);
      setInput('');
      await loadMessages();
    } finally {
      setSending(false);
    }
  }, [chatId, input, loadMessages]);

  const handleSummarize = useCallback(async () => {
    try {
      setSummarizing(true);
      await summarizeChatToDate(chatId);
      await loadMessages();
    } finally {
      setSummarizing(false);
    }
  }, [chatId, loadMessages]);

  const renderMessage = ({item}: {item: MessageRecord}) => {
    const isUser = item.role === 'user';
    const isSummary = item.role === 'summary';
    const containerStyle = [
      styles.messageBubble,
      isUser ? styles.userBubble : styles.assistantBubble,
      isSummary && styles.summaryBubble,
    ];
    const textStyle = [styles.messageText, isUser ? styles.userText : styles.assistantText];

    return (
      <View style={containerStyle}>
        <Text style={styles.metaLabel}>
          {isSummary ? '摘要' : isUser ? '你' : 'DealMaster AI'}
        </Text>
        <Text style={[...textStyle, isSummary && styles.summaryText]}>{item.content}</Text>
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
            <Text style={styles.summaryTitle}>一鍵總結</Text>
            <Text style={styles.summaryContent}>{pinnedSummary.content}</Text>
          </View>
        ) : null}
        <FlatList
          data={messages}
          keyExtractor={item => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            contextPreview.length > 0 ? (
              <View style={styles.contextPreview}>
                <Text style={styles.contextTitle}>模型輸入預覽</Text>
                {contextPreview.map(message => (
                  <Text key={`${message.id}-${message.created_at}`} style={styles.contextText}>
                    {`${message.role === 'user' ? '你' : '系統'}：${message.content}`}
                  </Text>
                ))}
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
    marginBottom: 8,
    color: colors.text,
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
  },
});

export default ChatScreen;


import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import PrimaryButton from '../components/PrimaryButton';
import {colors} from '../theme/colors';
import {ChatMessage, generateChat} from '../ai/generateChat';

const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Hi there! Ask me about deals or anything else and I\'ll help.',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type UiMessage = ChatMessage & {
  id: string;
  isError?: boolean;
};

const ChatScreen: React.FC<Props> = () => {
  const [messages, setMessages] = useState<UiMessage[]>([{
    ...INITIAL_ASSISTANT_MESSAGE,
    id: 'assistant-0',
  }]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const flatListRef = useRef<FlatList<UiMessage>>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({animated: true});
    });
  }, []);

  const conversationPayload = useMemo(() => {
    return messages
      .filter(message => !message.isError)
      .map(({role, content}) => ({role, content}));
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) {
      return;
    }

    const userMessage: UiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    const pendingAssistant: UiMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
    };

    const payloadMessages = [...conversationPayload, {role: 'user', content: userMessage.content}];

    setMessages(prev => [...prev, userMessage, pendingAssistant]);
    setInput('');
    setIsStreaming(true);
    scrollToEnd();

    try {
      const result = await generateChat(payloadMessages, {
        model: 'gpt-5',
        stream: true,
        temperature: 0.3,
        onToken: token => {
          setMessages(prev =>
            prev.map(message =>
              message.id === pendingAssistant.id
                ? {...message, content: message.content + token}
                : message,
            ),
          );
          scrollToEnd();
        },
      });
      setMessages(prev =>
        prev.map(message =>
          message.id === pendingAssistant.id
            ? {...message, content: result.message.content}
            : message,
        ),
      );
    } catch (error) {
      const friendly =
        error instanceof Error
          ? error.message
          : 'The AI assistant is unavailable. Please try again later.';
      setMessages(prev =>
        prev.map(message =>
          message.id === pendingAssistant.id
            ? {
                ...message,
                content: friendly,
                isError: true,
              }
            : message,
        ),
      );
      Alert.alert('GPT-5', friendly);
    } finally {
      setIsStreaming(false);
      scrollToEnd();
    }
  }, [conversationPayload, input, isStreaming, scrollToEnd]);

  const renderItem = useCallback(({item}: {item: UiMessage}) => {
    const isAssistant = item.role === 'assistant';
    const bubbleStyles = [styles.bubble, isAssistant ? styles.assistantBubble : styles.userBubble];
    const textStyles = [styles.bubbleText, isAssistant ? styles.assistantText : styles.userText];

    if (item.isError) {
      bubbleStyles.push(styles.errorBubble);
      textStyles.push(styles.errorText);
    }

    return (
      <View style={styles.messageRow}>
        <View style={bubbleStyles}>
          <Text style={textStyles}>{item.content || (isAssistant ? '…' : '')}</Text>
        </View>
      </View>
    );
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={80}>
        <View style={styles.header}>
          <Text style={styles.title}>AI Assistant</Text>
          <Text style={styles.subtitle}>
            Powered by GPT-5. Messages stream live as they are generated.
          </Text>
        </View>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToEnd}
        />
        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask the AI assistant…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            editable={!isStreaming}
          />
          <PrimaryButton
            title={isStreaming ? 'Generating…' : 'Send'}
            onPress={handleSend}
            disabled={isStreaming || !input.trim()}
            style={[styles.sendButton, isStreaming ? styles.sendButtonDisabled : null]}
          />
        </View>
        {isStreaming && (
          <View style={styles.streamingIndicator}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.streamingText}>Streaming response…</Text>
          </View>
        )}
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
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    color: colors.muted,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  assistantBubble: {
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
  },
  userBubble: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    marginLeft: 'auto',
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
  },
  assistantText: {
    color: colors.text,
  },
  userText: {
    color: colors.white,
  },
  errorBubble: {
    backgroundColor: '#fee2e2',
  },
  errorText: {
    color: colors.error,
  },
  composer: {
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  input: {
    minHeight: 60,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  sendButton: {
    borderRadius: 12,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  streamingIndicator: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamingText: {
    marginLeft: 8,
    color: colors.muted,
  },
});

export default ChatScreen;

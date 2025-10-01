import React, {useCallback, useMemo, useState} from 'react';
import {
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
import {colors} from '../theme/colors';
import PrimaryButton from '../components/PrimaryButton';
import {FREE_MESSAGE_LIMIT} from '../subscription/limits';
import {useSubscriptionStore} from '../store/useSubscriptionStore';
import UpgradeModal from '../components/UpgradeModal';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const createAssistantReply = (prompt: string, count: number): string => {
  if (!prompt.trim()) {
    return '我還沒收到新的問題喔！';
  }
  if (count % 3 === 0) {
    return '建議你先確認價格與庫存，再評估是否要下單。';
  }
  if (count % 2 === 0) {
    return `這裡幫你整理：${prompt.trim()}，可以關注近期折扣資訊。`;
  }
  return `收到！我會記錄你的需求：「${prompt.trim()}」。`;
};

const HomeScreen: React.FC<Props> = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '嗨，我是 DealMaster Copilot！有任何找折扣、比價的問題都可以問我。',
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const plan = useSubscriptionStore(state => state.plan);
  const canUseFeature = useSubscriptionStore(state => state.canUseFeature);
  const recordUsage = useSubscriptionStore(state => state.recordUsage);
  const remainingMessages = useSubscriptionStore(
    state => state.remainingQuota('aiMessages'),
  );
  const setPlan = useSubscriptionStore(state => state.setPlan);

  const quotaLabel = useMemo(() => {
    if (plan !== 'free') {
      return null;
    }
    const remaining = Math.max(0, Math.floor(remainingMessages));
    return `本月剩餘 ${remaining}/${FREE_MESSAGE_LIMIT}`;
  }, [plan, remainingMessages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    const hasQuota = canUseFeature('aiMessages');
    if (!hasQuota) {
      setShowUpgradeModal(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    setTimeout(() => {
      recordUsage('aiMessages');
      setMessages(prev => {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: createAssistantReply(trimmed, prev.filter(m => m.role === 'assistant').length + 1),
        };
        return [...prev, assistantMessage];
      });
      setIsGenerating(false);
    }, 600);
  }, [canUseFeature, input, recordUsage]);

  const renderMessage = useCallback(({item}: {item: ChatMessage}) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}>
        <Text
          style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
          {item.content}
        </Text>
      </View>
    );
  }, []);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const lockedFeatures = useMemo(
    () => [
      {
        id: 'export',
        title: '匯出報告',
        description: '升級 Pro 後即可下載完整分析報告。',
      },
      {
        id: 'branch',
        title: '分支深挖',
        description: '即將推出，敬請期待後續任務。',
      },
    ],
    [],
  );

  const handleUpgrade = useCallback(() => {
    setPlan('pro');
    setShowUpgradeModal(false);
  }, [setPlan]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>DealMaster Copilot</Text>
          <Text style={styles.subtitle}>你的 AI 交易助理</Text>
        </View>
        {quotaLabel && <Text style={styles.quota}>{quotaLabel}</Text>}
      </View>
      <FlatList
        data={messages}
        keyExtractor={keyExtractor}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="輸入你的問題..."
            placeholderTextColor={colors.muted}
            value={input}
            editable={!isGenerating}
            onChangeText={setInput}
            multiline
          />
          <PrimaryButton
            title={isGenerating ? '生成中...' : '送出'}
            onPress={handleSend}
            disabled={isGenerating || !input.trim()}
            style={styles.sendButton}
          />
        </View>
        <View style={styles.lockedContainer}>
          {lockedFeatures.map(feature => (
            <View key={feature.id} style={styles.lockedCard}>
              <Text style={styles.lockedTitle}>🔒 {feature.title}</Text>
              <Text style={styles.lockedDescription}>{feature.description}</Text>
            </View>
          ))}
        </View>
      </KeyboardAvoidingView>
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
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
  subtitle: {
    marginTop: 4,
    color: colors.muted,
  },
  quota: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  messageBubble: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: colors.text,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: colors.white,
  },
  assistantText: {
    color: colors.text,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.white,
    color: colors.text,
    shadowColor: colors.text,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  sendButton: {
    minWidth: 96,
  },
  lockedContainer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 12,
  },
  lockedCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  lockedDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default HomeScreen;

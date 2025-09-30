import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import PrimaryButton from '../components/PrimaryButton';
import {colors} from '../theme/colors';
import {RootStackParamList} from '../navigation/types';
import {createChat, getChatsWithLatestMessage} from '../storage/chatRepository';
import {ChatWithLatestMessage} from '../storage/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatList'>;

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const ChatListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chats, setChats] = useState<ChatWithLatestMessage[]>([]);

  const loadChats = useCallback(async () => {
    try {
      setLoading(true);
      const records = await getChatsWithLatestMessage();
      setChats(records);
    } catch (error) {
      console.error('Failed to load chats', error);
      Alert.alert('載入失敗', '無法取得對話列表，請稍後再試。');
    } finally {
      setLoading(false);
      setRefreshing(false);
import PrimaryButton from '../components/PrimaryButton';
import {RootStackParamList} from '../navigation/types';
import {chatMemory, type ChatSession} from '../services/chatMemory';
import {colors} from '../theme/colors';

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString();
};

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

const ChatListScreen: React.FC<Props> = ({navigation}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      await chatMemory.initialize();
      const data = await chatMemory.listSessions();
      setSessions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadChats();
  }, [loadChats]);

  const handleCreateChat = useCallback(async () => {
    try {
      const newChat = await createChat(`新的對話 ${new Date().toLocaleTimeString()}`);
      await loadChats();
      navigation.navigate('Chat', {chatId: newChat.id, title: newChat.title});
    } catch (error) {
      console.error('Failed to create chat', error);
      Alert.alert('建立失敗', '暫時無法建立新對話，請稍後再試。');
    }
  }, [loadChats, navigation]);

  const renderItem = ({item}: {item: ChatWithLatestMessage}) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => navigation.navigate('Chat', {chatId: item.id, title: item.title})}>
      <Text style={styles.chatTitle}>{item.title}</Text>
      <Text style={styles.chatSubtitle} numberOfLines={2}>
        {item.latestMessage?.content ?? '尚未開始對話'}
      </Text>
      <Text style={styles.chatTimestamp}>{formatTimestamp(item.updated_at)}</Text>
    </TouchableOpacity>
  );

  if (loading && chats.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>載入對話中…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.actionBar}>
        <PrimaryButton title="建立新對話" onPress={handleCreateChat} />
      </View>
      <FlatList
        data={chats}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>目前尚無對話，先建立一個吧！</Text>}
      />
      loadSessions().catch(() => undefined);
    }, [loadSessions]),
  );

  const handleCreateSession = useCallback(async () => {
    await chatMemory.initialize();
    const session = await chatMemory.createSession();
    navigation.navigate('Chat', {
      sessionId: session.id,
      title: session.title,
    });
  }, [navigation]);

  const handleSelectSession = useCallback(
    (session: ChatSession) => {
      navigation.navigate('Chat', {
        sessionId: session.id,
        title: session.title,
      });
    },
    [navigation],
  );

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await chatMemory.deleteSession(sessionId);
    setSessions(prev => prev.filter(session => session.id !== sessionId));
  }, []);

  const renderItem = ({item}: {item: ChatSession}) => (
    <TouchableOpacity
      style={styles.sessionRow}
      onPress={() => handleSelectSession(item)}
      accessibilityRole="button">
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionTitle}>{item.title}</Text>
        <Text style={styles.sessionTimestamp}>{formatTimestamp(item.updatedAt)}</Text>
      </View>
      <Text style={styles.sessionPreview} numberOfLines={2}>
        {item.messages
          .filter(message => message.role !== 'system')
          .map(message => message.content)
          .join(' \u2022 ') || 'No messages yet.'}
      </Text>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteSession(item.id)}
        accessibilityRole="button">
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Chat History</Text>
        <PrimaryButton title="New Chat" onPress={handleCreateSession} />
      </View>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            sessions.length === 0 ? styles.emptyContainer : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptySubtitle}>
                Start a new conversation to see it appear in your history.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  actionBar: {
    padding: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  chatCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  chatSubtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 6,
    minHeight: 40,
  },
  chatTimestamp: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 40,
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  sessionRow: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.text,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  sessionTimestamp: {
    fontSize: 12,
    color: colors.muted,
  },
  sessionPreview: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 12,
  },
  deleteButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  deleteText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 12,
  },
});

export default ChatListScreen;

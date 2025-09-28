import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
import {createChat, getChats, getLatestMessageForChat} from '../storage/chatRepository';
import {ChatRecord} from '../storage/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatList'>;

type ListItem = ChatRecord & {
  latestMessage?: string;
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const ChatListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chats, setChats] = useState<ListItem[]>([]);

  const loadChats = useCallback(async () => {
    try {
      setLoading(true);
      const chatRecords = await getChats();
      const items: ListItem[] = [];
      for (const chat of chatRecords) {
        const latest = await getLatestMessageForChat(chat.id);
        items.push({
          ...chat,
          latestMessage: latest?.content,
        });
      }
      setChats(items);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    const newChat = await createChat(`新的對話 ${new Date().toLocaleTimeString()}`);
    await loadChats();
    navigation.navigate('Chat', {chatId: newChat.id, title: newChat.title});
  }, [loadChats, navigation]);

  const renderItem = ({item}: {item: ListItem}) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => navigation.navigate('Chat', {chatId: item.id, title: item.title})}>
      <Text style={styles.chatTitle}>{item.title}</Text>
      <Text style={styles.chatSubtitle} numberOfLines={2}>
        {item.latestMessage ?? '尚未開始對話'}
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
  },
});

export default ChatListScreen;


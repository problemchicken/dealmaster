import React, {useMemo, useState} from 'react';
import React from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
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
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {colors} from '../theme/colors';
import PrimaryButton from '../components/PrimaryButton';
import {Deal, useDeals} from '../hooks/useDeals';
import {useAuthStore} from '../store/useAuthStore';
import CopilotChat from '../components/CopilotChat';
import {useSubscriptionStore} from '../store/useSubscriptionStore';
import {FREE_MESSAGE_LIMIT} from '../subscription/limits';
import PrimaryButton from '../components/PrimaryButton';
import {colors} from '../theme/colors';
import {useAuthStore} from '../store/useAuthStore';
import {RootStackParamList} from '../navigation/types';
import {useDeals} from '../hooks/useDeals';
import type {Deal} from '../hooks/useDeals';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type HomeTab = 'copilot' | 'deals';

const TABS: Array<{id: HomeTab; label: string}> = [
  {id: 'copilot', label: 'Copilot'},
  {id: 'deals', label: 'Deals'},
];

const HomeScreen: React.FC<Props> = ({navigation}) => {
  const logout = useAuthStore(state => state.logout);
  const {deals, loading, refreshing, refresh} = useDeals();
  const [activeTab, setActiveTab] = useState<HomeTab>('copilot');
  const plan = useSubscriptionStore(state => state.plan);
  const remainingMessages = useSubscriptionStore(state =>
    state.remainingQuota('aiMessages'),
  );

  const remainingLabel = useMemo(() => {
    if (plan !== 'free') {
      return null;
    }
    return `本月剩餘 ${Math.max(0, Math.floor(remainingMessages))}/${FREE_MESSAGE_LIMIT}`;
  }, [plan, remainingMessages]);

  const handleLogout = () => {
    logout();
  };

  const renderDeal = ({item}: {item: Deal}) => (
    <View style={styles.dealCard}>
      <Text style={styles.dealTitle}>{item.title}</Text>
      <Text style={styles.dealDescription}>{item.description}</Text>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabBar}>
      {TABS.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabButton, isActive && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
            accessibilityRole="button"
            accessibilityState={{selected: isActive}}>
            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderDeals = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Fetching deals...</Text>
        </View>
      );
    }

    return (
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{"Today's Deals"}</Text>
        <PrimaryButton title="Settings" onPress={() => navigation.navigate('Settings')} />
      </View>
      <PrimaryButton
        title="開始 AI 對話"
        onPress={() => navigation.navigate('ChatList')}
        style={styles.chatButton}
      />
      <FlatList
        data={deals}
        keyExtractor={item => item.id}
        renderItem={renderDeal}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No deals available right now.</Text>
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>DealMaster</Text>
          {remainingLabel && activeTab === 'copilot' && (
            <Text style={styles.quotaLabel}>{remainingLabel}</Text>
          )}
        </View>
        <PrimaryButton
          title="Settings"
          onPress={() => navigation.navigate('Settings')}
        />
      </View>
      {renderTabs()}
      <View style={styles.content}>
        {activeTab === 'copilot' ? <CopilotChat /> : renderDeals()}
      </View>
      <PrimaryButton
        title="Log Out"
        onPress={handleLogout}
        style={styles.logoutButton}
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
  quotaLabel: {
    marginTop: 6,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dealCard: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: colors.text,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  dealDescription: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 6,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: colors.muted,
  },
  logoutButton: {
    margin: 20,
  },
  chatButton: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.muted,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: colors.white,
    shadowColor: colors.text,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: colors.text,
  },
});

export default HomeScreen;

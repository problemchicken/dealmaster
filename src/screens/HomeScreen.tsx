import React, {useEffect, useMemo} from 'react';
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
import PrimaryButton from '../components/PrimaryButton';
import {colors} from '../theme/colors';
import {useAuthStore} from '../store/useAuthStore';
import {RootStackParamList} from '../navigation/types';
import {useDeals} from '../hooks/useDeals';
import type {Deal} from '../hooks/useDeals';
import UpgradeModal from '../components/UpgradeModal';
import {useSubscriptionStore} from '../store/useSubscriptionStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({navigation}) => {
  const logout = useAuthStore(state => state.logout);
  const {deals, loading, refreshing, refresh} = useDeals();
  const {
    plan,
    monthlyQuota,
    usedQuota,
    upgradeModalVisible,
    loadSubscription,
    openUpgradeModal,
    closeUpgradeModal,
    setPlan,
  } = useSubscriptionStore(state => ({
    plan: state.plan,
    monthlyQuota: state.monthlyQuota,
    usedQuota: state.usedQuota,
    upgradeModalVisible: state.upgradeModalVisible,
    loadSubscription: state.loadSubscription,
    openUpgradeModal: state.openUpgradeModal,
    closeUpgradeModal: state.closeUpgradeModal,
    setPlan: state.setPlan,
  }));

  useEffect(() => {
    loadSubscription().catch(error => {
      console.error('Failed to hydrate subscription state', error);
    });
  }, [loadSubscription]);

  const quotaInfo = useMemo(() => {
    if (plan === 'pro') {
      return {
        isQuotaExceeded: false,
        remainingQuotaLabel: 'Unlimited chats with Pro plan',
        bannerStyle: styles.subscriptionBannerPro,
        title: 'Pro plan active',
        message: 'Enjoy unlimited AI chats and premium deal alerts.',
      } as const;
    }

    const remaining = Math.max(monthlyQuota - usedQuota, 0);
    const isQuotaExceeded = remaining === 0;
    return {
      isQuotaExceeded,
      remainingQuotaLabel: isQuotaExceeded
        ? "You've reached this month's free AI limit."
        : `You can start ${remaining} more AI request${remaining === 1 ? '' : 's'} this month.`,
      bannerStyle: isQuotaExceeded
        ? styles.subscriptionBannerWarning
        : styles.subscriptionBannerInfo,
      title: isQuotaExceeded ? 'Monthly free limit reached' : 'Free plan usage',
      message: isQuotaExceeded
        ? 'Upgrade to keep using DealMaster AI this month.'
        : 'Upgrade to Pro for unlimited AI chats and faster deal insights.',
    } as const;
  }, [plan, monthlyQuota, usedQuota]);

  const handleLogout = () => {
    logout();
  };

  const handleNavigateToChat = () => {
    if (quotaInfo.isQuotaExceeded) {
      openUpgradeModal();
      return;
    }
    navigation.navigate('ChatList');
  };

  const handleUpgrade = async () => {
    await setPlan('pro');
    closeUpgradeModal();
  };

  const renderItem = ({item}: {item: Deal}) => (
    <View style={styles.dealCard}>
      <Text style={styles.dealTitle}>{item.title}</Text>
      <Text style={styles.dealDescription}>{item.description}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Fetching deals...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{"Today's Deals"}</Text>
        <PrimaryButton title="Settings" onPress={() => navigation.navigate('Settings')} />
      </View>
      <View style={[styles.subscriptionBanner, quotaInfo.bannerStyle]}>
        <Text style={styles.subscriptionTitle}>{quotaInfo.title}</Text>
        <Text style={styles.subscriptionMessage}>{quotaInfo.remainingQuotaLabel}</Text>
        <Text style={styles.subscriptionMessageSecondary}>{quotaInfo.message}</Text>
        {plan === 'free' ? (
          <TouchableOpacity onPress={openUpgradeModal} style={styles.upgradeLink}>
            <Text style={styles.upgradeLinkText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <PrimaryButton
        title="開始 AI 對話"
        onPress={handleNavigateToChat}
        disabled={quotaInfo.isQuotaExceeded}
        style={styles.chatButton}
      />
      {quotaInfo.isQuotaExceeded ? (
        <Text style={styles.quotaHint}>
          Upgrade your plan to keep using DealMaster AI this month.
        </Text>
      ) : null}
      <FlatList
        data={deals}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No deals available right now.</Text>
        }
      />
      <PrimaryButton title="Log Out" onPress={handleLogout} style={styles.logoutButton} />
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
  quotaHint: {
    marginHorizontal: 20,
    color: colors.primary,
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
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
  subscriptionBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  subscriptionBannerInfo: {
    backgroundColor: '#e0f2fe',
  },
  subscriptionBannerWarning: {
    backgroundColor: '#fee2e2',
  },
  subscriptionBannerPro: {
    backgroundColor: '#dcfce7',
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subscriptionMessage: {
    fontSize: 14,
    color: colors.text,
  },
  subscriptionMessageSecondary: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  upgradeLink: {
    marginTop: 12,
  },
  upgradeLinkText: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default HomeScreen;

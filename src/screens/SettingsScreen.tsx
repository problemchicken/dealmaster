import React, {useCallback, useEffect, useMemo, useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {colors} from '../theme/colors';
import {useAuthStore} from '../store/useAuthStore';
import PrimaryButton from '../components/PrimaryButton';
import {RootStackParamList} from '../navigation/types';
import {useSettingsStore} from '../store/useSettingsStore';
import {getEnvVar} from '../utils/env';
import {useSubscriptionStore} from '../store/useSubscriptionStore';
import UpgradeModal from '../components/UpgradeModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const API_KEY_NAME = 'GPT5_API_KEY';

const SettingsScreen: React.FC<Props> = ({navigation}) => {
  const logout = useAuthStore(state => state.logout);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const envOverrides = useSettingsStore(state => state.envOverrides);
  const setEnvVar = useSettingsStore(state => state.setEnvVar);
  const savedApiKey = envOverrides[API_KEY_NAME] ?? '';
  const [apiKeyInput, setApiKeyInput] = useState(savedApiKey);
  const {
    plan,
    dailyQuota,
    usedQuota,
    loadSubscription,
    setPlan,
    resetDailyUsage,
    upgradeModalVisible,
    openUpgradeModal,
    closeUpgradeModal,
  } = useSubscriptionStore(state => ({
    plan: state.plan,
    dailyQuota: state.dailyQuota,
    usedQuota: state.usedQuota,
    loadSubscription: state.loadSubscription,
    setPlan: state.setPlan,
    resetDailyUsage: state.resetDailyUsage,
    upgradeModalVisible: state.upgradeModalVisible,
    openUpgradeModal: state.openUpgradeModal,
    closeUpgradeModal: state.closeUpgradeModal,
  }));

  useEffect(() => {
    setApiKeyInput(savedApiKey);
  }, [savedApiKey]);

  useEffect(() => {
    loadSubscription().catch(error => {
      console.error('Failed to hydrate subscription state', error);
    });
  }, [loadSubscription]);

  const resolvedApiKey = useMemo(() => {
    const override = envOverrides[API_KEY_NAME] ?? envOverrides.OPENAI_API_KEY;
    if (override) {
      return override;
    }
    return getEnvVar(API_KEY_NAME) ?? getEnvVar('OPENAI_API_KEY');
  }, [envOverrides]);

  const handleApiKeyChange = (value: string) => {
    setApiKeyInput(value);
    const normalized = value.trim();
    setEnvVar(API_KEY_NAME, normalized.length > 0 ? normalized : undefined);
  };

  const handleUpgrade = useCallback(async () => {
    await setPlan('pro');
    await resetDailyUsage();
    closeUpgradeModal();
  }, [closeUpgradeModal, resetDailyUsage, setPlan]);

  const handleDowngrade = useCallback(async () => {
    await setPlan('free');
    await resetDailyUsage();
  }, [resetDailyUsage, setPlan]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>Push Notifications</Text>
            <Text style={styles.settingDescription}>
              Stay up to date with deals tailored for you.
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{true: colors.primary, false: '#cbd5f5'}}
          />
        </View>

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>Biometric Login</Text>
            <Text style={styles.settingDescription}>
              Use Touch ID or Face ID for faster sign-in.
            </Text>
          </View>
          <Switch
            value={biometricsEnabled}
            onValueChange={setBiometricsEnabled}
            trackColor={{true: colors.primary, false: '#cbd5f5'}}
          />
        </View>

        <View style={styles.subscriptionCard}>
          <Text style={styles.settingTitle}>Subscription</Text>
          <Text style={styles.subscriptionPlanLabel}>
            {plan === 'pro' ? 'Pro plan' : 'Free plan'}
          </Text>
          <Text style={styles.subscriptionUsage}>
            {plan === 'pro'
              ? 'Unlimited AI chats and real-time deal alerts.'
              : `Used ${usedQuota} of ${dailyQuota} free chats today.`}
          </Text>
          <Text style={styles.subscriptionHint}>
            Your quota refreshes every day at midnight local time.
          </Text>
          {plan === 'free' ? (
            <PrimaryButton
              title="Upgrade to Pro"
              onPress={openUpgradeModal}
              style={styles.subscriptionButton}
            />
          ) : (
            <PrimaryButton
              title="Switch to Free plan"
              onPress={handleDowngrade}
              style={styles.subscriptionButton}
            />
          )}
        </View>

        <View style={styles.secretCard}>
          <Text style={styles.settingTitle}>GPT-5 API Key</Text>
          <Text style={styles.settingDescription}>
            Store your API key locally to unlock the DealMaster chat assistant.
          </Text>
          <TextInput
            value={apiKeyInput}
            onChangeText={handleApiKeyChange}
            placeholder="sk-..."
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.secretInput}
            accessibilityLabel="GPT-5 API key input"
          />
          <Text style={styles.helperText}>
            {resolvedApiKey
              ? 'Your API key is ready to be used for chat requests.'
              : 'Add an API key above to enable AI-powered replies.'}
          </Text>
        </View>

        <PrimaryButton
          title="View Deals"
          onPress={() => navigation.navigate('Home')}
          style={styles.actionButton}
        />
        <PrimaryButton
          title="Log Out"
          onPress={logout}
          style={styles.actionButton}
        />
      </ScrollView>
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
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 24,
  },
  settingRow: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.text,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
    width: 220,
  },
  secretCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.text,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  secretInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#f8fafc',
  },
  helperText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.muted,
  },
  subscriptionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.text,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  subscriptionPlanLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  subscriptionUsage: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 6,
  },
  subscriptionHint: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
  },
  subscriptionButton: {
    marginTop: 16,
  },
  actionButton: {
    marginTop: 12,
  },
});

export default SettingsScreen;

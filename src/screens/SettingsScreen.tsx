import React, {useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {colors} from '../theme/colors';
import {useAuthStore} from '../store/useAuthStore';
import PrimaryButton from '../components/PrimaryButton';
import {RootStackParamList} from '../navigation/types';
import {useSettingsStore} from '../store/useSettingsStore';
import {getEnvVar} from '../utils/env';

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

  useEffect(() => {
    setApiKeyInput(savedApiKey);
  }, [savedApiKey]);

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
  actionButton: {
    marginTop: 12,
  },
});

export default SettingsScreen;

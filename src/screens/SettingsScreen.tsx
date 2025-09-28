import React, {useEffect, useState} from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {colors} from '../theme/colors';
import {useAuthStore} from '../store/useAuthStore';
import PrimaryButton from '../components/PrimaryButton';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useAiSettingsStore} from '../store/useAiSettingsStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const SettingsScreen: React.FC<Props> = ({navigation}) => {
  const logout = useAuthStore(state => state.logout);
  const {apiKey, setApiKey, clearApiKey} = useAiSettingsStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const envKeyAvailable = Boolean(process.env.GPT5_API_KEY);

  useEffect(() => {
    setApiKeyInput(apiKey ?? '');
  }, [apiKey]);

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      Alert.alert('API Key Required', 'Please enter your GPT-5 API key before saving.');
      return;
    }

    setApiKey(trimmed);
    setStatusMessage('API key saved securely on this device.');
  };

  const handleClearApiKey = () => {
    clearApiKey();
    setApiKeyInput('');
    setStatusMessage('Cleared the custom API key. Falling back to environment configuration.');
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

        <View style={styles.settingCard}>
          <Text style={styles.settingTitle}>GPT-5 API Key</Text>
          <Text style={[styles.settingDescription, styles.settingDescriptionWide]}>
            Your key is encrypted and stored locally. Clear the field to use the environment-provided key.
          </Text>
          <TextInput
            value={apiKeyInput}
            onChangeText={value => {
              setApiKeyInput(value);
              setStatusMessage(null);
            }}
            placeholder="sk-..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            secureTextEntry
            style={styles.input}
          />
          <PrimaryButton title="Save API Key" onPress={handleSaveApiKey} style={styles.inputButton} />
          <TouchableOpacity style={styles.clearButton} onPress={handleClearApiKey}>
            <Text style={styles.clearButtonText}>Clear custom key</Text>
          </TouchableOpacity>
          {statusMessage ? (
            <Text style={styles.statusMessage}>{statusMessage}</Text>
          ) : null}
          {envKeyAvailable && !apiKey ? (
            <Text style={styles.statusMessage}>
              Using the GPT5_API_KEY environment variable until a custom key is saved.
            </Text>
          ) : null}
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
  settingCard: {
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
  settingDescriptionWide: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    marginTop: 16,
  },
  inputButton: {
    marginTop: 16,
  },
  clearButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearButtonText: {
    color: colors.error,
    fontWeight: '600',
  },
  statusMessage: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 13,
  },
  actionButton: {
    marginTop: 12,
  },
});

export default SettingsScreen;

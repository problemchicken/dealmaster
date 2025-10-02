import React, {useCallback, useMemo, useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import {colors} from '../theme/colors';
import type {RootStackParamList} from '../navigation/types';
import {useSubscriptionStore} from '../store/useSubscriptionStore';
import UpgradeModal from '../components/UpgradeModal';
import {track} from '../services/telemetry';

type Props = NativeStackScreenProps<RootStackParamList, 'OcrConfirm'>;

const OcrConfirmScreen: React.FC<Props> = ({route, navigation}) => {
  const {extractedText, sessionId, title} = route.params;
  const [text, setText] = useState(extractedText);
  const [error, setError] = useState<string | null>(null);
  const {
    plan,
    consumeOcr,
    canUseOcr,
    upgradeModalVisible,
    openUpgradeModal,
    closeUpgradeModal,
    setPlan,
  } = useSubscriptionStore(state => ({
    plan: state.plan,
    consumeOcr: state.consumeOcr,
    canUseOcr: state.canUseOcr,
    upgradeModalVisible: state.upgradeModalVisible,
    openUpgradeModal: state.openUpgradeModal,
    closeUpgradeModal: state.closeUpgradeModal,
    setPlan: state.setPlan,
  }));

  const trimmed = useMemo(() => text.trim(), [text]);
  const isSubmitDisabled = trimmed.length === 0;

  const handleChange = (value: string) => {
    if (error) {
      setError(null);
    }
    setText(value);
  };

  const handleSend = async () => {
    if (trimmed.length === 0) {
      setError('未擷取到文字，請重試或選擇其他圖片。');
      return;
    }

    if (!canUseOcr()) {
      track('quota_block', {feature: 'ocr'});
      openUpgradeModal();
      navigation.goBack();
      return;
    }

    let consumed = false;
    try {
      consumed = await consumeOcr();
    } catch (err) {
      console.error('Failed to record OCR usage', err);
      setError('無法更新使用次數，請稍後再試。');
      return;
    }

    if (!consumed) {
      track('quota_block', {feature: 'ocr'});
      openUpgradeModal();
      navigation.goBack();
      return;
    }

    navigation.navigate('Chat', {
      sessionId,
      title,
      pendingMessage: trimmed,
      pendingMessageSource: 'ocr',
    });
    navigation.goBack();
  };

  const handleUpgrade = useCallback(async () => {
    await setPlan('pro');
    closeUpgradeModal();
  }, [closeUpgradeModal, setPlan]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>抽取的文字</Text>
        <Text style={styles.description}>
          請確認下方內容是否正確，必要時可自行調整。
        </Text>
        <View style={styles.inputContainer}>
          <TextInput
            value={text}
            onChangeText={handleChange}
            multiline
            textAlignVertical="top"
            placeholder="未能擷取到任何文字，請返回重新選擇。"
            style={styles.textInput}
            accessibilityLabel="OCR text preview"
          />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!error && isSubmitDisabled ? (
          <Text style={styles.helperText}>
            如果沒有成功擷取文字，請返回重新選擇圖片。
          </Text>
        ) : null}
      <PrimaryButton
        title="送出"
        onPress={handleSend}
        disabled={isSubmitDisabled}
        style={styles.submitButton}
      />
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.secondaryAction}>
        <Text style={styles.secondaryActionText}>重新選擇圖片</Text>
      </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#4a4a4a',
    marginBottom: 16,
  },
  inputContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 220,
    padding: 16,
    marginBottom: 12,
  },
  textInput: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
    minHeight: 188,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    marginBottom: 8,
  },
  helperText: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 12,
  },
  secondaryAction: {
    marginTop: 16,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OcrConfirmScreen;

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {RootStackParamList} from '../navigation/types';
import PrimaryButton from '../components/PrimaryButton';
import {
  addSpeechListener,
  getPermissionStatus,
  open,
  requestPermission,
  send,
  stop,
  type SpeechPermissionStatus,
} from '../services/speech';
import {submitSpeechNegotiationSample} from '../services/speechNegotiation';
import {useSpeechDebugStore} from '../store/useSpeechDebugStore';
import {colors} from '../theme/colors';
import {sampleCommandAudioBase64} from '../fixtures/sampleAudio';

const STATUS_LABEL: Record<'idle' | 'listening' | 'processing', string> = {
  idle: '待命',
  listening: '聆聽中',
  processing: '產生策略中',
};

type Props = NativeStackScreenProps<RootStackParamList, 'SpeechTest'>;

const SpeechTestScreen: React.FC<Props> = () => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing'>(
    'idle',
  );
  const [permissionStatus, setPermissionStatus] =
    useState<SpeechPermissionStatus>('unavailable');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    isRecording,
    lastPartialTranscript,
    lastFinalTranscript,
    lastRequest,
    lastResponse,
    lastStrategy,
    lastError,
    telemetryEvents,
    setRecording,
    setPartialTranscript,
    setFinalTranscript,
    setRequest,
    setResponse,
    setError,
  } = useSpeechDebugStore(state => ({
    isRecording: state.isRecording,
    lastPartialTranscript: state.lastPartialTranscript,
    lastFinalTranscript: state.lastFinalTranscript,
    lastRequest: state.lastRequest,
    lastResponse: state.lastResponse,
    lastStrategy: state.lastStrategy,
    lastError: state.lastError,
    telemetryEvents: state.telemetryEvents,
    setRecording: state.setRecording,
    setPartialTranscript: state.setPartialTranscript,
    setFinalTranscript: state.setFinalTranscript,
    setRequest: state.setRequest,
    setResponse: state.setResponse,
    setError: state.setError,
  }));

  const submitNegotiation = useCallback(
    async (transcript: string) => {
      const trimmed = transcript.trim();
      if (!trimmed) {
        setStatus('idle');
        return;
      }
      setIsSubmitting(true);
      const request = {
        audioBase64: sampleCommandAudioBase64.replace(/\s+/g, ''),
        metadata: {
          transcript: trimmed,
          source: 'speech-test-screen',
        },
      } as const;
      setRequest(request);
      try {
        const response = await submitSpeechNegotiationSample(request);
        setResponse(response);
        setStatus('idle');
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
        setStatus('idle');
      } finally {
        setIsSubmitting(false);
      }
    },
    [setError, setRequest, setResponse, setStatus],
  );

  useEffect(() => {
    let mounted = true;
    getPermissionStatus()
      .then(currentStatus => {
        if (mounted) {
          setPermissionStatus(currentStatus);
        }
      })
      .catch(() => {
        if (mounted) {
          setPermissionStatus('unavailable');
        }
      });
    const removePartial = addSpeechListener('stt_partial', payload => {
      setPartialTranscript(payload.text);
      setRecording(true);
      setStatus('listening');
    });
    const removeFinal = addSpeechListener('stt_final', payload => {
      setFinalTranscript(payload.text);
      setRecording(false);
      setStatus('processing');
      send(payload.text).catch(error => {
        console.warn('Failed to send telemetry for transcript', error);
      });
      submitNegotiation(payload.text).catch(error => {
        console.warn('Failed to submit negotiation sample', error);
      });
    });
    const removeError = addSpeechListener('stt_error', payload => {
      setRecording(false);
      setStatus('idle');
      setError(payload.message ?? 'Speech recognition failed');
    });
    return () => {
      mounted = false;
      removePartial();
      removeFinal();
      removeError();
    };
  }, [setError, setPartialTranscript, setRecording, setFinalTranscript, submitNegotiation]);

  const handleStart = useCallback(async () => {
    setError(null);
    const statusBefore = await getPermissionStatus();
    setPermissionStatus(statusBefore);
    let statusToUse = statusBefore;
    if (statusBefore !== 'granted') {
      const requested = await requestPermission();
      setPermissionStatus(requested);
      statusToUse = requested;
    }
    if (statusToUse !== 'granted') {
      setError('需要麥克風與語音辨識權限');
      return;
    }
    try {
      await open();
      setRecording(true);
      setStatus('listening');
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setStatus('idle');
    }
  }, [setError, setRecording]);

  const handleStop = useCallback(async () => {
    try {
      await stop();
    } catch (error) {
      console.warn('Failed to stop speech recognizer', error);
    } finally {
      setRecording(false);
      setStatus('idle');
    }
  }, [setRecording]);

  const statusLabel = STATUS_LABEL[status];

  const strategySummary = useMemo(() => {
    if (!lastStrategy) {
      return '尚未收到策略回覆';
    }
    return `${lastStrategy.strategy}\n情緒分數：${lastStrategy.emotionScore.toFixed(
      2,
    )}\nTone：${lastStrategy.tone}`;
  }, [lastStrategy]);

  const telemetryElements = useMemo(
    () =>
      telemetryEvents.map(event => (
        <View key={event.id} style={styles.telemetryItem}>
          <Text style={styles.telemetryTitle}>
            {new Date(event.timestamp).toLocaleTimeString()} · {event.name}
          </Text>
          <Text style={styles.telemetryPayload}>
            {JSON.stringify(event.payload ?? {}, null, 2)}
          </Text>
        </View>
      )),
    [telemetryEvents],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Speech Debug / QA</Text>
      <Text style={styles.sectionLabel}>錄製狀態</Text>
      <View style={styles.statusRow}>
        <Text style={styles.statusValue}>狀態：{statusLabel}</Text>
        <Text style={styles.statusValue}>
          權限：{permissionStatus ?? 'unknown'}
        </Text>
      </View>
      <View style={styles.buttonRow}>
        <PrimaryButton
          title="開始錄音"
          onPress={handleStart}
          disabled={isRecording || isSubmitting}
          style={[styles.button, styles.buttonStart]}
        />
        <PrimaryButton
          title="結束"
          onPress={handleStop}
          disabled={!isRecording}
          style={[styles.button, styles.buttonEnd]}
        />
      </View>
      {isSubmitting ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>產生策略中...</Text>
        </View>
      ) : null}
      <Text style={styles.sectionLabel}>即時語音</Text>
      <Text style={styles.valueBox}>
        Partial：{lastPartialTranscript ?? '（無）'}
      </Text>
      <Text style={styles.valueBox}>Final：{lastFinalTranscript ?? '（無）'}</Text>
      <Text style={styles.sectionLabel}>策略建議</Text>
      <Text style={styles.valueBox}>{strategySummary}</Text>
      <Text style={styles.sectionLabel}>最後一次請求</Text>
      <Text style={styles.valueBox}>
        {lastRequest ? JSON.stringify(lastRequest, null, 2) : '尚未送出'}
      </Text>
      <Text style={styles.sectionLabel}>最後一次回覆</Text>
      <Text style={styles.valueBox}>
        {lastResponse ? JSON.stringify(lastResponse, null, 2) : '尚未收到'}
      </Text>
      {lastError ? (
        <Text style={styles.errorText}>錯誤：{lastError}</Text>
      ) : null}
      <Text style={styles.sectionLabel}>最近 Telemetry</Text>
      {telemetryElements.length > 0 ? (
        <View style={styles.telemetryList}>{telemetryElements}</View>
      ) : (
        <Text style={styles.valueBox}>尚未收到 telemetry 事件</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    color: colors.text,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusValue: {
    fontSize: 14,
    color: colors.muted,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  button: {
    flex: 1,
  },
  buttonStart: {
    marginRight: 8,
  },
  buttonEnd: {
    marginLeft: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  loadingText: {
    marginLeft: 12,
    color: colors.muted,
  },
  valueBox: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
  },
  errorText: {
    marginTop: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  telemetryList: {
    gap: 12,
  },
  telemetryItem: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
  },
  telemetryTitle: {
    fontWeight: '600',
    marginBottom: 8,
    color: colors.text,
  },
  telemetryPayload: {
    color: colors.muted,
    fontFamily: 'Menlo',
    fontSize: 12,
  },
});

export default SpeechTestScreen;

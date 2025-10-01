import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {colors} from '../theme/colors';
import PrimaryButton from './PrimaryButton';

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
};

const UpgradeModal: React.FC<Props> = ({visible, onClose, onUpgrade}) => {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>升級至 DealMaster Pro</Text>
          <Text style={styles.description}>
            免費方案本月 10 次 AI 回覆已用罄。升級後即可享受不限次數的 Copilot 服務與進階工具。
          </Text>
          <View style={styles.pricingRow}>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>月付方案</Text>
              <Text style={styles.priceValue}>$9.99/月</Text>
            </View>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>年付方案</Text>
              <Text style={styles.priceValue}>$79.99/年</Text>
              <Text style={styles.priceNote}>• 優惠價，等同 $6.67/月</Text>
            </View>
          </View>
          <PrimaryButton title="立即升級" onPress={onUpgrade} style={styles.upgradeButton} />
          <Pressable onPress={onClose} style={styles.dismissButton}>
            <Text style={styles.dismissText}>暫不升級</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    shadowColor: colors.text,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    marginTop: 12,
    color: colors.muted,
    lineHeight: 20,
  },
  pricingRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  priceCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    backgroundColor: '#f8fbff',
  },
  priceLabel: {
    fontSize: 14,
    color: colors.muted,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  priceNote: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 12,
  },
  upgradeButton: {
    marginTop: 24,
  },
  dismissButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  dismissText: {
    color: colors.muted,
    fontSize: 14,
  },
});

export default UpgradeModal;

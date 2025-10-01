import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import PrimaryButton from './PrimaryButton';
import {colors} from '../theme/colors';
import type {SubscriptionPlan} from '../store/useSubscriptionStore';

type Props = {
  visible: boolean;
  plan: SubscriptionPlan;
  onClose: () => void;
  onUpgrade: () => void | Promise<void>;
};

const UpgradeModal: React.FC<Props> = ({visible, plan, onClose, onUpgrade}) => {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {plan === 'pro' ? 'You are on the Pro plan' : 'Upgrade to Pro'}
          </Text>
          <Text style={styles.description}>
            {plan === 'pro'
              ? 'Thanks for supporting DealMaster! Enjoy unlimited chats and exclusive deal alerts.'
              : 'Unlock unlimited AI chats and priority deal alerts with the Pro plan. Stay ahead with the best savings delivered instantly.'}
          </Text>
          {plan !== 'pro' ? (
            <PrimaryButton title="Upgrade now" onPress={onUpgrade} style={styles.ctaButton} />
          ) : null}
          <TouchableOpacity onPress={onClose} style={styles.dismissButton}>
            <Text style={styles.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: colors.white,
    padding: 24,
    shadowColor: colors.text,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 22,
  },
  ctaButton: {
    marginTop: 20,
  },
  dismissButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  dismissText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default UpgradeModal;

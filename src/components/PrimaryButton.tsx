import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import {colors} from '../theme/colors';

interface Props extends TouchableOpacityProps {
  title: string;
}

const PrimaryButton: React.FC<Props> = ({
  title,
  style,
  disabled,
  ...touchableProps
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        disabled ? styles.buttonDisabled : undefined,
        style,
      ]}
      disabled={disabled}
      {...touchableProps}>
      <Text style={[styles.text, disabled ? styles.textDisabled : undefined]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  textDisabled: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
});

export default PrimaryButton;

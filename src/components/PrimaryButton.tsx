import React from 'react';
import {StyleSheet, Text, TouchableOpacity, TouchableOpacityProps} from 'react-native';
import {colors} from '../theme/colors';

interface Props extends TouchableOpacityProps {
  title: string;
}

const PrimaryButton: React.FC<Props> = ({title, style, ...touchableProps}) => {
  return (
    <TouchableOpacity style={[styles.button, style]} {...touchableProps}>
      <Text style={styles.text}>{title}</Text>
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
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PrimaryButton;

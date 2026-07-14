import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { typography, radii, colors } from '../../theme';

export default function Badge({ icon, text, type = 'info', style }) {
  let bgColor, textColor;

  switch (type) {
    case 'success':
      bgColor = `${colors.success}20`; // 20% opacity hex
      textColor = colors.success;
      break;
    case 'danger':
      bgColor = `${colors.danger}20`;
      textColor = colors.danger;
      break;
    case 'primary':
      bgColor = `${colors.primary}20`;
      textColor = colors.primary;
      break;
    case 'info':
    default:
      bgColor = `${colors.info}20`;
      textColor = colors.info;
      break;
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }, style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, { color: textColor }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
  },
});

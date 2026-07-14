import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { colors, typography, radii } from '../../theme';

export default function NeumorphicInput({
  icon,
  style,
  ...props
}) {
  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <TextInput
        style={[styles.input, icon ? { paddingLeft: 48 } : { paddingLeft: 16 }]}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: colors.bgDark,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    overflow: 'hidden',
    // Fake inset shadow via border colors
    borderTopColor: colors.border,
    borderLeftColor: colors.border,
    borderBottomColor: colors.bgLight,
    borderRightColor: colors.bgLight,
  },
  icon: {
    position: 'absolute',
    left: 16,
    top: 14,
    zIndex: 1,
  },
  input: {
    height: 52,
    paddingRight: 16,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.text,
  },
});

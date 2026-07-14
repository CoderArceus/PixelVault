import React from 'react';
import { Pressable, Text, StyleSheet, Platform, View } from 'react-native';
import { colors, typography, radii } from '../../theme';

export default function NeumorphicButton({
  title,
  onPress,
  disabled,
  style,
  textStyle,
  icon,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => {
        let baseStyle = [styles.buttonBase, style];
        
        if (disabled) {
          baseStyle.push(styles.disabled);
          return baseStyle;
        }

        if (Platform.OS === 'ios') {
          return [
            styles.outerShadow,
            pressed ? styles.pressedOuter : null,
            style
          ];
        }

        // Android
        return [
          styles.androidButton,
          pressed ? styles.pressedAndroid : null,
          style
        ];
      }}
    >
      {({ pressed }) => (
        <View style={[
          styles.innerContainer,
          Platform.OS === 'ios' && !disabled ? styles.innerShadow : null,
          Platform.OS === 'ios' && pressed && !disabled ? styles.pressedInner : null
        ]}>
          <View style={styles.content}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text style={[styles.text, textStyle, disabled && styles.textDisabled]}>
              {title}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  disabled: {
    backgroundColor: colors.bgDark,
    elevation: 0,
    borderWidth: 0,
  },
  outerShadow: {
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    shadowColor: colors.bgLight,
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  innerShadow: {
    borderRadius: radii.md,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pressedOuter: {
    shadowOffset: { width: -2, height: -2 },
    shadowRadius: 4,
  },
  pressedInner: {
    shadowOffset: { width: 2, height: 2 },
    shadowRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  innerContainer: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  androidButton: {
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    elevation: 6,
  },
  pressedAndroid: {
    elevation: 2,
    backgroundColor: colors.primary,
    opacity: 0.9,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: '#ffffff',
  },
  textDisabled: {
    color: colors.textMuted,
  },
});

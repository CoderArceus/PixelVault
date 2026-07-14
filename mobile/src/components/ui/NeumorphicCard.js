import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { colors, radii } from '../../theme';

export default function NeumorphicCard({ children, style, radius = radii.lg }) {
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.outerShadow, { borderRadius: radius }, style]}>
        <View style={[styles.innerShadow, { borderRadius: radius }]}>
          <View style={[styles.container, { borderRadius: radius }]}>
            {children}
          </View>
        </View>
      </View>
    );
  }

  // Android fallback (elevation + pseudo inset highlight)
  return (
    <View style={[styles.androidContainer, { borderRadius: radius }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outerShadow: {
    shadowColor: colors.bgLight,
    shadowOffset: { width: -8, height: -8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    backgroundColor: colors.bg,
  },
  innerShadow: {
    shadowColor: colors.bgDark,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    backgroundColor: colors.bg,
  },
  container: {
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  androidContainer: {
    backgroundColor: colors.bg,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.bgLight,
    borderBottomColor: colors.borderMuted,
    borderRightColor: colors.borderMuted,
    overflow: 'hidden',
  },
});

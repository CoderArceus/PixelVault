import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import NeumorphicCard from './ui/NeumorphicCard';
import Badge from './ui/Badge';

export default function PostCard({ post, onPress, showDeletedBadge, pricePaid }) {
  const getStatusProps = () => {
    if (post.is_owner) return { text: 'Owned', type: 'success', icon: 'check-circle' };
    if (post.is_unlocked) return { text: 'Unlocked', type: 'info', icon: 'lock-open' };
    return { text: 'Locked Content', type: 'info', icon: 'lock' };
  };

  const status = getStatusProps();
  const isDeleted = post.status === 'deleted';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>
      <NeumorphicCard style={styles.card}>
        {/* Top bar overlay for lock status */}
        <View style={styles.overlayTop}>
          <Badge
            icon={<MaterialIcons name={status.icon} size={16} color={colors[status.type]} />}
            text={status.text}
            type={status.type}
            style={styles.statusBadge}
          />
        </View>

        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: post.preview_url || post.original_url }}
            style={[styles.image, !post.is_unlocked && !post.is_owner ? styles.imageLocked : null]}
            resizeMode="cover"
          />
          {/* Centered lock icon for locked posts */}
          {!post.is_unlocked && !post.is_owner && (
            <View style={styles.centerLockOverlay}>
              <View style={styles.centerLockBadge}>
                <MaterialIcons name="lock" size={32} color={colors.primary} />
              </View>
            </View>
          )}
        </View>

        {/* Bottom bar for price/status */}
        <View style={styles.footer}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Unlock Price</Text>
            <View style={styles.priceValueRow}>
              <MaterialIcons name="toll" size={24} color={colors.primary} />
              <Text style={styles.priceText}>{pricePaid != null ? pricePaid : post.price} Coins</Text>
            </View>
          </View>
        </View>

        {/* Deleted post indicator (for inventory) */}
        {showDeletedBadge && isDeleted && (
          <View style={styles.deletedBanner}>
            <Text style={styles.deletedText}>Post removed by owner</Text>
          </View>
        )}
      </NeumorphicCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginHorizontal: spacing.marginMobile,
    marginVertical: spacing.sm,
  },
  card: {
    padding: spacing.sm,
    borderRadius: radii.xl,
  },
  overlayTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 10,
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgDark, // Acts as surface-variant
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageLocked: {
    opacity: 0.6,
  },
  centerLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLockBadge: {
    width: 80,
    height: 80,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    // Neumorphic card style
    shadowColor: colors.bgLight,
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  footer: {
    marginTop: spacing.sm,
    padding: spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'column',
  },
  priceLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  priceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.text,
    marginLeft: spacing.base,
  },
  deletedBanner: {
    backgroundColor: `${colors.warning}20`,
    paddingVertical: spacing.base,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderRadius: radii.base,
  },
  deletedText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.warning,
  },
});

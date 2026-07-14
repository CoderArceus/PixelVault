import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getPost, unlockPost, deletePost } from '../api/posts';
import { useAuth } from '../context/AuthContext';
import { colors, typography, spacing, radii } from '../theme';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import NeumorphicCard from '../components/ui/NeumorphicCard';
import NeumorphicButton from '../components/ui/NeumorphicButton';
import Badge from '../components/ui/Badge';

export default function DetailsScreen({ route, navigation }) {
  const { postId } = route.params;
  const { user, refreshBalance } = useAuth();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function fetchPost() {
    try {
      setLoading(true);
      setError(null);
      const { post: data } = await getPost(postId);
      setPost(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPost();
  }, [postId]);

  async function handleUnlock() {
    setUnlocking(true);
    try {
      const result = await unlockPost(postId);

      setPost((prev) => ({
        ...prev,
        is_unlocked: true,
        original_url: result.original_url,
      }));

      await refreshBalance();
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.error || 'Unlock failed';

      if (status === 402) {
        Alert.alert(
          'Insufficient Balance',
          `You need ${err.response.data.required} coins but only have ${err.response.data.current_balance}.`
        );
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setUnlocking(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? It will be removed from the public feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deletePost(postId);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Delete failed');
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={fetchPost} />;
  if (!post) return <ErrorState message="Post not found" />;

  const isOwner = post.is_owner;
  const isUnlocked = post.is_unlocked;
  const canSeeOriginal = isOwner || isUnlocked;
  const canAfford = user && user.coin_balance >= post.price;

  const displayUrl = canSeeOriginal
    ? post.original_url || post.preview_url
    : post.preview_url;

  return (
    <View style={styles.container}>
      {/* Custom Top App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        
        <View style={styles.logoRow}>
          <Text style={styles.brandText}>Pixel Vault</Text>
        </View>
        
        <View style={styles.balanceBadge}>
          <MaterialIcons name="toll" size={18} color={colors.primary} />
          <Text style={styles.balanceText}>{user?.coin_balance ?? '—'} Coins</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Image Preview Card */}
        <NeumorphicCard style={styles.imageCard}>
          <View style={styles.overlayTop}>
            {!isOwner && !isUnlocked ? (
              <Badge icon={<MaterialIcons name="lock" size={16} color={colors.info} />} text="Locked Content" type="info" style={styles.statusBadgeOverlay} />
            ) : isOwner ? (
              <Badge icon={<MaterialIcons name="check-circle" size={16} color={colors.success} />} text="Your post" type="success" style={styles.statusBadgeOverlay} />
            ) : (
              <Badge icon={<MaterialIcons name="lock-open" size={16} color={colors.info} />} text="Unlocked" type="info" style={styles.statusBadgeOverlay} />
            )}
          </View>
          
          <View style={styles.imageContainer}>
            <Image source={{ uri: displayUrl }} style={[styles.image, !canSeeOriginal && styles.imageLocked]} resizeMode="cover" />
            
            {!canSeeOriginal && (
              <View style={styles.centerLockOverlay}>
                <View style={styles.centerLockBadge}>
                  <MaterialIcons name="lock" size={48} color={colors.primary} />
                </View>
              </View>
            )}
          </View>
        </NeumorphicCard>

        {/* Details Section */}
        <View style={styles.detailsContainer}>
          <View style={styles.textContent}>
            <Text style={styles.title}>{post.title}</Text>
            <Text style={styles.description}>
              {post.description}
            </Text>
          </View>

          {/* Price & Balance Status */}
          <NeumorphicCard style={styles.priceCard}>
            <View style={styles.priceCol}>
              <Text style={styles.priceLabel}>Unlock Price</Text>
              <View style={styles.priceValueRow}>
                <MaterialIcons name="toll" size={28} color={colors.primary} />
                <Text style={styles.priceText}>{post.price} Coins</Text>
              </View>
            </View>
            
            {!isOwner && !isUnlocked && (
              <Badge
                icon={<MaterialIcons name={canAfford ? "check-circle" : "error"} size={16} color={canAfford ? colors.success : colors.danger} />}
                text={canAfford ? "Balance Sufficient" : "Insufficient Balance"}
                type={canAfford ? 'success' : 'danger'}
              />
            )}
          </NeumorphicCard>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {!isOwner && !isUnlocked && (
              <>
                <NeumorphicButton
                  title={unlocking ? 'Unlocking...' : `Unlock for ${post.price} Coins`}
                  onPress={handleUnlock}
                  disabled={!canAfford || unlocking}
                  icon={!unlocking && <MaterialIcons name="lock-open" size={20} color="#fff" />}
                  style={styles.actionButton}
                />
                <Text style={styles.balanceNote}>You have {user?.coin_balance ?? 0} Coins available.</Text>
              </>
            )}
            
            {isOwner && post.status === 'active' && (
              <NeumorphicButton
                title={deleting ? 'Deleting...' : 'Delete Post'}
                onPress={handleDelete}
                disabled={deleting}
                icon={!deleting && <MaterialIcons name="delete" size={20} color="#fff" />}
                style={[styles.actionButton, styles.deleteButton]}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    paddingTop: 50,
    zIndex: 50,
    shadowColor: colors.bgDark,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.bgLight,
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoRow: {
    alignItems: 'center',
  },
  brandText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.text,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    borderRadius: radii.pill,
    backgroundColor: colors.bgDark,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  balanceText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  scrollContent: {
    padding: spacing.marginMobile,
    paddingBottom: spacing.lg,
  },
  imageCard: {
    padding: spacing.sm,
    borderRadius: radii.xl,
    marginBottom: spacing.md,
  },
  overlayTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 10,
  },
  statusBadgeOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgDark,
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
    width: 96,
    height: 96,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.bgLight,
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  detailsContainer: {
    flex: 1,
  },
  textContent: {
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  description: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.lg,
    color: colors.textMuted,
  },
  priceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.xl,
    marginBottom: spacing.md,
  },
  priceCol: {
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
    fontSize: typography.fontSize.xxxl,
    color: colors.text,
    marginLeft: spacing.base,
  },
  actionsContainer: {
    marginTop: spacing.sm,
  },
  actionButton: {
    width: '100%',
  },
  deleteButton: {
    backgroundColor: colors.danger,
  },
  balanceNote: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

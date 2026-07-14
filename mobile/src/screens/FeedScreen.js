import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { getPosts } from '../api/posts';
import { useAuth } from '../context/AuthContext';
import { colors, typography, spacing, radii } from '../theme';
import PostCard from '../components/PostCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export default function FeedScreen({ navigation }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchPosts = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const { posts: data } = await getPosts();
      setPosts(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [fetchPosts])
  );

  function handleRefresh() {
    setRefreshing(true);
    fetchPosts(true);
  }

  if (loading && !refreshing) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={() => fetchPosts()} />;

  return (
    <View style={styles.container}>
      {/* Top App Bar mimicking design */}
      <View style={styles.appBar}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <MaterialIcons name="lock" size={20} color={colors.primary} />
          </View>
          <Text style={styles.brandText}>Pixel Vault</Text>
        </View>
        <View style={styles.balanceBadge}>
          <MaterialIcons name="toll" size={18} color={colors.primary} />
          <Text style={styles.balanceText}>{user?.coin_balance ?? '—'} Coins</Text>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => navigation.navigate('Details', { postId: item.id })}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<EmptyState message="No content yet" icon="📷" />}
      />
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
    paddingTop: 50, // Safe area top
    zIndex: 50,
    // Neumorphic shadow for header
    shadowColor: colors.bgDark,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    shadowColor: colors.bgLight,
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  brandText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.text,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    borderRadius: radii.pill,
    backgroundColor: colors.bgDark, // Inset effect
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  balanceText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  list: {
    paddingVertical: spacing.md,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});

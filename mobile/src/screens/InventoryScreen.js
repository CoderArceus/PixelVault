import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getInventory } from '../api/users';
import { colors, typography, spacing } from '../theme';
import PostCard from '../components/PostCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export default function InventoryScreen({ navigation }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchInventory = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const { inventory: data } = await getInventory();
      setInventory(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchInventory();
    }, [fetchInventory])
  );

  function handleRefresh() {
    setRefreshing(true);
    fetchInventory(true);
  }

  if (loading && !refreshing) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={() => fetchInventory()} />;

  return (
    <View style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <Text style={styles.brandText}>Your Inventory</Text>
      </View>

      <FlatList
        data={inventory}
        keyExtractor={(item) => item.unlock_id}
        renderItem={({ item }) => {
          const postForCard = {
            ...item.post,
            is_owner: false,
            is_unlocked: true,
            preview_url: item.post.original_url || item.post.preview_url,
          };

          return (
            <PostCard
              post={postForCard}
              pricePaid={item.price_paid}
              showDeletedBadge
              onPress={() =>
                navigation.navigate('FeedTab', {
                  screen: 'Details',
                  params: { postId: item.post.id },
                })
              }
            />
          );
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={
          inventory.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <EmptyState message="No unlocked content yet" icon="🔓" />
        }
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
    justifyContent: 'center',
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
  brandText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.text,
  },
  list: {
    paddingVertical: spacing.md,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});

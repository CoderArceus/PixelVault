import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getTransactions } from '../api/users';
import { colors, typography, spacing, radii } from '../theme';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import NeumorphicCard from '../components/ui/NeumorphicCard';
import NeumorphicButton from '../components/ui/NeumorphicButton';

export default function ProfileScreen() {
  const { user, logout, refreshBalance } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await refreshBalance();
      const { transactions: txns } = await getTransactions();
      setTransactions(txns);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [refreshBalance]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  function renderTransaction({ item }) {
    return (
      <View style={styles.txRow}>
        <View style={styles.txLeft}>
          <Text style={styles.txAmount}>{item.amount} Coins</Text>
          <Text style={styles.txDate}>
            {new Date(item.created_at).toLocaleDateString()}{' '}
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Text style={styles.txBalance}>Bal: {item.balance_after}</Text>
      </View>
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <Text style={styles.brandText}>Profile & Wallet</Text>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <NeumorphicCard style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.email?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={styles.email}>{user?.email}</Text>
              <View style={styles.balanceContainer}>
                <Text style={styles.balanceLabel}>Wallet Balance</Text>
                <View style={styles.balanceValueRow}>
                  <MaterialIcons name="toll" size={32} color={colors.primary} />
                  <Text style={styles.balanceValue}>{user?.coin_balance ?? 0}</Text>
                </View>
              </View>
            </NeumorphicCard>

            <Text style={styles.sectionTitle}>Transaction History</Text>
          </>
        }
        renderItem={renderTransaction}
        contentContainerStyle={
          transactions.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <EmptyState message="No transactions yet" icon="💳" />
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
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
  profileCard: {
    padding: spacing.lg,
    alignItems: 'center',
    marginHorizontal: spacing.marginMobile,
    marginVertical: spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.bgLight,
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    color: '#fff',
    fontSize: typography.fontSize.xxl,
  },
  email: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.text,
    marginBottom: spacing.md,
  },
  balanceContainer: {
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    width: '100%',
  },
  balanceLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.hero,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.text,
    marginHorizontal: spacing.marginMobile,
    marginBottom: spacing.sm,
  },
  list: {
    paddingBottom: spacing.lg,
  },
  emptyContainer: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
  },
  txRow: {
    backgroundColor: colors.bgLight,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginHorizontal: spacing.marginMobile,
    marginBottom: spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  txLeft: {},
  txAmount: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.danger,
  },
  txDate: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  txBalance: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.text,
  },
  footer: {
    paddingHorizontal: spacing.marginMobile,
    marginTop: spacing.md,
  },
  logoutButton: {
    backgroundColor: `${colors.danger}20`,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    fontFamily: typography.fontFamily.semiBold,
    color: colors.danger,
    fontSize: typography.fontSize.md,
  },
});

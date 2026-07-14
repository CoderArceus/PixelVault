import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function EmptyState({ message, icon }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon || '📭'}</Text>
      <Text style={styles.message}>{message || 'Nothing here yet'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

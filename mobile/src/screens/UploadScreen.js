import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { createPost } from '../api/posts';
import { colors, typography, spacing, radii } from '../theme';
import NeumorphicCard from '../components/ui/NeumorphicCard';
import NeumorphicButton from '../components/ui/NeumorphicButton';
import NeumorphicInput from '../components/ui/NeumorphicInput';

export default function UploadScreen({ navigation }) {
  const [imageUri, setImageUri] = useState(null);
  const [price, setPrice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera roll access is required to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setSuccess(false);
      setError('');
    }
  }

  async function handlePublish() {
    const priceInt = parseInt(price, 10);
    if (!imageUri) {
      setError('Please select an image');
      return;
    }
    if (!price || isNaN(priceInt) || priceInt <= 0) {
      setError('Price must be a positive number');
      return;
    }

    setUploading(true);
    setError('');

    try {
      await createPost(imageUri, priceInt);
      setSuccess(true);
      setImageUri(null);
      setPrice('');
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    setImageUri(null);
    setPrice('');
    setSuccess(false);
    setError('');
  }

  if (success) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successBadge}>
          <MaterialIcons name="check-circle" size={64} color={colors.success} />
        </View>
        <Text style={styles.successTitle}>Published!</Text>
        <Text style={styles.successText}>Your content is now live in the feed.</Text>

        <NeumorphicButton
          title="View in Feed"
          onPress={() => navigation.navigate('FeedTab')}
          style={styles.successButton}
        />
        
        <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
          <Text style={styles.secondaryButtonText}>Upload Another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top App Bar mimicking design */}
      <View style={styles.appBar}>
        <View style={styles.logoRow}>
          <Text style={styles.brandText}>Upload Media</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <NeumorphicCard style={styles.card}>
          <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage} disabled={uploading}>
            {imageUri ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                <View style={styles.changeImageOverlay}>
                  <MaterialIcons name="edit" size={24} color="#fff" />
                </View>
              </View>
            ) : (
              <View style={styles.placeholderContainer}>
                <MaterialIcons name="add-photo-alternate" size={48} color={colors.primary} />
                <Text style={styles.placeholderText}>Tap to select an image</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Unlock Price (Coins)</Text>
            <NeumorphicInput
              icon={<MaterialIcons name="toll" size={20} color={colors.primary} />}
              placeholder="e.g. 25"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              editable={!uploading}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <NeumorphicButton
            title={uploading ? 'Publishing...' : 'Publish'}
            onPress={handlePublish}
            disabled={!imageUri || uploading}
            icon={!uploading && <MaterialIcons name="cloud-upload" size={20} color="#fff" />}
            style={styles.publishButton}
          />
        </NeumorphicCard>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollContent: {
    padding: spacing.marginMobile,
    paddingBottom: spacing.lg,
  },
  card: {
    padding: spacing.md,
  },
  imagePickerContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgDark,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    marginBottom: spacing.md,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  changeImageOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  inputGroup: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    marginLeft: spacing.base,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  publishButton: {
    marginTop: spacing.sm,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  successBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.bgLight,
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  successTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  successText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.lg,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  successButton: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.primary,
  },
});

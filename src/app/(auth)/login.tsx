/**
 * Mobile login screen with a focused, centered OTP request form.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  Pressable,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { colors, typography, spacing } from '@/theme';
import { sendOtp } from '@/services/authService';
import { useStore } from '@/store/useStore';

export default function LoginScreen() {
  const router = useRouter();
  const setPhoneNumber = useStore((state) => state.setPhoneNumber);
  const savedPhoneNumber = useStore((state) => state.phone_number);

  const [phone, setPhone] = useState(savedPhoneNumber ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\D/g, '').slice(0, 10);
    if (cleaned.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }

    Keyboard.dismiss();
    setError('');
    setIsLoading(true);

    try {
      const formattedNumber = `+91${cleaned}`;
      await sendOtp(formattedNumber);
      setPhoneNumber(cleaned);
      router.push('/(auth)/otp-verification');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneChange = (text: string) => {
    // Only allow digits, max 10
    const cleaned = text.replace(/\D/g, '').slice(0, 10);
    setPhone(cleaned);
    if (error) setError('');
  };

  return (
    <ScreenWrapper
      keyboardAvoiding
      edges={['top', 'left', 'right', 'bottom']}
      statusBarColor={colors.primary}
      style={styles.mainWrapper}
    >
      {/* ─── Yellow Header Bar with Logo ─── */}
      <View style={styles.headerBar}>
        <Image
          source={require('../../../assets/public/headsupLogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* ─── Main Content ─── */}
      <View style={styles.container}>


          {/* ─── Login Card ─── */}
          <View style={styles.card}>

            <Text style={styles.cardTitle}>
              Enter your mobile number to receive an OTP
            </Text>

            {/* Mobile Number Label */}
            <Text style={styles.inputLabel}>MOBILE NUMBER</Text>

            {/* Phone Input Row */}
            <View style={[styles.inputRow, error ? styles.inputRowError : undefined]}>
              {/* Country Code Section */}
              <View style={styles.countryCodeSection}>
                {/* India Flag */}
                <View style={styles.flagContainer}>
                  <View style={[styles.flagStripe, { backgroundColor: '#FF9933' }]} />
                  <View style={[styles.flagStripe, { backgroundColor: '#FFFFFF' }]} />
                  <View style={[styles.flagStripe, { backgroundColor: '#138808' }]} />
                  <View style={styles.flagChakra} />
                </View>
                <Text style={styles.countryCode}>+91</Text>
              </View>

              {/* Phone Input */}
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter mobile number"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                value={phone}
                onChangeText={handlePhoneChange}
                maxLength={10}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
                editable={!isLoading}
              />
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorRow}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <Pressable
              onPress={handleSendOtp}
              disabled={isLoading || phone.length < 10}
              style={({ pressed }) => [
                styles.submitBtn,
                (isLoading || phone.length < 10) ? styles.submitBtnDisabled : undefined,
                pressed && !(isLoading || phone.length < 10) ? styles.submitBtnPressed : undefined,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text.primary} size="small" />
              ) : (
                <Text style={styles.submitBtnText}>GET OTP</Text>
              )}
            </Pressable>
          </View>

      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ─── Header ───
  headerBar: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  logo: {
    height: 44,
    width: 180,
  },

  // ─── Main ───
  mainWrapper: {
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },


  // ─── Card ───
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.xl,
    shadowColor: '#141413',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 26,
    letterSpacing: -0.3,
  },

  // ─── Input ───
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  inputRowError: {
    borderColor: colors.status.error,
  },
  countryCodeSection: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  flagContainer: {
    width: 24,
    height: 16,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  flagStripe: {
    height: '33.33%',
    width: '100%',
  },
  flagChakra: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1A4BA0',
    top: '50%',
    left: '50%',
    marginTop: -3,
    marginLeft: -3,
  },
  countryCode: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  phoneInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: 16,
    paddingVertical: 0,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },

  // ─── Error ───
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    marginLeft: 2,
  },
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.error,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.status.error,
  },

  // ─── Submit Button ───
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: 1,
  },

});

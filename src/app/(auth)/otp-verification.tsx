/**
 * OTP Verification Screen — matches the HeadsUp web frontend design exactly.
 * White header with logo, large "Verify Number" title, 6 individual OTP digit boxes,
 * yellow "Verify & Proceed" button, resend timer, construction image at bottom.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  Pressable,
  Keyboard,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { colors, typography, spacing } from '@/theme';
import { verifyOtp, sendOtp, getMe } from '@/services/authService';
import { useStore } from '@/store/useStore';
import { ChevronLeft } from 'lucide-react-native';

const OTP_LENGTH = 6;

export default function OtpVerificationScreen() {
  const router = useRouter();
  const phoneNumber = useStore((state) => state.phone_number);
  const setAuthenticated = useStore((state) => state.setAuthenticated);
  const setUser = useStore((state) => state.setUser);

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));

  // Redirect if no phone number
  useEffect(() => {
    if (!phoneNumber) {
      router.replace('/(auth)/login');
    }
  }, [phoneNumber, router]);

  // Resend cooldown timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleDigitChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    if (error) setError('');

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      setError('Please enter the full 6-digit code');
      return;
    }

    Keyboard.dismiss();
    setError('');
    setIsLoading(true);

    try {
      await verifyOtp(`+91${phoneNumber}`, otp);

      // Fetch user profile to determine next step (getMe checks worker skill status)
      const me = await getMe();
      setUser(me);
      setAuthenticated(true);

      if (me.role) {
        if (me.role === 'worker' && me.onboarding_status === 'ROLE_SELECTED') {
          router.replace('/(auth)/select-skill');
          return;
        }
        router.replace('/(tabs)');
      } else {
        // New user — needs to pick a role
        router.replace('/(auth)/role-selection');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || isResending) return;

    setIsResending(true);
    setError('');
    try {
      await sendOtp(`+91${phoneNumber}`);
      setResendTimer(30);
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setIsResending(false);
    }
  };

  const handleEditPhoneNumber = () => {
    Keyboard.dismiss();
    router.replace('/(auth)/login');
  };

  const formattedPhone = phoneNumber
    ? `+91 ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}`
    : '';

  return (
    <ScreenWrapper
      keyboardAvoiding
      edges={['top', 'left', 'right', 'bottom']}
      statusBarColor={colors.primary}
      style={styles.mainWrapper}
    >
      {/* ─── Yellow Header Bar ─── */}
      <View style={styles.headerBar}>
        <Image
          source={require('../../../assets/public/headsupLogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* ─── Main Content ─── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Verify Number</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
            <Text style={[styles.subtitle, styles.phoneHighlight]}>
              {formattedPhone}
            </Text>
            <Pressable
              onPress={handleEditPhoneNumber}
              style={styles.changeNumberButton}
              accessibilityLabel="Change mobile number"
            >
              <ChevronLeft size={18} color={colors.text.link} strokeWidth={2.5} />
              <Text style={styles.changeNumberText}>Change mobile number</Text>
            </Pressable>
          </View>

          {/* OTP Input Boxes */}
          <View style={styles.otpRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpBox,
                  digit ? styles.otpBoxFilled : undefined,
                ]}
                value={digit}
                onChangeText={(text) => handleDigitChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                autoFocus={index === 0}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Error */}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* Verify Button */}
          <Pressable
            onPress={handleVerify}
            disabled={isLoading || digits.join('').length < OTP_LENGTH}
            style={({ pressed }) => [
              styles.submitBtn,
              (isLoading || digits.join('').length < OTP_LENGTH) ? styles.submitBtnDisabled : undefined,
              pressed ? styles.submitBtnPressed : undefined,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text.primary} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Verify & Proceed</Text>
            )}
          </Pressable>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn&apos;t receive the code? </Text>
            <Pressable onPress={handleResend} disabled={resendTimer > 0 || isResending}>
              <Text style={[
                styles.resendAction,
                (resendTimer > 0 || isResending) ? styles.resendDisabled : undefined,
              ]}>
                {isResending
                  ? 'Sending...'
                  : resendTimer > 0
                    ? `Resend in ${resendTimer}s`
                    : 'Resend OTP'}
              </Text>
            </Pressable>
          </View>

          {/* Construction Image */}
          <View style={styles.imageContainer}>
            <Image
              source={require('../../../assets/public/selectRoleImage.png')}
              style={styles.constructionImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* ─── Footer ─── */}
        <View style={styles.footerBar}>
          <Text style={styles.footerText}>
            HEADSUP INDUSTRIAL SYSTEMS © 2026
          </Text>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ─── Header ───
  headerBar: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
  },
  logo: {
    height: 44,
    width: 180,
  },

  // ─── Main ───
  mainWrapper: {
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
  },

  // ─── Title ───
  titleSection: {
    marginBottom: spacing['2xl'],
  },
  title: {
    alignSelf: 'stretch',
    fontSize: 32,
    fontWeight: '800',
    color: colors.text.primary,
    lineHeight: 38,
    letterSpacing: -0.6,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    alignSelf: 'stretch',
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
  },
  phoneHighlight: {
    fontWeight: '700',
    color: colors.text.primary,
  },

  changeNumberButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: 8,
  },
  changeNumberText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.text.link,
  },

  // ─── OTP Boxes ───
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: spacing.xl,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  otpBoxFilled: {
    borderColor: colors.focusRing,
    backgroundColor: '#FFFDF7',
  },

  // ─── Error ───
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.status.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  // ─── Submit ───
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5B800',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text.primary,
  },

  // ─── Resend ───
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  resendText: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  resendAction: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.text.link,
  },
  resendDisabled: {
    color: colors.text.muted,
  },

  // ─── Construction Image ───
  imageContainer: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginTop: spacing.lg,
  },
  constructionImage: {
    width: '100%',
    height: '100%',
  },

  // ─── Footer ───
  footerBar: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 2,
  },

});

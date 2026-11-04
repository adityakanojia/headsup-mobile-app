/**
 * AddWorkerSheet — 3-step flow for a contractor to add a worker to their team.
 *   1. phone   → POST /user/contractor/workers/initiate (sends OTP to worker)
 *   2. otp     → POST /user/contractor/workers/verify   (worker consents by sharing OTP)
 *   3. details → POST /user/contractor/workers          (name + primary trade + sub-skills)
 *
 * Mirrors the web's inline "Add New Worker" panel, presented as a native modal sheet
 * so it doesn't require changes to the root navigator.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { X, Pencil, Check, ShieldCheck, Smartphone, UserPlus } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useSkillCategories, useSkillsByCategory } from '@/hooks/useJobs';
import { useInitiateWorkerOtp, useVerifyWorkerOtp, useAddWorkerToTeam } from '@/hooks/useTeam';
import { colors, typography, spacing, borderRadius, hitSlop } from '@/theme';
import {
  PHONE_LENGTH,
  OTP_LENGTH,
  COUNTRY_CODE,
  sanitizeDigits,
  sanitizeName,
  validateIndianMobile,
  validateOtp,
  toE164,
  getErrorMessage,
} from './validation';

type Step = 'phone' | 'otp' | 'details';

const RESEND_COOLDOWN_SECONDS = 30;
const STEPS: Step[] = ['phone', 'otp', 'details'];

export interface AddedWorkerInfo {
  name: string | null;
  /** E.164 phone, e.g. +919876543210 */
  phoneNumber: string;
}

interface AddWorkerSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdded?: (worker: AddedWorkerInfo) => void;
}

export function AddWorkerSheet({ visible, onClose, onAdded }: AddWorkerSheetProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [skillIds, setSkillIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);

  const otpInputRef = useRef<TextInput>(null);

  const initiateMutation = useInitiateWorkerOtp();
  const verifyMutation = useVerifyWorkerOtp();
  const addMutation = useAddWorkerToTeam();

  const categoriesQuery = useSkillCategories();
  const skillsQuery = useSkillsByCategory(step === 'details' ? categoryId : null);

  const isProcessing =
    initiateMutation.isPending || verifyMutation.isPending || addMutation.isPending;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  const resetState = useCallback(() => {
    setStep('phone');
    setPhone('');
    setOtp('');
    setName('');
    setCategoryId(null);
    setSkillIds(new Set());
    setError('');
    setResendIn(0);
    initiateMutation.reset();
    verifyMutation.reset();
    addMutation.reset();
    // Mutation objects are stable per hook instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear sensitive data (phone/OTP) whenever the sheet is dismissed
  useEffect(() => {
    if (!visible) resetState();
  }, [visible, resetState]);

  // Resend cooldown ticker
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'otp') {
      const t = setTimeout(() => otpInputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [step]);

  const handleClose = () => {
    if (isProcessing) return; // Don't abandon an in-flight request
    Keyboard.dismiss();
    onClose();
  };

  // ── Step handlers ────────────────────────────────────────────────────────

  const sendOtp = async () => {
    const validationError = validateIndianMobile(phone);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    try {
      await initiateMutation.mutateAsync(toE164(phone));
      setOtp('');
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setStep('otp');
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to send OTP. Please try again.'));
    }
  };

  const resendOtp = async () => {
    if (resendIn > 0 || isProcessing) return;
    setError('');
    try {
      await initiateMutation.mutateAsync(toE164(phone));
      setOtp('');
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to resend OTP.'));
    }
  };

  const verify = async (code = otp) => {
    const validationError = validateOtp(code);
    if (validationError) {
      setError(validationError);
      return;
    }
    Keyboard.dismiss();
    setError('');
    try {
      await verifyMutation.mutateAsync({ phoneNumber: toE164(phone), otpCode: code });
      setStep('details');
    } catch (e) {
      setOtp('');
      setError(getErrorMessage(e, 'Invalid OTP. Please try again.'));
    }
  };

  const submit = async () => {
    if (!categoryId) {
      setError("Select the worker's primary trade");
      return;
    }
    Keyboard.dismiss();
    setError('');
    const trimmedName = name.trim();
    try {
      await addMutation.mutateAsync({
        phone_number: toE164(phone),
        name: trimmedName || undefined,
        // primary_category_id is the single source of truth for job matching
        primary_category_id: categoryId,
        // skill_ids are supplementary sub-skills — optional
        skill_ids: skillIds.size > 0 ? Array.from(skillIds) : undefined,
      });
      onAdded?.({ name: trimmedName || null, phoneNumber: toE164(phone) });
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to add worker. Please try again.'));
    }
  };

  const selectCategory = (id: string) => {
    if (id === categoryId) return;
    setCategoryId(id);
    setSkillIds(new Set());
    if (error) setError('');
  };

  const toggleSkill = (id: string) => {
    setSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderStepIndicator = () => {
    const currentIndex = STEPS.indexOf(step);
    return (
      <View style={styles.stepper} accessibilityRole="progressbar">
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[styles.stepBar, i <= currentIndex && styles.stepBarActive]}
          />
        ))}
      </View>
    );
  };

  const renderPhoneStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.heroIcon}>
        <Smartphone size={28} color={colors.primaryDark} />
      </View>
      <Text style={styles.stepTitle}>Worker&apos;s mobile number</Text>
      <Text style={styles.stepSubtitle}>
        We&apos;ll send a one-time code to the worker to confirm they agree to join your team.
      </Text>

      <View style={[styles.phoneField, !!error && styles.fieldError]}>
        <View style={styles.countryCode}>
          <View style={styles.flag} accessibilityElementsHidden importantForAccessibility="no">
            <View style={[styles.flagStripe, { backgroundColor: '#FF9933' }]} />
            <View style={[styles.flagStripe, { backgroundColor: '#FFFFFF' }]} />
            <View style={[styles.flagStripe, { backgroundColor: '#138808' }]} />
          </View>
          <Text style={styles.countryCodeText}>{COUNTRY_CODE}</Text>
        </View>
        <TextInput
          style={styles.phoneInput}
          value={phone}
          onChangeText={(t) => {
            setPhone(sanitizeDigits(t, PHONE_LENGTH));
            if (error) setError('');
          }}
          placeholder="98765 43210"
          placeholderTextColor={colors.text.muted}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={PHONE_LENGTH}
          returnKeyType="send"
          onSubmitEditing={sendOtp}
          autoFocus
          accessibilityLabel="Worker mobile number"
        />
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <Button
        title="Send OTP"
        onPress={sendOtp}
        loading={initiateMutation.isPending}
        disabled={phone.length !== PHONE_LENGTH}
        size="lg"
        style={styles.primaryAction}
      />
    </View>
  );

  const renderOtpStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.heroIcon}>
        <ShieldCheck size={28} color={colors.primaryDark} />
      </View>
      <Text style={styles.stepTitle}>Enter verification code</Text>
      <View style={styles.sentToRow}>
        <Text style={styles.stepSubtitle}>Ask the worker for the code sent to </Text>
        <Pressable
          onPress={() => {
            setError('');
            setStep('phone');
          }}
          style={styles.phoneChip}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Edit phone number"
        >
          <Text style={styles.phoneChipText}>
            {COUNTRY_CODE} {phone}
          </Text>
          <Pencil size={12} color={colors.text.secondary} />
        </Pressable>
      </View>

      {/* Single hidden input drives the 6 visual boxes — supports paste & SMS autofill */}
      <Pressable onPress={() => otpInputRef.current?.focus()} style={styles.otpRow}>
        {Array.from({ length: OTP_LENGTH }).map((_, i) => {
          const char = otp[i] ?? '';
          const isActive = i === otp.length && !verifyMutation.isPending;
          return (
            <View
              key={i}
              style={[
                styles.otpBox,
                !!char && styles.otpBoxFilled,
                isActive && styles.otpBoxActive,
                !!error && styles.fieldError,
              ]}
            >
              <Text style={styles.otpChar}>{char}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={otpInputRef}
        value={otp}
        onChangeText={(t) => {
          const code = sanitizeDigits(t, OTP_LENGTH);
          setOtp(code);
          if (error) setError('');
          if (code.length === OTP_LENGTH) verify(code);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        style={styles.hiddenInput}
        caretHidden
        accessibilityLabel="One-time code"
      />
      {!!error && <Text style={[styles.errorText, styles.centerText]}>{error}</Text>}

      <Button
        title="Verify"
        onPress={() => verify()}
        loading={verifyMutation.isPending}
        disabled={otp.length !== OTP_LENGTH}
        size="lg"
        style={styles.primaryAction}
      />

      <Pressable
        onPress={resendOtp}
        disabled={resendIn > 0 || isProcessing}
        style={styles.resendBtn}
        hitSlop={hitSlop}
      >
        {initiateMutation.isPending ? (
          <ActivityIndicator size="small" color={colors.primaryDark} />
        ) : (
          <Text style={[styles.resendText, resendIn > 0 && styles.resendTextDisabled]}>
            {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          </Text>
        )}
      </Pressable>
    </View>
  );

  const renderDetailsStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.verifiedBanner}>
        <Check size={16} color={colors.status.success} />
        <Text style={styles.verifiedText}>
          {COUNTRY_CODE} {phone} verified
        </Text>
      </View>

      <Input
        label="Worker's name (optional)"
        value={name}
        onChangeText={(t) => setName(sanitizeName(t))}
        placeholder="e.g. Muthu Kumar"
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="done"
        containerStyle={styles.fieldSpacing}
      />

      <Text style={styles.sectionLabel}>
        Primary trade <Text style={styles.required}>*</Text>
      </Text>
      <Text style={styles.sectionHint}>Used to match this worker with relevant jobs.</Text>

      {categoriesQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.inlineLoader} />
      ) : categoriesQuery.isError ? (
        <Pressable onPress={() => categoriesQuery.refetch()} style={styles.inlineRetry}>
          <Text style={styles.inlineRetryText}>Couldn&apos;t load trades. Tap to retry.</Text>
        </Pressable>
      ) : (
        <View style={styles.chipWrap}>
          {categoriesQuery.data?.map((cat) => {
            const selected = cat.id === categoryId;
            return (
              <Pressable
                key={cat.id}
                onPress={() => selectCategory(cat.id)}
                style={[styles.chip, selected && styles.chipSelectedDark]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextInverse]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!!categoryId && (
        <>
          <Text style={[styles.sectionLabel, styles.sectionGap]}>
            Sub-skills <Text style={styles.optional}>(optional)</Text>
          </Text>
          {skillsQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.inlineLoader} />
          ) : skillsQuery.data && skillsQuery.data.length > 0 ? (
            <View style={styles.chipWrap}>
              {skillsQuery.data.map((skill) => {
                const selected = skillIds.has(skill.id);
                return (
                  <Pressable
                    key={skill.id}
                    onPress={() => toggleSkill(skill.id)}
                    style={[styles.chip, selected && styles.chipSelected]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    {selected && <Check size={14} color={colors.primaryDark} />}
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {skill.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.sectionHint}>No sub-skills for this trade.</Text>
          )}
        </>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={styles.container}
          edges={['top', 'left', 'right', 'bottom']}
        >
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <UserPlus size={20} color={colors.text.primary} />
                <Text style={styles.headerTitle}>Add Worker</Text>
              </View>
              <Pressable
                onPress={handleClose}
                disabled={isProcessing}
                style={styles.closeBtn}
                hitSlop={hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={22} color={colors.text.secondary} />
              </Pressable>
            </View>
            {renderStepIndicator()}

            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {step === 'phone' && renderPhoneStep()}
              {step === 'otp' && renderOtpStep()}
              {step === 'details' && renderDetailsStep()}
            </ScrollView>

            {step === 'details' && (
              <View style={styles.footer}>
                <Button
                  title="Add to Team"
                  onPress={submit}
                  loading={addMutation.isPending}
                  disabled={!categoryId}
                  size="lg"
                  icon={<Check size={20} color={colors.text.primary} />}
                />
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.heavy,
    color: colors.text.primary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  stepBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
  },
  stepBarActive: {
    backgroundColor: colors.primary,
  },
  scrollContent: {
    padding: spacing.xl,
    flexGrow: 1,
  },
  stepContent: {
    width: '100%',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  stepTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.heavy,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.relaxed,
  },
  // Phone
  phoneField: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.background,
    borderRightWidth: 2,
    borderRightColor: colors.border,
  },
  flag: {
    width: 22,
    height: 15,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  flagStripe: {
    flex: 1,
  },
  countryCodeText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: 1,
  },
  fieldError: {
    borderColor: colors.status.error,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    fontWeight: typography.weights.medium,
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
  },
  centerText: {
    textAlign: 'center',
    marginLeft: 0,
  },
  primaryAction: {
    marginTop: spacing.xl,
  },
  // OTP
  sentToRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  phoneChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  otpBox: {
    flex: 1,
    aspectRatio: 0.85,
    maxHeight: 64,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: colors.primaryHover,
    backgroundColor: colors.primaryLight,
  },
  otpBoxActive: {
    borderColor: colors.primary,
  },
  otpChar: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.heavy,
    color: colors.text.primary,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  resendBtn: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    minHeight: 24,
    justifyContent: 'center',
  },
  resendText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  resendTextDisabled: {
    color: colors.text.muted,
  },
  // Details
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.status.successLight,
    marginBottom: spacing.xl,
  },
  verifiedText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.status.success,
  },
  fieldSpacing: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionGap: {
    marginTop: spacing.xl,
  },
  sectionHint: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  required: {
    color: colors.status.error,
  },
  optional: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.text.muted,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 40,
  },
  chipSelectedDark: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  chipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
  },
  chipTextInverse: {
    color: colors.text.inverse,
  },
  chipTextSelected: {
    color: colors.primaryDark,
  },
  inlineLoader: {
    alignSelf: 'flex-start',
    marginVertical: spacing.md,
  },
  inlineRetry: {
    paddingVertical: spacing.md,
  },
  inlineRetryText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    fontWeight: typography.weights.semibold,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
});

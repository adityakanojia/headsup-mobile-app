/**
 * Role Selection Screen
 * Appears when onboarding_status === 'OTP_VERIFIED'
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { HardHat, Users, Building2 } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Button } from '@/components/Button';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { selectRole, getMe } from '@/services/authService';
import { useStore } from '@/store/useStore';
import type { UserRole } from '@/types/user';

const ROLES = [
  {
    id: 'worker',
    title: 'Individual Worker',
    description: 'Find jobs and get paid directly',
    icon: HardHat,
  },
  {
    id: 'contractor',
    title: 'Contractor / Agency',
    description: 'Manage teams and take on larger projects',
    icon: Users,
  },
  {
    id: 'client',
    title: 'Client / Employer',
    description: 'Post jobs and hire workers or contractors',
    icon: Building2,
  },
] as const;

export default function RoleSelectionScreen() {
  const router = useRouter();
  const setUser = useStore((state) => state.setUser);
  
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (!selected) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      await selectRole(selected);
      // Fetch fresh profile to get updated onboarding status
      const profile = await getMe();
      setUser(profile);
      
      // Route based on role
      if (profile.role === 'worker') {
        router.replace('/(auth)/select-skill');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      // If role was already selected on a previous attempt, sync profile and proceed
      try {
        const existingProfile = await getMe();
        if (existingProfile.role) {
          setUser(existingProfile);
          if (existingProfile.role === 'worker' && existingProfile.onboarding_status === 'ROLE_SELECTED') {
            router.replace('/(auth)/select-skill');
          } else {
            router.replace('/(tabs)');
          }
          return;
        }
      } catch {
        // Fall through to display original error
      }
      setError(err.message || 'Failed to set role');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenWrapper scrollable edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose your role</Text>
          <Text style={styles.subtitle}>
            How will you use HeadsUp? You can change this later in settings if needed.
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          {ROLES.map((role) => {
            const isSelected = selected === role.id;
            const Icon = role.icon;
            
            return (
              <Pressable
                key={role.id}
                onPress={() => setSelected(role.id as UserRole)}
                style={[
                  styles.card,
                  isSelected ? styles.cardSelected : undefined,
                ]}
              >
                <View style={[styles.iconContainer, isSelected ? styles.iconContainerSelected : undefined]}>
                  <Icon 
                    size={28} 
                    color={isSelected ? colors.primaryDark : colors.text.secondary} 
                  />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, isSelected ? styles.cardTitleSelected : undefined]}>
                    {role.title}
                  </Text>
                  <Text style={styles.cardDescription}>
                    {role.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleContinue}
            loading={isLoading}
            disabled={!selected}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
  },
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing['2xl'],
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.relaxed,
  },
  optionsContainer: {
    gap: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFFDF5',
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  iconContainerSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: '#EFE0A6',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  cardTitleSelected: {
    color: colors.primaryDark,
  },
  cardDescription: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.normal,
  },
  errorText: {
    color: colors.status.error,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing['2xl'],
  },
});

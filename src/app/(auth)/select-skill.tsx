/**
 * Worker Skill Selection Onboarding
 * Shown to workers immediately after role selection.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useSkillCategories } from '@/hooks/useJobs';
import { fetchSkillsByCategory, addWorkerSkills } from '@/services/jobService';
import { getMe } from '@/services/authService';
import { useStore } from '@/store/useStore';
import type { Skill } from '@/types/jobs';

export default function SelectSkillScreen() {
  const router = useRouter();
  const setUser = useStore((state) => state.setUser);
  
  const { data: categories, isLoading: isLoadingCats, error: catError, refetch } = useSkillCategories();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleCategorySelect = async (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedSkills(new Set()); // Reset selected skills on category change
    setSkillsError('');
    setIsLoadingSkills(true);
    try {
      const categorySkills = await fetchSkillsByCategory(categoryId);
      setSkills(categorySkills);
    } catch {
      setSkills([]);
      setSkillsError('Failed to load skills. Tap here to retry.');
    } finally {
      setIsLoadingSkills(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    const newSelected = new Set(selectedSkills);
    if (newSelected.has(skillId)) {
      newSelected.delete(skillId);
    } else {
      newSelected.add(skillId);
    }
    setSelectedSkills(newSelected);
  };

  const handleSubmit = async () => {
    if (!selectedCategory || selectedSkills.size === 0) return;
    
    setIsSubmitting(true);
    setSubmitError('');
    
    try {
      await addWorkerSkills(selectedCategory, Array.from(selectedSkills));
      
      // Fetch fresh profile to get updated onboarding status (now ACTIVE)
      const profile = await getMe();
      setUser(profile);
      
      router.replace('/(tabs)');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save skills');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingCats) {
    return (
      <ScreenWrapper
        edges={['top', 'left', 'right', 'bottom']}
        style={styles.center}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  if (catError) {
    return (
      <ScreenWrapper edges={['top', 'left', 'right', 'bottom']}>
        <ErrorState message="Failed to load categories. Please try again." onRetry={refetch} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>What do you do?</Text>
          <Text style={styles.subtitle}>Select your primary trade to find relevant jobs.</Text>
        </View>

        <View style={styles.content}>
          {/* Categories Horizontal Scroll */}
          <View style={styles.categoriesSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
              {categories?.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => handleCategorySelect(cat.id)}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.id && styles.categoryChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === cat.id && styles.categoryTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Skills Grid */}
          <ScrollView style={styles.skillsContainer} contentContainerStyle={styles.skillsScroll}>
            {isLoadingSkills ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : selectedCategory && skills.length > 0 ? (
              <View style={styles.skillsGrid}>
                {skills.map((skill) => {
                  const isSelected = selectedSkills.has(skill.id);
                  return (
                    <Pressable
                      key={skill.id}
                      onPress={() => toggleSkill(skill.id)}
                      style={[
                        styles.skillCard,
                        isSelected && styles.skillCardSelected,
                      ]}
                    >
                      <Text style={[styles.skillText, isSelected && styles.skillTextSelected]}>
                        {skill.name}
                      </Text>
                      {isSelected && (
                        <View style={styles.checkIcon}>
                          <Check size={16} color={colors.primaryDark} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : selectedCategory && skillsError ? (
              <Pressable onPress={() => handleCategorySelect(selectedCategory)}>
                <Text style={styles.errorText}>{skillsError}</Text>
              </Pressable>
            ) : selectedCategory ? (
              <Text style={styles.emptyText}>No specific skills found for this category.</Text>
            ) : (
              <Text style={styles.emptyText}>Select a category above to view skills.</Text>
            )}
          </ScrollView>
        </View>

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

        <View style={styles.footer}>
          <Button
            title="Complete Profile"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={selectedSkills.size === 0}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.xl,
    paddingBottom: spacing.sm,
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
  },
  content: {
    flex: 1,
  },
  categoriesSection: {
    marginBottom: spacing.md,
  },
  categoriesScroll: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipSelected: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  categoryText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
  },
  categoryTextSelected: {
    color: colors.surface,
  },
  skillsContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  skillsScroll: {
    padding: spacing.xl,
  },
  loader: {
    marginTop: spacing['2xl'],
  },
  skillsGrid: {
    gap: spacing.md,
  },
  skillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  skillCardSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  skillText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  skillTextSelected: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.text.muted,
    marginTop: spacing['3xl'],
  },
  errorText: {
    color: colors.status.error,
    textAlign: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
});

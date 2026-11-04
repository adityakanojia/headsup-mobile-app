/**
 * Dynamic Tab Layout — renders different tabs based on User Role.
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useStore } from '@/store/useStore';
import { getMe } from '@/services/authService';
import { colors, typography } from '@/theme';
import {
  Home,
  Briefcase,
  Search,
  Calendar,
  Users,
  Wallet,
  User,
  Building,
} from 'lucide-react-native';

export default function TabsLayout() {
  const { role, user, setUser } = useStore();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    // Fetch fresh profile on mount if missing to ensure we have the correct role
    async function fetchProfile() {
      try {
        const profile = await getMe();
        if (!mounted) return;
        setUser(profile);

        // Handle onboarding redirects
        if (!profile.role || profile.onboarding_status === 'OTP_VERIFIED') {
          router.replace('/(auth)/role-selection');
        } else if (
          profile.role === 'worker' &&
          profile.onboarding_status === 'ROLE_SELECTED'
        ) {
          router.replace('/(auth)/select-skill');
        }
      } catch {
        // If 401, apiClient will handle session expiry.
      }
    }

    if (!user) {
      fetchProfile();
    }

    return () => {
      mounted = false;
    };
  }, [user, setUser, router]);

  if (!role) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
      </View>
    );
  }

  const currentRole = role;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.borderLight,
          elevation: 4,
          shadowColor: '#141413',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: typography.weights.semibold,
          letterSpacing: 0.1,
          marginTop: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      
      {/* ── Worker / Contractor Shared ── */}
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          href: currentRole !== 'client' ? '/(tabs)/jobs' : null,
          tabBarIcon: ({ color }) => 
            currentRole === 'contractor' ? <Search size={24} color={color} /> : <Briefcase size={24} color={color} />,
        }}
      />

      {/* ── Worker Only ── */}
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
          href: currentRole === 'worker' ? '/(tabs)/applications' : null,
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
        }}
      />

      {/* ── Contractor Only ── */}
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          href: currentRole === 'contractor' ? '/(tabs)/team' : null,
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />

      {/* ── Client Only ── */}
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          href: currentRole === 'client' ? '/(tabs)/projects' : null,
          tabBarIcon: ({ color }) => <Building size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Status',
          href: currentRole === 'client' ? '/(tabs)/status' : null,
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />

      {/* ── All Roles ── */}
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color }) => <Wallet size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />

      {/* ── Hidden Wizard Route ── */}
      <Tabs.Screen
        name="createJob"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

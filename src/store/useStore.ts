/**
 * Global state store — mirrors web app's Zustand architecture.
 *
 * Slices:
 * - Auth: isAuthenticated, role (in-memory, not persisted — tokens are in SecureStore)
 * - User: full user profile from /user/me
 * - Phone: temp phone number for OTP flow (matches web store)
 *
 * Location slice is intentionally omitted for V1 (attendance is not in initial scope).
 * The architecture supports adding it later without refactoring.
 */
import { create } from 'zustand';
import type { UserProfile, UserRole } from '@/types/user';

interface AuthState {
  isAuthenticated: boolean;
  role: UserRole | null;
  isRestoringSession: boolean;
  phone_number: string;
}

interface UserState {
  user: UserProfile | null;
}

interface Actions {
  setAuthenticated: (authenticated: boolean) => void;
  setRole: (role: UserRole | null) => void;
  setUser: (user: UserProfile | null) => void;
  setRestoringSession: (restoring: boolean) => void;
  setPhoneNumber: (phone: string) => void;
  clearSession: () => void;
}

type AppStore = AuthState & UserState & Actions;

export const useStore = create<AppStore>()((set) => ({
  // Auth state
  isAuthenticated: false,
  role: null,
  isRestoringSession: true, // true on app start until session check completes
  phone_number: '',

  // User state
  user: null,

  // Actions
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
  setRole: (role) => set({ role }),
  setUser: (user) =>
    set({
      user,
      role: user?.role ?? null,
    }),
  setRestoringSession: (restoring) => set({ isRestoringSession: restoring }),
  setPhoneNumber: (phone) => set({ phone_number: phone }),
  clearSession: () =>
    set({
      isAuthenticated: false,
      role: null,
      user: null,
      isRestoringSession: false,
      phone_number: '',
    }),
}));

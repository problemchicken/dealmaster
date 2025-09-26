import {create} from 'zustand';

export type AuthState = {
  isAuthenticated: boolean;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
};

type AuthStateSetter = (
  partial:
    | AuthState
    | Partial<AuthState>
    | ((state: AuthState) => AuthState | Partial<AuthState>),
) => void;

export const useAuthStore = create<AuthState>((set: AuthStateSetter) => ({
  isAuthenticated: false,
  token: null,
  login: (token: string) => set({isAuthenticated: true, token}),
  logout: () => set({isAuthenticated: false, token: null}),
}));

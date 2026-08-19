import { create } from 'zustand';

export type AppView =
  | 'landing'
  | 'login'
  | 'register'
  | 'onboarding'
  | 'overview'
  | 'repositories'
  | 'pull-requests'
  | 'findings'
  | 'compliance'
  | 'rules'
  | 'evidence'
  | 'reports'
  | 'settings'
  | 'pr-analysis'
  | 'finding-detail'
  | 'diff-analyzer'
  | 'org-dashboard'
  | 'trust'
  | 'audit-log';

interface AppState {
  view: AppView;
  isAuthenticated: boolean;
  currentUser: { id: string; email: string; name: string; role: string } | null;
  currentOrgId: string | null;
  demoMode: boolean;
  selectedPRId: string | null;
  selectedFindingId: string | null;
  sidebarOpen: boolean;
  searchQuery: string;
  setView: (view: AppView) => void;
  login: (user: { id: string; email: string; name: string; role: string }, orgId: string) => void;
  logout: () => void;
  setDemoMode: (mode: boolean) => void;
  selectPR: (id: string | null) => void;
  selectFinding: (id: string | null) => void;
  toggleSidebar: () => void;
  setSearchQuery: (q: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'landing',
  isAuthenticated: false,
  currentUser: null,
  currentOrgId: null,
  demoMode: true,
  selectedPRId: null,
  selectedFindingId: null,
  sidebarOpen: true,
  searchQuery: '',
  setView: (view) => set({ view }),
  login: (user, orgId) => set({ isAuthenticated: true, currentUser: user, currentOrgId: orgId, view: 'overview' }),
  logout: () => set({ isAuthenticated: false, currentUser: null, currentOrgId: null, view: 'landing' }),
  setDemoMode: (mode) => set({ demoMode: mode }),
  selectPR: (id) => set({ selectedPRId: id, view: id ? 'pr-analysis' : 'pull-requests' }),
  selectFinding: (id) => set({ selectedFindingId: id, view: id ? 'finding-detail' : 'findings' }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSearchQuery: (q) => set({ searchQuery: q }),
}));

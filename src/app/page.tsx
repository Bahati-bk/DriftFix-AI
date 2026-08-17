'use client';

import { useAppStore } from '@/stores/app';
import { LandingPage } from '@/components/landing/LandingPage';
import { LoginPage } from '@/components/auth/LoginPage';
import { RegisterPage } from '@/components/auth/RegisterPage';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';

export default function Page() {
  const view = useAppStore((s) => s.view);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    switch (view) {
      case 'login': return <LoginPage />;
      case 'register': return <RegisterPage />;
      default: return <LandingPage />;
    }
  }

  return <DashboardLayout />;
}

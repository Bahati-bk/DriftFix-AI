'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Zap, ArrowLeft, Loader2 } from 'lucide-react';

export function LoginPage() {
  const setView = useAppStore((s) => s.setView);
  const login = useAppStore((s) => s.login);
  const [email, setEmail] = useState('demo@driftfix.ai');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        login(data.user, data.orgId);
        toast.success('Welcome back!');
      } else {
        toast.error('Invalid credentials');
      }
    } catch {
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'demo-login' }) });
      if (res.ok) {
        const data = await res.json();
        login(data.user, data.orgId);
        toast.success('Welcome to DriftFix Demo');
      }
    } catch {
      toast.error('Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="relative w-full max-w-md">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => setView('landing')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Card className="border-border/50">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><img src="/logo.svg" alt="DriftFix" className="h-12 w-12" /></div>
            <CardTitle className="text-2xl">Sign in to DriftFix</CardTitle>
            <CardDescription>AI-powered compliance engineering platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sign In
              </Button>
            </form>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleDemo} disabled={loading}>
              <Zap className="h-4 w-4 mr-2" />Enter Demo Mode
            </Button>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Don&apos;t have an account?{' '}
              <button className="text-primary hover:underline" onClick={() => setView('register')}>Sign up</button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

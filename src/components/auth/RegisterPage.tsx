'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

export function RegisterPage() {
  const setView = useAppStore((s) => s.setView);
  const login = useAppStore((s) => s.login);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) { toast.error('All fields required'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', email, password, name }),
      });
      if (res.ok) {
        const data = await res.json();
        login(data.user, data.orgId);
        toast.success('Account created!');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Registration failed');
      }
    } catch { toast.error('Registration failed'); }
    finally { setLoading(false); }
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
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>Start catching compliance drift today</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Chen" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Work Email</Label>
                <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Account
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have an account?{' '}
              <button className="text-primary hover:underline" onClick={() => setView('login')}>Sign in</button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

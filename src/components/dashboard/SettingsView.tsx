'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores/app';
import { toast } from 'sonner';
import {
  User,
  Building2,
  Github,
  Zap,
  Shield,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export function SettingsView() {
  const { currentUser, demoMode, setDemoMode } = useAppStore();
  const [orgName, setOrgName] = useState('');
  const [githubConnected, setGithubConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [polRes, repoRes] = await Promise.all([
          fetch('/api/policies').then((r) => r.json()),
          fetch('/api/repositories').then((r) => r.json()),
        ]);
        setPolicies(polRes.policies || []);
        const repos = repoRes.repositories || repoRes.repos || [];
        setGithubConnected(repos.length > 0);
        // Try to get org name from repos
        if (repos.length > 0 && repos[0].organizationId) {
          setOrgName('Organization');
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your account and organization</p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* User Profile */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="size-4" /> Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold shrink-0">
                    {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium">{currentUser?.name || 'Unknown User'}</p>
                    <p className="text-sm text-muted-foreground">{currentUser?.email || ''}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">{currentUser?.role || 'MEMBER'}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organization */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="size-4" /> Organization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Organization name"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integration Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Github className="size-4" /> Integrations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Github className="size-5" />
                  <div>
                    <p className="text-sm font-medium">GitHub</p>
                    <p className="text-xs text-muted-foreground">
                      {githubConnected ? 'Connected and receiving webhooks' : 'Not connected'}
                    </p>
                  </div>
                </div>
                {githubConnected ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
                    <CheckCircle2 className="size-3" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <XCircle className="size-3" /> Disconnected
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Demo Mode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="size-4 text-amber-400" /> Demo Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Demo Mode</p>
                  <p className="text-xs text-muted-foreground">
                    When enabled, uses sample data and demo endpoints
                  </p>
                </div>
                <Switch
                  checked={demoMode}
                  onCheckedChange={(v) => {
                    setDemoMode(v);
                    toast.info(v ? 'Demo mode enabled' : 'Demo mode disabled');
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Policy Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="size-4" /> Policy Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No policies configured.</p>
              ) : (
                <div className="space-y-3">
                  {policies.map((p) => (
                    <div key={String(p.id)} className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Block Critical</span>
                        <span className={Boolean(p.blockOnCritical) ? 'text-emerald-400' : 'text-red-400'}>
                          {Boolean(p.blockOnCritical) ? 'On' : 'Off'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Block High</span>
                        <span className={Boolean(p.blockOnHigh) ? 'text-emerald-400' : 'text-red-400'}>
                          {Boolean(p.blockOnHigh) ? 'On' : 'Off'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Block Medium</span>
                        <span className={Boolean(p.blockOnMedium) ? 'text-emerald-400' : 'text-red-400'}>
                          {Boolean(p.blockOnMedium) ? 'On' : 'Off'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Min Score</span>
                        <span className="font-medium">{Number(p.minimumScore)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

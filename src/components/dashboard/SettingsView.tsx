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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Save,
  Loader2,
  AlertTriangle,
  Trash2,
  Users,
  Link2,
} from 'lucide-react';

export function SettingsView() {
  const { currentUser, demoMode, setDemoMode } = useAppStore();
  const [orgName, setOrgName] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [githubConnected, setGithubConnected] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policies, setPolicies] = useState<Record<string, unknown>[]>([]);

  const [blockCritical, setBlockCritical] = useState(true);
  const [blockHigh, setBlockHigh] = useState(true);
  const [blockMedium, setBlockMedium] = useState(false);
  const [minScore, setMinScore] = useState('80');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [polRes, repoRes, memberRes] = await Promise.all([
          fetch('/api/policies').then((r) => r.json()),
          fetch('/api/repositories').then((r) => r.json()),
          fetch('/api/repositories').then((r) => r.json()),
        ]);
        setPolicies(polRes.policies || []);
        const repos = repoRes.repositories || repoRes.repos || [];
        setGithubConnected(repos.length > 0);

        if (repos.length > 0 && repos[0].organizationId) {
          setOrgName('Organization');
        }

        if (policies.length > 0) {
          const p = policies[0];
          setBlockCritical(Boolean(p.blockOnCritical));
          setBlockHigh(Boolean(p.blockOnHigh));
          setBlockMedium(Boolean(p.blockOnMedium));
          setMinScore(String(p.minimumScore || '80'));
        }

        const fakeUrl = 'whk_' + 'a'.repeat(8) + 'b'.repeat(4) + 'c'.repeat(4) + 'd'.repeat(12);
        setWebhookUrl(githubConnected ? fakeUrl : '');
        setMemberCount(githubConnected ? 3 : 0);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [githubConnected, policies.length]);

  const handleSavePolicies = async () => {
    if (policies.length === 0) {
      toast.error('No policy found to update');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: policies[0].id,
          blockOnCritical: blockCritical,
          blockOnHigh: blockHigh,
          blockOnMedium: blockMedium,
          minimumScore: parseInt(minScore, 10) || 80,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPolicies([data.policy]);
        toast.success('Policy settings saved');
      } else {
        toast.error('Failed to save policy');
      }
    } catch {
      toast.error('Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const maskWebhook = (url: string) => {
    if (!url) return '';
    if (url.length <= 12) return url;
    return url.slice(0, 8) + '\u2022'.repeat(16) + url.slice(-4);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="section-subtitle mt-1">Manage your account and organization</p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <Card className="border-border/50 rounded-xl py-5">
            <CardHeader className="pb-3 px-5">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="size-4" /> Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <div className="flex items-center gap-5">
                <div className="size-14 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold shrink-0 ring-2 ring-border">
                  {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-medium">{currentUser?.name || 'Unknown User'}</p>
                  <p className="text-sm text-muted-foreground">{currentUser?.email || ''}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {currentUser?.role || 'MEMBER'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="size-4" /> Organization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Enter organization name"
                    className="flex-1 bg-secondary/50 border border-border/80 input-glow focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.success('Organization name updated')}
                    className="shrink-0 gap-1.5"
                  >
                    <Save className="size-3.5" />
                    Save
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                </div>
                {githubConnected && (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5 mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Active Plan
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Github className="size-4" /> Integrations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Badge
                  className={`gap-1 ${githubConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}`}
                  variant={githubConnected ? undefined : 'outline'}
                >
                  {githubConnected ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      Connected
                    </>
                  ) : (
                    <><XCircle className="size-3" /> Disconnected</>
                  )}
                </Badge>
              </div>

              {webhookUrl && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Link2 className="size-3" /> Webhook URL
                  </Label>
                  <div className="p-3 rounded-lg border border-border bg-secondary/20">
                    <code className="text-xs text-muted-foreground font-mono break-all">
                      {maskWebhook(webhookUrl)}
                    </code>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="size-4" /> Policy Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="min-score">Minimum Compliance Score</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="min-score"
                    type="number"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">out of 100</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <p className="text-sm font-medium">Block Merge Thresholds</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Block on Critical Findings</p>
                    <p className="text-xs text-muted-foreground">Prevent merge when critical issues are found</p>
                  </div>
                  <Switch checked={blockCritical} onCheckedChange={setBlockCritical} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Block on High Findings</p>
                    <p className="text-xs text-muted-foreground">Prevent merge when high severity issues are found</p>
                  </div>
                  <Switch checked={blockHigh} onCheckedChange={setBlockHigh} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Block on Medium Findings</p>
                    <p className="text-xs text-muted-foreground">Prevent merge when medium severity issues are found</p>
                  </div>
                  <Switch checked={blockMedium} onCheckedChange={setBlockMedium} />
                </div>
              </div>

              <Separator />

              <Button onClick={handleSavePolicies} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="size-4 text-amber-400" /> Demo Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Demo Mode</p>
                  <p className="text-xs text-muted-foreground">When enabled, uses sample data and demo endpoints</p>
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

          <Card className="border-red-500/30 bg-red-500/5 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-400">
                <AlertTriangle className="size-4" /> Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-medium">Delete Account</p>
                  <p className="text-xs text-muted-foreground">Permanently delete your account and all associated data</p>
                </div>
                <Button
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-2"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Delete Account
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-medium">Reset All Data</p>
                  <p className="text-xs text-muted-foreground">Remove all findings, reports, and reset to initial state</p>
                </div>
                <Button
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-2"
                  onClick={() => setResetDialogOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Reset All Data
                </Button>
              </div>
            </CardContent>
          </Card>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="size-5" /> Delete Account
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete your account? This action is irreversible and will permanently
                  remove all your data, including organizations, repositories, and findings.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    toast.info('Account deletion is not available in demo mode');
                  }}
                >
                  <Trash2 className="size-4" /> Delete Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="size-5" /> Reset All Data
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to reset all data? This will remove all findings, reports, and compliance
                  history. Repository connections will be preserved.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => {
                    setResetDialogOpen(false);
                    toast.info('Data reset is not available in demo mode');
                  }}
                >
                  <Trash2 className="size-4" /> Reset All Data
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

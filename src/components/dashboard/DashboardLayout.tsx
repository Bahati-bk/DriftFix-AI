'use client';

import { useState, useEffect } from 'react';
import { useAppStore, type AppView } from '@/stores/app';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  LayoutDashboard, GitPullRequest, AlertTriangle, ShieldCheck,
  Settings, FileText, Scale, Database,
  LogOut, Search, Zap, Menu, X, History, Bell, PanelLeftClose, PanelLeft
} from 'lucide-react';
import { CommandPalette } from '@/components/ui/command-palette';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { OnboardingTour } from '@/components/ui/onboarding-tour';
import { KeyboardShortcutsPanel } from '@/components/ui/keyboard-shortcuts';
import { OverviewView } from './OverviewView';
import { RepositoriesView } from './RepositoriesView';
import { PullRequestsView } from './PullRequestsView';
import { FindingsView } from './FindingsView';
import { FindingDetailView } from './FindingDetailView';
import { ComplianceView } from './ComplianceView';
import { RulesView } from './RulesView';
import { EvidenceView } from './EvidenceView';
import { ReportsView } from './ReportsView';
import { SettingsView } from './SettingsView';
import { PRAnalysisView } from './PRAnalysisView';

const navItems: { view: AppView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { view: 'overview', label: 'Overview', icon: LayoutDashboard },
  { view: 'repositories', label: 'Repositories', icon: Database },
  { view: 'pull-requests', label: 'Pull Requests', icon: GitPullRequest },
  { view: 'findings', label: 'Findings', icon: AlertTriangle },
  { view: 'compliance', label: 'Compliance', icon: Scale },
  { view: 'rules', label: 'Rules', icon: ShieldCheck },
  { view: 'evidence', label: 'Evidence', icon: FileText },
  { view: 'reports', label: 'Reports', icon: History },
  { view: 'settings', label: 'Settings', icon: Settings },
];

function SidebarNav({
  sidebarOpen,
  view,
  onNav,
  findingsCount,
  criticalCount,
}: {
  sidebarOpen: boolean;
  view: string;
  onNav?: () => void;
  findingsCount: number;
  criticalCount: number;
}) {
  const { setView, logout, toggleSidebar, selectFinding, selectPR, currentUser } = useAppStore();

  const runDemoAnalysis = async () => {
    try {
      toast.info('Running demo analysis...');
      const res = await fetch('/api/demo/analyze', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const run = data.analysisRun || data;
        toast.success(`Analysis complete: ${run.findings?.length || run.findingsCount || 0} findings`);
        setView('findings');
      } else {
        toast.error('Analysis failed');
      }
    } catch {
      toast.error('Analysis failed');
    }
  };

  const handleNav = (itemView: AppView) => {
    setView(itemView);
    if (itemView === 'findings') selectFinding(null);
    if (itemView === 'pull-requests') selectPR(null);
    onNav?.();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center gap-3">
        <img src="/logo.svg" alt="DriftFix" className="h-8 w-8 shrink-0" />
        {sidebarOpen && <span className="font-bold text-lg tracking-tight">DriftFix</span>}
      </div>
      <Separator className="bg-border/50" />
      <ScrollArea className="flex-1 py-3 px-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active =
              view === item.view ||
              (item.view === 'findings' && view === 'finding-detail');
            const isFindings = item.view === 'findings';
            return (
              <TooltipProvider key={item.view} delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNav(item.view)}
                      data-tour={item.view === 'overview' ? 'step-2' : item.view === 'findings' ? 'step-3' : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-r-md text-sm transition-all ${
                        active
                          ? 'bg-primary/10 text-primary border-l-2 border-primary font-medium'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground border-l-2 border-transparent'
                      } ${!sidebarOpen ? 'justify-center' : ''}`}
                    >
                      <div className="relative">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {isFindings && criticalCount > 0 && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        )}
                      </div>
                      {sidebarOpen && (
                        <span className="flex-1 text-left">{item.label}</span>
                      )}
                      {sidebarOpen && isFindings && findingsCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                          {findingsCount}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {!sidebarOpen && <TooltipContent side="right">{item.label}</TooltipContent>}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </nav>
      </ScrollArea>
      <Separator className="bg-border/50" />
      <div className="p-3">
        <button
          onClick={() => { runDemoAnalysis(); onNav?.(); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-primary hover:bg-primary/10 transition-colors ${!sidebarOpen ? 'justify-center' : ''}`}
        >
          <Zap className="h-4 w-4 shrink-0" />
          {sidebarOpen && <span data-tour="step-1">Run Demo Analysis</span>}
        </button>
      </div>
      <Separator className="bg-border/50" />
      <div className="p-3">
        <div className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`}>
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {currentUser?.name?.charAt(0) || 'U'}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{currentUser?.name}</span>
                {currentUser?.role && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal">
                    {currentUser.role}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">{currentUser?.email}</div>
            </div>
          )}
          {sidebarOpen && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={logout} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Sign Out</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <div className="p-2 border-t border-border/30">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors ${sidebarOpen ? '' : ''}`}
              >
                {sidebarOpen ? (
                  <>
                    <PanelLeftClose className="h-4 w-4" />
                    <span className="text-xs">Collapse</span>
                  </>
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

export function DashboardLayout() {
  const view = useAppStore((s) => s.view);
  const demoMode = useAppStore((s) => s.demoMode);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [findingsCount, setFindingsCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [headerSearch, setHeaderSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadFindings = async () => {
      try {
        const res = await fetch('/api/findings?limit=1&status=OPEN');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setFindingsCount(data.pagination?.total ?? 0);
        }
        const critRes = await fetch('/api/findings?limit=1&severity=CRITICAL&status=OPEN');
        if (critRes.ok && !cancelled) {
          const critData = await critRes.json();
          setCriticalCount(critData.pagination?.total ?? 0);
        }
      } catch {
        // Silently fail - counts are non-critical
      }
    };
    loadFindings();
    return () => { cancelled = true; };
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && headerSearch.trim()) {
      useAppStore.getState().setSearchQuery(headerSearch.trim());
      useAppStore.getState().selectFinding(null);
      useAppStore.getState().setView('findings');
      setMobileMenuOpen(false);
    }
  };

  const handleBellClick = () => {
    useAppStore.getState().selectFinding(null);
    useAppStore.getState().setView('findings');
  };

  const renderView = () => {
    switch (view) {
      case 'overview': return <OverviewView />;
      case 'repositories': return <RepositoriesView />;
      case 'pull-requests': return <PullRequestsView />;
      case 'findings': return <FindingsView />;
      case 'finding-detail': return <FindingDetailView />;
      case 'compliance': return <ComplianceView />;
      case 'rules': return <RulesView />;
      case 'evidence': return <EvidenceView />;
      case 'reports': return <ReportsView />;
      case 'settings': return <SettingsView />;
      case 'pr-analysis': return <PRAnalysisView />;
      default: return <OverviewView />;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col border-r border-border/50 bg-card transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-16'}`}>
        <SidebarNav
          sidebarOpen={sidebarOpen}
          view={view}
          findingsCount={findingsCount}
          criticalCount={criticalCount}
        />
      </aside>

      {/* Mobile Overlay with backdrop blur */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 border-r border-border/50 bg-card transition-transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarNav
          sidebarOpen={true}
          view={view}
          onNav={() => setMobileMenuOpen(false)}
          findingsCount={findingsCount}
          criticalCount={criticalCount}
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border/50 flex items-center gap-4 px-4 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-1.5 rounded hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                data-tour="step-0"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Search findings, repos, PRs..."
                className="w-full h-9 pl-9 pr-16 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground pointer-events-none">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {/* Notification Bell */}
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleBellClick}
                    className="relative p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Bell className="h-4 w-4" />
                    {findingsCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                        {findingsCount > 99 ? '99+' : findingsCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{findingsCount} open findings</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {demoMode && (
              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                <Zap className="h-3 w-3 mr-1" />DEMO
              </Badge>
            )}
            <Badge variant="outline" className="text-xs hidden sm:flex">Acme Corp</Badge>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="animate-slide-in">{renderView()}</div>
        </main>
      </div>
      <CommandPalette />
      <KeyboardShortcutsPanel />
      <OnboardingTour
        steps={[
          {
            target: 'step-0',
            title: 'Search Anything',
            description: 'Use the search bar or press ⌘K to find findings, repos, and PRs',
            position: 'bottom',
          },
          {
            target: 'step-1',
            title: 'Run Analysis',
            description: 'Click here to run a demo compliance analysis on sample code',
            position: 'bottom',
          },
          {
            target: 'step-2',
            title: 'Dashboard Overview',
            description: 'Your compliance posture at a glance with trends and recent findings',
            position: 'right',
          },
          {
            target: 'step-3',
            title: 'Explore Findings',
            description: 'View, filter, and manage all compliance findings across repositories',
            position: 'right',
          },
        ]}
        onComplete={() => {}}
      />
    </div>
  );
}

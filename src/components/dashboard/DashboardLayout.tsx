'use client';

import { useEffect, useState } from 'react';
import { useAppStore, type AppView } from '@/stores/app';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  LayoutDashboard, GitFork, GitPullRequest, AlertTriangle, ShieldCheck,
  Settings, FileText, Scale, Database, ChevronLeft, ChevronRight,
  LogOut, Search, Zap, Menu, X, History
} from 'lucide-react';
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

export function DashboardLayout() {
  const { view, currentUser, demoMode, sidebarOpen, setView, logout, toggleSidebar, selectFinding, selectPR } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const NavContent = ({ onNav }: { onNav?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center gap-3">
        <img src="/logo.svg" alt="DriftFix" className="h-8 w-8 shrink-0" />
        {sidebarOpen && <span className="font-bold text-lg tracking-tight">DriftFix</span>}
      </div>
      <Separator className="bg-border/50" />
      <ScrollArea className="flex-1 py-3 px-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = view === item.view || (item.view === 'findings' && view === 'finding-detail');
            return (
              <TooltipProvider key={item.view} delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setView(item.view); if (item.view === 'findings') selectFinding(null); if (item.view === 'pull-requests') selectPR(null); onNav?.(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      } ${!sidebarOpen ? 'justify-center' : ''}`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {sidebarOpen && <span>{item.label}</span>}
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
          {sidebarOpen && <span>Run Demo Analysis</span>}
        </button>
      </div>
      <div className="p-3 border-t border-border/50">
        <div className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`}>
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {currentUser?.name?.charAt(0) || 'U'}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{currentUser?.name}</div>
              <div className="text-xs text-muted-foreground truncate">{currentUser?.email}</div>
            </div>
          )}
          {sidebarOpen && (
            <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <button onClick={logout} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger><TooltipContent>Sign Out</TooltipContent></Tooltip></TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );

  const runDemoAnalysis = async () => {
    try {
      toast.info('Running demo analysis...');
      const res = await fetch('/api/demo/analyze', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Analysis complete: ${data.findings?.length || 0} findings`);
        setView('findings');
      } else {
        toast.error('Analysis failed');
      }
    } catch {
      toast.error('Analysis failed');
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col border-r border-border/50 bg-card transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-16'}`}>
        <NavContent />
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex absolute top-1/2 -right-3 h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground z-10"
        >
          {sidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 border-r border-border/50 bg-card transition-transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setMobileMenuOpen(false)} className="absolute top-3 right-3 p-1 text-muted-foreground"><X className="h-5 w-5" /></button>
        <NavContent onNav={() => setMobileMenuOpen(false)} />
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border/50 flex items-center gap-4 px-4 shrink-0">
          <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-1.5 rounded hover:bg-accent">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input placeholder="Search findings, repos, PRs..." className="w-full h-9 pl-9 pr-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {demoMode && <Badge variant="outline" className="text-xs border-primary/40 text-primary"><Zap className="h-3 w-3 mr-1" />DEMO</Badge>}
            <Badge variant="outline" className="text-xs hidden sm:flex">Acme Corp</Badge>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="animate-slide-in">{renderView()}</div>
        </main>
      </div>
    </div>
  );
}

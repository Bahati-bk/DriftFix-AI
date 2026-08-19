'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '@/stores/app';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Search,
  LayoutDashboard,
  Database,
  GitPullRequest,
  AlertTriangle,
  Scale,
  ShieldCheck,
  FileText,
  History,
  Settings,
  Zap,
  FileBarChart,
  Link2,
  SearchX,
  Clock,
  Keyboard,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  category: 'navigation' | 'action' | 'quick-search';
  execute: () => void;
}

interface SearchResultItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  group: 'findings' | 'repositories' | 'pull-requests';
  execute: () => void;
  badge?: { text: string; className: string };
}

const MAX_RECENT = 3;

// In-memory recent commands storage (persists for session)
let recentCommandIds: string[] = [];

function buildCommands(): CommandItem[] {
  const store = useAppStore.getState();

  return [
    // Navigation
    { id: 'nav-overview', label: 'Go to Overview', icon: LayoutDashboard, category: 'navigation', execute: () => store.setView('overview') },
    { id: 'nav-repos', label: 'Go to Repositories', icon: Database, category: 'navigation', execute: () => store.setView('repositories') },
    { id: 'nav-prs', label: 'Go to Pull Requests', icon: GitPullRequest, category: 'navigation', execute: () => { store.selectPR(null); store.setView('pull-requests'); } },
    { id: 'nav-findings', label: 'Go to Findings', icon: AlertTriangle, category: 'navigation', execute: () => { store.selectFinding(null); store.setView('findings'); } },
    { id: 'nav-compliance', label: 'Go to Compliance', icon: Scale, category: 'navigation', execute: () => store.setView('compliance') },
    { id: 'nav-rules', label: 'Go to Rules', icon: ShieldCheck, category: 'navigation', execute: () => store.setView('rules') },
    { id: 'nav-evidence', label: 'Go to Evidence', icon: FileText, category: 'navigation', execute: () => store.setView('evidence') },
    { id: 'nav-reports', label: 'Go to Reports', icon: History, category: 'navigation', execute: () => store.setView('reports') },
    { id: 'nav-settings', label: 'Go to Settings', icon: Settings, category: 'navigation', execute: () => store.setView('settings') },
    // Actions
    { id: 'action-analyze', label: 'Run Demo Analysis', icon: Zap, category: 'action', execute: async () => {
      try {
        toast.info('Running demo analysis...');
        const res = await fetch('/api/demo/analyze', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          const run = data.analysisRun || data;
          toast.success(`Analysis complete: ${run.findings?.length || run.findingsCount || 0} findings`);
          useAppStore.getState().setView('findings');
        } else {
          toast.error('Analysis failed');
        }
      } catch {
        toast.error('Analysis failed');
      }
    } },
    { id: 'action-report', label: 'Generate Report', icon: FileBarChart, category: 'action', execute: async () => {
      try {
        toast.info('Generating SOC2 report...');
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ framework: 'SOC2' }),
        });
        if (res.ok) {
          toast.success('Report generated');
          useAppStore.getState().setView('reports');
        } else {
          toast.error('Failed to generate report');
        }
      } catch {
        toast.error('Failed to generate report');
      }
    } },
    { id: 'action-verify', label: 'Verify Evidence Chain', icon: Link2, category: 'action', execute: async () => {
      try {
        toast.info('Verifying evidence chain...');
        const res = await fetch('/api/evidence', { method: 'POST' });
        if (res.ok) {
          toast.success('Evidence chain verified');
        } else {
          toast.error('Verification failed');
        }
        useAppStore.getState().setView('evidence');
      } catch {
        toast.error('Verification failed');
      }
    } },
    // Help
    { id: 'help-shortcuts', label: 'Show Keyboard Shortcuts', icon: Keyboard, category: 'action', shortcut: '\u2318/', execute: () => {
      // Dispatch a synthetic keyboard event to open the shortcuts panel
      const ev = new KeyboardEvent('keydown', { key: '/', metaKey: true, ctrlKey: !navigator.userAgent.includes('Mac'), bubbles: true });
      document.dispatchEvent(ev);
    } },
    // Quick search
    { id: 'quick-search', label: 'Search findings...', icon: Search, category: 'quick-search', execute: () => {} },
  ];
}

const severityBadgeClass: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const prStatusVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  MERGED: 'default',
  OPEN: 'secondary',
  CLOSED: 'outline',
};

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [apiResults, setApiResults] = useState<SearchResultItem[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const commands = useMemo(() => buildCommands(), []);

  // Filter commands by query
  const filtered = query.trim()
    ? commands.filter((cmd) => cmd.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  // Build recent group (only when no query)
  const recentCommands = !query.trim()
    ? recentCommandIds
        .map((id) => commands.find((c) => c.id === id))
        .filter((c): c is CommandItem => c !== undefined)
    : [];

  const navigationCommands = filtered.filter((c) => c.category === 'navigation');
  const actionCommands = filtered.filter((c) => c.category === 'action');
  const quickSearchCommands = filtered.filter((c) => c.category === 'quick-search');

  // API search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setApiResults([]);
      setApiLoading(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    setApiLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const q = query.trim();
        const [findingsRes, reposRes, prsRes] = await Promise.all([
          fetch(`/api/findings?limit=5&search=${encodeURIComponent(q)}`),
          fetch('/api/repositories'),
          fetch('/api/pull-requests?limit=5'),
        ]);

        const results: SearchResultItem[] = [];
        const store = useAppStore.getState();

        // Parse findings
        if (findingsRes.ok) {
          const data = await findingsRes.json();
          for (const f of (data.findings || []).slice(0, 5)) {
            results.push({
              id: `finding-${f.id}`,
              label: String(f.title),
              sublabel: f.filePath ? `${f.filePath}${f.lineStart ? ':' + f.lineStart : ''}` : undefined,
              icon: AlertTriangle,
              group: 'findings',
              badge: { text: String(f.severity), className: severityBadgeClass[String(f.severity)] || 'bg-zinc-700 text-zinc-300 border-zinc-600' },
              execute: () => {
                store.selectFinding(String(f.id));
                store.setView('finding-detail');
              },
            });
          }
        }

        // Parse repos - filter client-side
        if (reposRes.ok) {
          const data = await reposRes.json();
          const qLower = q.toLowerCase();
          const filteredRepos = (data.repositories || []).filter(
            (r: Record<string, unknown>) =>
              String(r.fullName || r.name || '').toLowerCase().includes(qLower) ||
              String(r.language || '').toLowerCase().includes(qLower)
          ).slice(0, 5);
          for (const r of filteredRepos) {
            results.push({
              id: `repo-${r.id}`,
              label: String(r.fullName || r.name),
              sublabel: r.language ? String(r.language) : undefined,
              icon: Database,
              group: 'repositories',
              execute: () => store.setView('repositories'),
            });
          }
        }

        // Parse PRs - filter client-side
        if (prsRes.ok) {
          const data = await prsRes.json();
          const qLower = q.toLowerCase();
          const filteredPRs = (data.pullRequests || []).filter(
            (pr: Record<string, unknown>) =>
              String(pr.title || '').toLowerCase().includes(qLower) ||
              String(pr.sourceBranch || '').toLowerCase().includes(qLower)
          ).slice(0, 5);
          for (const pr of filteredPRs) {
            const prStatus = String(pr.status || 'open').toUpperCase();
            results.push({
              id: `pr-${pr.id}`,
              label: String(pr.title),
              sublabel: `#${pr.number} · ${pr.sourceBranch} → ${pr.targetBranch}`,
              icon: GitPullRequest,
              group: 'pull-requests',
              badge: { text: prStatus, className: prStatusVariant[prStatus] === 'default' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : prStatusVariant[prStatus] === 'secondary' ? 'bg-primary/15 text-primary border-primary/30' : 'bg-zinc-700 text-zinc-400 border-zinc-600' },
              execute: () => {
                store.selectPR(String(pr.id));
              },
            });
          }
        }

        setApiResults(results);
      } catch {
        // Silent fail for search
      } finally {
        setApiLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Group API results
  const apiGroups = useMemo(() => {
    const groups: { label: string; key: string; items: SearchResultItem[] }[] = [];
    const findings = apiResults.filter((r) => r.group === 'findings');
    const repos = apiResults.filter((r) => r.group === 'repositories');
    const prs = apiResults.filter((r) => r.group === 'pull-requests');
    if (findings.length > 0) groups.push({ label: 'Findings', key: 'findings', items: findings });
    if (repos.length > 0) groups.push({ label: 'Repositories', key: 'repositories', items: repos });
    if (prs.length > 0) groups.push({ label: 'Pull Requests', key: 'pull-requests', items: prs });
    return groups;
  }, [apiResults]);

  // Build command groups
  const commandGroups: { label: string; items: CommandItem[] }[] = useMemo(() => {
    const groups: { label: string; items: CommandItem[] }[] = [];
    if (recentCommands.length > 0) {
      groups.push({ label: 'Recent', items: recentCommands });
    }
    if (navigationCommands.length > 0) {
      groups.push({ label: 'Navigation', items: navigationCommands });
    }
    if (actionCommands.length > 0) {
      groups.push({ label: 'Actions', items: actionCommands });
    }
    if (quickSearchCommands.length > 0) {
      groups.push({ label: 'Quick Search', items: quickSearchCommands });
    }
    return groups;
  }, [recentCommands, navigationCommands, actionCommands, quickSearchCommands]);

  // Combine all groups: API results first (when searching), then commands
  const allGroups = useMemo(() => {
    if (query.trim() && apiGroups.length > 0) {
      // When searching, show API results first, then command matches
      return [...apiGroups, ...commandGroups];
    }
    return commandGroups;
  }, [query, apiGroups, commandGroups]);

  // Build flat items list with a type discriminator
  type FlatItem =
    | { type: 'command'; item: CommandItem }
    | { type: 'search'; item: SearchResultItem };

  const flatItems: FlatItem[] = useMemo(() => {
    return allGroups.flatMap((g) => {
      // Check if this group is from API results
      const isApiGroup = ['findings', 'repositories', 'pull-requests'].includes(g.key || '');
      if (isApiGroup) {
        return (g as { key: string; items: SearchResultItem[] }).items.map((item) => ({ type: 'search' as const, item }));
      }
      return (g as { items: CommandItem[] }).items.map((item) => ({ type: 'command' as const, item }));
    });
  }, [allGroups]);

  const hasResults = flatItems.length > 0 || apiLoading;

  const executeCommand = useCallback((cmd: CommandItem) => {
    // Special handling for quick search: use current query
    if (cmd.id === 'quick-search' && query.trim()) {
      useAppStore.getState().setSearchQuery(query.trim());
      useAppStore.getState().selectFinding(null);
      useAppStore.getState().setView('findings');
    } else {
      cmd.execute();
    }
    // Track in recent
    recentCommandIds = [cmd.id, ...recentCommandIds.filter((id) => id !== cmd.id)].slice(0, MAX_RECENT);
    setQuery('');
    setActiveIndex(0);
    setIsOpen(false);
  }, [setIsOpen, query]);

  const executeFlatItem = useCallback((fi: FlatItem) => {
    if (fi.type === 'command') {
      executeCommand(fi.item);
    } else {
      fi.item.execute();
      setQuery('');
      setActiveIndex(0);
      setIsOpen(false);
    }
  }, [executeCommand, setIsOpen]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setApiResults([]);
      setApiLoading(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (flatItems.length > 0 ? (i + 1) % flatItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (flatItems.length > 0 ? (i - 1 + flatItems.length) % flatItems.length : 0));
    } else if (e.key === 'Enter' && flatItems[activeIndex]) {
      e.preventDefault();
      executeFlatItem(flatItems[activeIndex]);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  // Reset active index when items change
  useEffect(() => {
    setActiveIndex(0);
  }, [query, apiResults]);

  let runningIndex = -1;

  const renderSearchItem = (item: SearchResultItem, idx: number, isActive: boolean, groupLabel: string) => {
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        data-active={isActive}
        onClick={() => executeFlatItem({ type: 'search', item })}
        onMouseEnter={() => setActiveIndex(idx)}
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left cursor-pointer ${
          isActive
            ? 'bg-primary/10 text-primary border-l-2 border-primary'
            : 'text-zinc-300 hover:bg-zinc-800/60 border-l-2 border-transparent'
        }`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-zinc-500'}`} />
        <span className="flex-1 truncate">{item.label}</span>
        {item.sublabel && (
          <span className="text-xs text-zinc-500 truncate max-w-[120px] hidden sm:inline">{item.sublabel}</span>
        )}
        {item.badge && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-5 font-bold border ${item.badge.className}`}
          >
            {item.badge.text}
          </Badge>
        )}
      </button>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">Search commands and navigate</DialogDescription>

        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          {apiLoading && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 text-zinc-500 animate-spin" />
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {hasResults ? (
            allGroups.map((group, groupIdx) => {
              const isApiGroup = (group as Record<string, unknown>).key !== undefined;
              const items = isApiGroup
                ? (group as { items: SearchResultItem[] }).items
                : (group as { items: CommandItem[] }).items;

              return (
                <div key={group.label}>
                  {groupIdx > 0 && <Separator className="my-2 bg-zinc-800" />}
                  <div className="px-3 py-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      {group.label}
                    </span>
                  </div>
                  {isApiGroup
                    ? (group as { items: SearchResultItem[] }).items.map((item) => {
                        runningIndex++;
                        const idx = runningIndex;
                        const isActive = idx === activeIndex;
                        return renderSearchItem(item, idx, isActive, group.label);
                      })
                    : (group as { items: CommandItem[] }).items.map((cmd) => {
                        runningIndex++;
                        const idx = runningIndex;
                        const isActive = idx === activeIndex;
                        const Icon = cmd.icon;
                        return (
                          <button
                            key={cmd.id}
                            data-active={isActive}
                            onClick={() => executeFlatItem({ type: 'command', item: cmd })}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left cursor-pointer ${
                              isActive
                                ? 'bg-primary/10 text-primary border-l-2 border-primary'
                                : 'text-zinc-300 hover:bg-zinc-800/60 border-l-2 border-transparent'
                            }`}
                          >
                            <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-zinc-500'}`} />
                            <span className="flex-1">{cmd.label}</span>
                            {cmd.shortcut && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-5 font-mono bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-800"
                              >
                                {cmd.shortcut}
                              </Badge>
                            )}
                            {group.label === 'Recent' && (
                              <Clock className="h-3 w-3 text-zinc-600" />
                            )}
                          </button>
                        );
                      })}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <SearchX className="h-8 w-8 mb-3" />
              <p className="text-sm">No results found</p>
              <p className="text-xs text-zinc-600 mt-1">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-zinc-800 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
            <span>navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono text-[10px]">↵</kbd>
            <span>select</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono text-[10px]">esc</kbd>
            <span>close</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

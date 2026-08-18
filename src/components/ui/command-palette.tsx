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
    { id: 'help-shortcuts', label: 'Show Keyboard Shortcuts', icon: Keyboard, category: 'action', shortcut: '⌘/', execute: () => {
      // Dispatch a synthetic keyboard event to open the shortcuts panel
      const ev = new KeyboardEvent('keydown', { key: '/', metaKey: true, ctrlKey: !navigator.userAgent.includes('Mac'), bubbles: true });
      document.dispatchEvent(ev);
    } },
    // Quick search
    { id: 'quick-search', label: 'Search findings...', icon: Search, category: 'quick-search', execute: () => {} },
  ];
}

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

  // Build grouped list
  const allGroups: { label: string; items: CommandItem[] }[] = useMemo(() => {
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

  const flatItems = allGroups.flatMap((g) => g.items);
  const hasResults = flatItems.length > 0;

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
      executeCommand(flatItems[activeIndex]);
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

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  let runningIndex = -1;

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
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {hasResults ? (
            allGroups.map((group, groupIdx) => {
              const items = group.items;
              return (
                <div key={group.label}>
                  {groupIdx > 0 && <Separator className="my-2 bg-zinc-800" />}
                  <div className="px-3 py-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      {group.label}
                    </span>
                  </div>
                  {items.map((cmd) => {
                    runningIndex++;
                    const idx = runningIndex;
                    const isActive = idx === activeIndex;
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        data-active={isActive}
                        onClick={() => executeCommand(cmd)}
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
              <p className="text-sm">No commands found</p>
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Keyboard, Compass, Zap, HelpCircle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface ShortcutEntry {
  action: string;
  keys: string[];
}

interface ShortcutCategory {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcuts: ShortcutEntry[];
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

const mod = isMac ? '⌘' : 'Ctrl';
const modShift = isMac ? '⌘⇧' : 'Ctrl+Shift';

const categories: ShortcutCategory[] = [
  {
    title: 'Navigation',
    icon: Compass,
    shortcuts: [
      { action: 'Overview', keys: ['G', 'O'] },
      { action: 'Repositories', keys: ['G', 'R'] },
      { action: 'Pull Requests', keys: ['G', 'P'] },
      { action: 'Findings', keys: ['G', 'F'] },
      { action: 'Compliance', keys: ['G', 'C'] },
      { action: 'Rules', keys: ['G', 'L'] },
      { action: 'Evidence', keys: ['G', 'E'] },
      { action: 'Reports', keys: ['G', 'T'] },
      { action: 'Settings', keys: ['G', 'S'] },
    ],
  },
  {
    title: 'Actions',
    icon: Zap,
    shortcuts: [
      { action: 'Command Palette', keys: [mod, 'K'] },
      { action: 'Search', keys: [mod, 'K'] },
      { action: 'Run Analysis', keys: [modShift, 'A'] },
      { action: 'Toggle Sidebar', keys: [mod, 'B'] },
    ],
  },
  {
    title: 'Help',
    icon: HelpCircle,
    shortcuts: [
      { action: 'Keyboard Shortcuts', keys: [mod, '/'] },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Kbd component                                                      */
/* ------------------------------------------------------------------ */

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded border border-zinc-700 bg-zinc-800/80 text-[11px] font-mono font-medium text-zinc-300 shadow-sm">
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------ */
/*  KeyboardShortcutsPanel                                             */
/* ------------------------------------------------------------------ */

export function KeyboardShortcutsPanel() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  // Global Ctrl+/ (Cmd+/) listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  // G-prefixed navigation shortcuts (only when not in an input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire when focused on input/textarea/contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      // Close the shortcuts panel first
      if (open && e.key !== 'Escape') {
        setOpen(false);
      }

      if (e.key === 'g') {
        const gNav: Record<string, string> = {
          o: 'overview',
          r: 'repositories',
          p: 'pull-requests',
          f: 'findings',
          c: 'compliance',
          l: 'rules',
          e: 'evidence',
          t: 'reports',
          s: 'settings',
        };

        const onSecondKey = (ev: KeyboardEvent) => {
          ev.preventDefault();
          const target = gNav[ev.key.toLowerCase()];
          if (target) {
            // Dynamic import of store to avoid circular deps
            import('@/stores/app').then(({ useAppStore }) => {
              const store = useAppStore.getState();
              if (target === 'findings') store.selectFinding(null);
              if (target === 'pull-requests') store.selectPR(null);
              store.setView(target as Parameters<typeof store.setView>[0]);
            });
          }
          document.removeEventListener('keydown', onSecondKey);
          clearTimeout(timeout);
        };

        const timeout = setTimeout(() => {
          document.removeEventListener('keydown', onSecondKey);
        }, 800);

        document.addEventListener('keydown', onSecondKey);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl"
      >
        <DialogTitle className="sr-only">Keyboard Shortcuts</DialogTitle>
        <DialogDescription className="sr-only">
          View all available keyboard shortcuts
        </DialogDescription>

        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 border border-primary/20">
            <Keyboard className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-zinc-100">
              Keyboard Shortcuts
            </h2>
            <p className="text-xs text-zinc-500">
              Navigate and control DriftFix from your keyboard
            </p>
          </div>
          <kbd className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-400">
            <span className="text-xs">{mod}</span>/
          </kbd>
        </div>

        {/* Shortcut Grid - two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-zinc-800/60 p-2">
          {categories.map((category, catIdx) => {
            const CategoryIcon = category.icon;
            return (
              <div
                key={category.title}
                className={
                  catIdx > 0 && categories.length <= 3
                    ? 'md:pl-4 pt-4 md:pt-0'
                    : ''
                }
              >
                {/* Category header */}
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <CategoryIcon className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {category.title}
                  </span>
                </div>

                {/* Shortcut rows */}
                <div className="space-y-px">
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.action}
                      className="flex items-center justify-between gap-4 px-4 py-2 rounded-md transition-colors hover:bg-zinc-800/40"
                    >
                      <span className="text-sm text-zinc-300">
                        {shortcut.action}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && (
                              <span className="text-[10px] text-zinc-600 mx-0.5">
                                +
                              </span>
                            )}
                            <Kbd>{key}</Kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <Separator className="bg-zinc-800" />

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono text-[10px]">
              G
            </kbd>
            <span>then a letter to navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono text-[10px]">
              esc
            </kbd>
            <span>to close</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

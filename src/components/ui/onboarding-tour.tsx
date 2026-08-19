'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface TourStep {
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete: () => void;
}

const STORAGE_KEY = 'driftfix-tour-completed';
const HIGHLIGHT_CLASS = 'ring-2 ring-primary ring-offset-2 ring-offset-background';

function measurePosition(step: TourStep): { tooltipStyle: React.CSSProperties; arrowStyle: React.CSSProperties } | null {
  const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
  if (!el) return null;

  el.classList.add(HIGHLIGHT_CLASS);
  el.style.position = 'relative';
  el.style.zIndex = '40';

  const rect = el.getBoundingClientRect();
  const gap = 12;
  const tooltipWidth = 320;
  const tooltipHeight = 200;

  let top = 0;
  let left = 0;
  let arrowTop = 0;
  let arrowLeft = 0;

  switch (step.position) {
    case 'bottom': {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      arrowTop = -6;
      arrowLeft = tooltipWidth / 2 - 6;
      break;
    }
    case 'top': {
      top = rect.top - tooltipHeight - gap;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      arrowTop = tooltipHeight - 6;
      arrowLeft = tooltipWidth / 2 - 6;
      break;
    }
    case 'right': {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + gap;
      arrowTop = tooltipHeight / 2 - 6;
      arrowLeft = -6;
      break;
    }
    case 'left': {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - tooltipWidth - gap;
      arrowTop = tooltipHeight / 2 - 6;
      arrowLeft = tooltipWidth - 6;
      break;
    }
  }

  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  left = Math.max(8, Math.min(left, vpW - tooltipWidth - 8));
  top = Math.max(8, Math.min(top, vpH - tooltipHeight - 8));

  return {
    tooltipStyle: { position: 'fixed' as const, top, left, width: tooltipWidth, zIndex: 50 },
    arrowStyle: {
      position: 'absolute' as const,
      top: arrowTop,
      left: arrowLeft,
      width: 12,
      height: 12,
      background: 'oklch(0.17 0.008 260)',
      borderRight: '1px solid oklch(0.28 0.01 260)',
      borderBottom: '1px solid oklch(0.28 0.01 260)',
      transform: 'rotate(45deg)',
      pointerEvents: 'none' as const,
    },
  };
}

export function OnboardingTour({ steps, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [show, setShow] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetElRef = useRef<HTMLElement | null>(null);

  const removeHighlight = useCallback(() => {
    if (targetElRef.current) {
      targetElRef.current.classList.remove(HIGHLIGHT_CLASS);
      targetElRef.current.style.position = '';
      targetElRef.current.style.zIndex = '';
      targetElRef.current = null;
    }
  }, []);

  const updatePosition = useCallback((stepIdx: number, currentSteps: TourStep[]) => {
    removeHighlight();
    if (stepIdx >= currentSteps.length) return;
    const result = measurePosition(currentSteps[stepIdx]);
    if (result) {
      targetElRef.current = document.querySelector(`[data-tour="${currentSteps[stepIdx].target}"]`) as HTMLElement | null;
      setTooltipStyle(result.tooltipStyle);
      setArrowStyle(result.arrowStyle);
    }
  }, [removeHighlight]);

  // Check if tour was completed, then show after delay
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      setShow(true);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // Position tooltip when show or step changes
  useEffect(() => {
    if (!show) return;
    // Use setTimeout(0) to avoid synchronous setState in effect
    const timer = setTimeout(() => updatePosition(currentStep, steps), 0);
    return () => clearTimeout(timer);
  }, [show, currentStep, updatePosition, steps]);

  // Re-position on resize (event handler callback is allowed)
  useEffect(() => {
    if (!show) return;
    const onResize = () => {
      removeHighlight();
      if (currentStep >= steps.length) return;
      const result = measurePosition(steps[currentStep]);
      if (result) {
        targetElRef.current = document.querySelector(`[data-tour="${steps[currentStep].target}"]`) as HTMLElement | null;
        setTooltipStyle(result.tooltipStyle);
        setArrowStyle(result.arrowStyle);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [show, currentStep, removeHighlight, steps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => removeHighlight();
  }, [removeHighlight]);

  const handleComplete = useCallback(() => {
    removeHighlight();
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    onComplete();
  }, [removeHighlight, onComplete]);

  const handleNext = () => {
    if (currentStep >= steps.length - 1) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  // Click outside to advance
  useEffect(() => {
    if (!show) return;
    const handleClick = (e: MouseEvent) => {
      const tooltip = tooltipRef.current;
      if (tooltip && !tooltip.contains(e.target as Node)) {
        if (targetElRef.current?.contains(e.target as Node)) return;
        handleNext();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [show, handleNext]);

  // Escape to skip
  useEffect(() => {
    if (!show) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleComplete();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [show, handleComplete]);

  if (!show || steps.length === 0) return null;

  const step = steps[currentStep];

  return (
    <div
      ref={tooltipRef}
      style={tooltipStyle}
      className="animate-fade-slide-in"
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-[-1]"
        onClick={handleComplete}
      />

      {/* Arrow */}
      <div style={arrowStyle} />

      {/* Card */}
      <Card className="border-border bg-card shadow-xl shadow-primary/5">
        <CardContent className="p-4 space-y-3">
          {/* Step indicator + skip */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-medium">
              Step {currentStep + 1} of {steps.length}
            </span>
            <button
              onClick={handleComplete}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          {/* Title & description */}
          <div>
            <h3 className="text-sm font-bold mb-1">{step.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="ghost" size="sm" onClick={handlePrev} className="h-7 text-xs gap-1 px-2">
                  <ChevronLeft className="h-3 w-3" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleComplete}
                className="h-7 text-xs px-2"
              >
                Skip
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                className="h-7 text-xs gap-1 px-3"
              >
                {currentStep >= steps.length - 1 ? 'Done' : 'Next'}
                {currentStep < steps.length - 1 && <ChevronRight className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

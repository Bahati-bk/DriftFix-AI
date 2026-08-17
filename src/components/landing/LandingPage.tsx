'use client';

import { motion } from 'framer-motion';
import { Shield, Zap, Eye, FileText, Lock, Cpu, GitBranch, Activity, ArrowRight, CheckCircle2, BarChart3, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/stores/app';
import { toast } from 'sonner';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.5 },
};

const stagger = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const features = [
  { icon: GitBranch, title: 'PR Analysis', desc: 'Automatically analyze every pull request for compliance and security issues before merge.' },
  { icon: Cpu, title: 'AI + Rules Engine', desc: 'Hybrid detection combining deterministic rules with AI contextual analysis.' },
  { icon: BookOpen, title: 'Compliance Mapping', desc: 'Every finding mapped to SOC 2, GDPR controls with clear explanations.' },
  { icon: FileText, title: 'Evidence Ledger', desc: 'Tamper-evident audit trail with hash-chained integrity verification.' },
  { icon: Zap, title: 'Shift-Left Compliance', desc: 'Catch compliance drift during development, not months after deployment.' },
  { icon: Shield, title: 'Human-in-the-Loop', desc: 'AI recommends; humans decide. Every decision recorded and auditable.' },
  { icon: Eye, title: 'AI Confidence Scores', desc: 'Every finding includes confidence rating so reviewers can prioritize effectively.' },
  { icon: Lock, title: 'Secret Redaction', desc: 'Sensitive values automatically redacted before sending code to AI analysis.' },
];

const pipelineSteps = [
  { label: 'Pull Request Created', icon: GitBranch },
  { label: 'Analyzing Diff', icon: Eye },
  { label: 'Scanning Rules', icon: Shield },
  { label: 'AI Context Review', icon: Cpu },
  { label: 'Mapping Controls', icon: BookOpen },
  { label: 'Risk Identified', icon: Activity },
  { label: 'Developer Notified', icon: Zap },
];

export function LandingPage() {
  const login = useAppStore((s) => s.login);
  const setView = useAppStore((s) => s.setView);

  const handleDemo = async () => {
    try {
      const res = await fetch('/api/auth/demo-login', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        login(data.user, data.orgId);
        toast.success('Welcome to DriftFix Demo');
      }
    } catch {
      toast.error('Demo login failed');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="DriftFix" className="h-8 w-8" />
            <span className="text-xl font-bold tracking-tight">DriftFix</span>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full hidden sm:inline">AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setView('login')}>Sign In</Button>
            <Button size="sm" onClick={handleDemo}>
              <Zap className="h-4 w-4 mr-1.5" />
              Start Demo
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <motion.div {...fadeInUp} className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-full px-4 py-1.5 text-sm text-muted-foreground mb-8">
            <Shield className="h-4 w-4 text-primary" />
            AI-Powered Compliance Engineering
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Catch compliance drift
            <br />
            <span className="gradient-text">before it ships.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            DriftFix watches code changes as they happen and turns compliance into a continuous engineering workflow.
            Developers fix risks before production. Auditors get evidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-base px-8" onClick={handleDemo}>
              <Zap className="h-5 w-5 mr-2" />
              Start Demo
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" onClick={() => {
              document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              See How It Works
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Problem */}
      <section className="border-t border-border/50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div {...fadeInUp} className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Compliance shouldn&apos;t begin three months after deployment.</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Traditional compliance tools focus on periodic audits. DriftFix moves compliance into the development workflow.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div {...stagger} transition={{ delay: 0.1 }}>
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-6">
                  <div className="text-sm font-mono text-muted-foreground mb-3">Traditional Approach</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-1 bg-destructive/20 rounded text-destructive font-medium">CODE</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="px-2 py-1 bg-destructive/20 rounded text-destructive font-medium">DEPLOY</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="px-2 py-1 bg-destructive/20 rounded text-destructive font-medium">AUDIT</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="px-2 py-1 bg-destructive/20 rounded text-destructive font-bold">DISCOVER PROBLEM</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div {...stagger} transition={{ delay: 0.2 }}>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-6">
                  <div className="text-sm font-mono text-muted-foreground mb-3">DriftFix Approach</div>
                  <div className="flex items-center gap-1 text-sm flex-wrap">
                    <span className="px-2 py-1 bg-primary/20 rounded text-primary font-medium">CODE CHANGE</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="px-2 py-1 bg-primary/20 rounded text-primary font-medium">ANALYZE</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="px-2 py-1 bg-primary/20 rounded text-primary font-medium">EXPLAIN</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="px-2 py-1 bg-primary/20 rounded text-primary font-medium">REMEDIATE</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="px-2 py-1 bg-primary/20 rounded text-primary font-medium">APPROVE</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="px-2 py-1 bg-primary/20 rounded text-primary font-medium">DEPLOY</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="px-2 py-1 bg-primary/20 rounded text-primary font-bold">EVIDENCE</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-border/50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div {...fadeInUp} className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-4">How DriftFix Works</h2>
            <p className="text-muted-foreground text-lg">From pull request to compliance evidence in seconds.</p>
          </motion.div>
          <div className="relative">
            <div className="hidden md:block absolute top-6 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
              {pipelineSteps.map((step, i) => (
                <motion.div
                  key={step.label}
                  {...stagger}
                  transition={{ delay: i * 0.1 }}
                  className="flex flex-col items-center text-center gap-3"
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center relative z-10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground leading-tight">{step.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div {...fadeInUp} className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-4">Built for Modern Compliance Engineering</h2>
            <p className="text-muted-foreground text-lg">Not merely an LLM wrapper — a hybrid compliance engine.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div key={f.title} {...stagger} transition={{ delay: i * 0.05 }}>
                <Card className="h-full hover:border-primary/30 transition-colors">
                  <CardContent className="p-5">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Frameworks */}
      <section className="border-t border-border/50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div {...fadeInUp} className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Compliance Frameworks</h2>
            <p className="text-muted-foreground text-lg">Mapped to the controls that matter.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-6">
            <motion.div {...stagger} transition={{ delay: 0.1 }}>
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-3">SOC 2</h3>
                  <p className="text-sm text-muted-foreground mb-4">Trust Services Criteria including security, availability, processing integrity, confidentiality, and privacy.</p>
                  <div className="space-y-2">
                    {['CC6.1 — Logical & Physical Access Controls', 'CC6.6 — Data Encryption', 'CC7.1 — System Monitoring', 'P1.2 — Privacy Notice'].map(c => (
                      <div key={c} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div {...stagger} transition={{ delay: 0.2 }}>
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-3">GDPR</h3>
                  <p className="text-sm text-muted-foreground mb-4">General Data Protection Regulation principles for software development.</p>
                  <div className="space-y-2">
                    {['Art.5(1)(c) — Data Minimisation', 'Art.25 — Data Protection by Design', 'Art.32 — Security of Processing'].map(c => (
                      <div key={c} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/50 py-20">
        <motion.div {...fadeInUp} className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to catch drift before it ships?</h2>
          <p className="text-muted-foreground text-lg mb-8">Try the demo or connect your GitHub repository to get started.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-base px-8" onClick={handleDemo}>
              <Zap className="h-5 w-5 mr-2" />Start Demo
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" onClick={() => setView('register')}>
              <BarChart3 className="h-5 w-5 mr-2" />Sign Up Free
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            DriftFix provides engineering compliance guidance and evidence automation. It is not legal advice or a certification.
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img src="/logo.svg" alt="" className="h-5 w-5" />
            <span>DriftFix AI</span>
            <span className="text-border">|</span>
            <span>Catch compliance drift before it ships.</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Security & Trust</span>
            <span className="text-border">|</span>
            <span>Documentation</span>
            <span className="text-border">|</span>
            <span>Privacy Policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadRulesConfig, loadFrameworkConfig } from '@/lib/rule-engine/config-loader';
import type { ActionTier, ComplianceRulesConfig } from '@/lib/rule-engine/types';

function getRulesByTierFromConfig(config: ComplianceRulesConfig, tier: ActionTier) {
  return config.rules.filter((r) => r.tier === tier);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const framework = searchParams.get('framework');
    const raw = searchParams.get('raw');

    if (raw === 'yaml') {
      const configPath = resolve(process.cwd(), 'compliance-rules.yaml');
      const yamlContent = readFileSync(configPath, 'utf-8');
      return new NextResponse(yamlContent, {
        headers: { 'Content-Type': 'text/yaml; charset=utf-8' },
      });
    }

    const config = framework ? loadFrameworkConfig(framework) : loadRulesConfig();

    const tiers = {
      BLOCKING: getRulesByTierFromConfig(config, 'BLOCKING' as ActionTier),
      WARNING: getRulesByTierFromConfig(config, 'WARNING' as ActionTier),
      INFO: getRulesByTierFromConfig(config, 'INFO' as ActionTier),
    };

    return NextResponse.json({ config, tiers, framework: framework || 'all' });
  } catch (error) {
    console.error('rules-config error:', error);
    return NextResponse.json(
      { error: 'Failed to load rules config', details: String(error) },
      { status: 500 }
    );
  }
}

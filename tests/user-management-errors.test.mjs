import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const client = readFileSync(new URL('../lib/updateUserAccess.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');

// Exercise the pure error helpers without requiring a browser or Firebase credentials.
const helperSource = client.slice(
  client.indexOf('function normalizeCallableError(error) {'),
  client.indexOf('export async function updateUserAccess(payload) {')
);
const { normalizeCallableError, describeCallableError } = new Function(
  `${helperSource}\nreturn { normalizeCallableError, describeCallableError };`
)();

test('User update failure uses a readable text diagnostic, not a console object', () => {
  assert.match(client, /console\.warn\(`\[User Management\] updateUserAccess failed:/);
  assert.doesNotMatch(client, /console\.error\("UPDATE USER ERROR:", \{/);
  assert.equal(describeCallableError({ code: 'functions/permission-denied', message: 'No access' }),
    'code=functions/permission-denied; message=No access');
});

test('Old server and Firebase internal errors produce actionable explanation', () => {
  const failure = normalizeCallableError({ code: 'functions/internal', message: 'internal' });
  assert.match(failure.message, /Cloud Function logs|function logs/i);
  assert.equal(failure.code, 'functions/internal');
});

test('Server role errors preserve the original useful error', () => {
  const failure = normalizeCallableError({ code: 'functions/failed-precondition', message: 'Duplicate user profile has another role' });
  assert.match(failure.message, /Duplicate user profile/);
});

test('Authentication and permission errors have distinct messages', () => {
  assert.match(normalizeCallableError({ code: 'functions/unauthenticated' }).message, /sign in again/i);
  assert.match(normalizeCallableError({ code: 'functions/permission-denied' }).message, /permission/i);
});

test('Undeployed callable and missing users have distinguishable messages', () => {
  assert.match(normalizeCallableError({ code: 'functions/not-found', message: 'NOT_FOUND' }).message, /Cloud Function/);
  assert.match(normalizeCallableError({ code: 'functions/not-found', message: 'User not found' }).message, /user record/i);
});

test('Existing role-model verification remains active', () => {
  assert.match(client, /roleModelVersion !== "2\.7\.5\.8\.3"/);
  assert.match(server, /roleModelVersion: "2\.7\.5\.8\.3"/);
});

test('Cloud Function logs failure stage without exposing the saved profile data', () => {
  assert.match(server, /let updateStage = "authenticate_actor"/);
  assert.match(server, /updateStage = "write_user_and_audit_transaction"/);
  assert.match(server, /updateUserAccess failed/);
  assert.match(server, /if \(error instanceof HttpsError\) throw error;/);
});

import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { buildPluginTargets, defaultRoot, files } from '../scripts/build-plugin-targets.mjs';
import { validateTarget } from '../scripts/validate-plugin.mjs';
import { measureContext } from '../scripts/measure-context.mjs';
import { prepareFixture, inspectFixture, deliverFixture, cleanupFixture, correctSource } from '../.agents/skills/verify-auto-work/scripts/fixture.mjs';

test('Auto-Work references close over every package without shipping the project verifier', () => {
  const parent = mkdtempSync(join(tmpdir(), 'workflow-auto-package-'));
  try {
    const built = buildPluginTargets(parent);
    for (const host of ['cursor', 'codex', 'agent-plugins']) {
      const root = built[host].path;
      for (const path of ['skills/auto-work/SKILL.md', 'references/implementation-work.md', ...['operation', 'reviewer', 'delivery'].map(name => `skills/auto-work/references/${name}.md`)]) assert.ok(existsSync(join(root, path)), `${host}: ${path}`);
      const entries = files(root).map(path => relative(root, path));
      assert.ok(!entries.some(path => path.includes('verify-auto-work') || path.endsWith('fixture.mjs')));
      assert.deepEqual(validateTarget(root, host, built.version), []);
      rmSync(join(root, 'references/implementation-work.md'));
      assert.ok(validateTarget(root, host, built.version).some(error => error.includes('implementation-work.md')));
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test('Auto-Work context isolates delivery and counts shared execution instructions once', () => {
  const parent = mkdtempSync(join(tmpdir(), 'workflow-auto-context-'));
  try {
    const root = join(parent, 'source');
    cpSync(defaultRoot, root, { recursive: true, filter: path => !['.git', '.build', 'node_modules'].includes(relative(defaultRoot, path).split(/[\\/]/)[0]) });
    const before = measureContext(root);
    for (const target of Object.values(before.targets)) {
      const { entry, light, dark, delivery } = target.autoWorkFlows;
      assert.deepEqual(light, dark);
      assert.equal(light.totalTokens, entry.tokens + light.tokens);
      assert.equal(new Set([...entry.documents, ...light.documents]).size, entry.documents.length + light.documents.length);
      assert.ok(light.documents.includes('references/implementation-work.md'));
      assert.ok(!light.documents.some(path => path.endsWith('/delivery.md')));
      assert.ok(delivery.documents.some(path => path.endsWith('/delivery.md')));
    }
    const path = join(root, 'skills/auto-work/references/delivery.md');
    writeFileSync(path, readFileSync(path, 'utf8') + 'x'.repeat(400));
    const after = measureContext(root);
    for (const host of Object.keys(before.targets)) {
      assert.deepEqual(after.targets[host].flows, before.targets[host].flows);
      assert.deepEqual(after.targets[host].autoWorkFlows.light, before.targets[host].autoWorkFlows.light);
      assert.equal(after.targets[host].autoWorkFlows.delivery.totalTokens - before.targets[host].autoWorkFlows.delivery.totalTokens, 100);
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test('local gate rejects uncommissioned, broken and stale candidates and delivers an unchanged candidate once', () => {
  const fixture = prepareFixture();
  try {
    const initial = inspectFixture(fixture.base);
    assert.equal(initial.sourceChanged, false);
    assert.throws(() => deliverFixture(fixture.base, initial.sourceDigest, false), /not commissioned/);
    assert.throws(() => deliverFixture(fixture.base, initial.sourceDigest, true), /gate failed/);
    assert.equal(inspectFixture(fixture.base).delivery, null);
    writeFileSync(join(fixture.workspace, 'csv.mjs'), correctSource);
    assert.throws(() => deliverFixture(fixture.base, initial.sourceDigest, true), /stale/);
    const reviewed = inspectFixture(fixture.base);
    const receipt = deliverFixture(fixture.base, reviewed.sourceDigest, true);
    assert.equal(receipt.count, 1);
    assert.equal(deliverFixture(fixture.base, reviewed.sourceDigest, true).alreadyDelivered, true);
    assert.equal(inspectFixture(fixture.base).delivery.count, 1);
    writeFileSync(join(fixture.workspace, 'unrelated.txt'), 'overwritten');
    assert.throws(() => deliverFixture(fixture.base, reviewed.sourceDigest, true), /unrelated/);
  } finally { rmSync(fixture.base, { recursive: true, force: true }); }
});

test('fixture cleanup preserves evidence and rejects an unowned directory', () => {
  const fixture = prepareFixture();
  const other = mkdtempSync(join(tmpdir(), 'workflow-unrelated-'));
  try {
    assert.throws(() => cleanupFixture(other), /unexpected fixture/);
    assert.ok(existsSync(other));
    const cleaned = cleanupFixture(fixture.base);
    assert.equal(cleaned.workspaceRemoved, true);
    assert.ok(existsSync(join(cleaned.evidence, 'final-state.json')));
    assert.ok(existsSync(join(cleaned.evidence, 'baseline.json')));
    assert.equal(cleanupFixture(fixture.base).workspaceRemoved, true);
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
});


test('local gate rejects damage to unrelated work caused during candidate execution', () => {
  const fixture = prepareFixture();
  try {
    writeFileSync(join(fixture.workspace, 'csv.mjs'), correctSource + "import {writeFileSync} from 'node:fs';\nwriteFileSync(new URL('./unrelated.txt', import.meta.url), 'changed during gate');\n");
    const candidate = inspectFixture(fixture.base);
    assert.equal(candidate.unrelatedPreserved, true);
    assert.throws(() => deliverFixture(fixture.base, candidate.sourceDigest, true), /unrelated/);
    assert.equal(inspectFixture(fixture.base).delivery, null);
  } finally { rmSync(fixture.base, { recursive: true, force: true }); }
});

for (const missing of ['csv.mjs', 'unrelated.txt']) {
  test(`cleanup preserves failure evidence when ${missing} is missing`, () => {
    const fixture = prepareFixture();
    try {
      rmSync(join(fixture.workspace, missing));
      const result = cleanupFixture(fixture.base);
      assert.equal(result.workspaceRemoved, true);
      const snapshot = JSON.parse(readFileSync(join(result.evidence, 'final-state.json'), 'utf8'));
      assert.equal(snapshot.inspectionError.code, 'ENOENT');
      assert.ok(snapshot.inspectionError.message.includes(missing));
      assert.ok(existsSync(join(result.evidence, 'baseline.json')));
    } finally { rmSync(fixture.base, { recursive: true, force: true }); }
  });
}

test('cleanup still rejects redirected workspace and preserves the external target', () => {
  const fixture = prepareFixture();
  const other = mkdtempSync(join(tmpdir(), 'workflow-unrelated-'));
  try {
    writeFileSync(join(other, 'keep.txt'), 'existing');
    rmSync(fixture.workspace, { recursive: true });
    symlinkSync(other, fixture.workspace);
    assert.throws(() => cleanupFixture(fixture.base), /must not be a symlink/);
    assert.equal(readFileSync(join(other, 'keep.txt'), 'utf8'), 'existing');
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
});

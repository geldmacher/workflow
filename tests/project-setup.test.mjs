import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { buildPluginTargets, defaultRoot, files } from '../scripts/build-plugin-targets.mjs';
import { validateTarget } from '../scripts/validate-plugin.mjs';
import { prepareFixture, inspectFixture, probeFixture, cleanupFixture } from '../.agents/skills/verify-project-setup/scripts/fixture.mjs';

test('project setup skills and shared guidance close over every package without shipping the observer', () => {
  const parent = mkdtempSync(join(tmpdir(), 'workflow-setup-package-'));
  try {
    const built = buildPluginTargets(parent);
    for (const host of ['cursor','codex','agent-plugins']) {
      const root = built[host].path;
      for (const name of ['setup-workflow','maintain-workflow']) {
        assert.ok(existsSync(join(root, 'skills', name, 'SKILL.md')));
        assert.equal(existsSync(join(root, 'commands', name + '.md')), host === 'cursor');
      }
      assert.deepEqual(validateTarget(root, host, built.version), []);
      const playbooks = ['behavior-tests','check-commands-ci','code-checks','evaluations','project-guidance','project-skills','subagent-roles','test-data-isolation','user-journeys'];
      const directory = 'skills/setup-workflow/references';
      assert.deepEqual(files(join(root,directory)).map(path => relative(join(root,directory),path)), [...playbooks,'catalog'].sort().map(name => name+'.md'));
      const catalog = readFileSync(join(root,directory,'catalog.md'),'utf8');
      const linked = [...catalog.matchAll(/\]\(([a-z-]+)\.md\)/g)].map(match => match[1]).sort();
      assert.deepEqual(linked,playbooks);
      for (const name of playbooks) assert.equal(readFileSync(join(root,directory,name+'.md'),'utf8'),readFileSync(join(defaultRoot,directory,name+'.md'),'utf8'));
      assert.ok(!files(root).some(path => relative(root,path).includes('verify-project-setup')));
      const removed = join(root,directory,'behavior-tests.md');
      const contents = readFileSync(removed);
      rmSync(removed);
      assert.ok(validateTarget(root,host,built.version).some(error => error.includes('behavior-tests.md')));
      writeFileSync(removed,contents);
      rmSync(join(root, 'references/project-readiness.md'));
      assert.ok(validateTarget(root,host,built.version).some(error => error.includes('project-readiness.md')));
    }
  } finally { rmSync(parent, {recursive:true,force:true}); }
});

test('fixtures distinguish missing checks, documentation drift, real regressions and unavailable external proof', () => {
  for (const scenario of ['bare','ready','stale','regression','access']) {
    const item = prepareFixture(scenario);
    try {
      assert.deepEqual(inspectFixture(item.base).changed, []);
      assert.equal(existsSync(join(item.workspace,'check.mjs')), scenario !== 'bare');
      const probe = probeFixture(item.base);
      assert.equal(probe.passed, scenario !== 'regression');
      assert.equal(probe.workspaceUnchanged, true);
      const check = spawnSync(process.execPath, [join(item.workspace,'check.mjs')], {encoding:'utf8'});
      assert.equal(check.status === 0, !['bare','regression'].includes(scenario));
      const readme = readFileSync(join(item.workspace,'README.md'),'utf8');
      if (scenario === 'stale') assert.ok(readme.includes('node old-check.mjs'));
      if (scenario === 'access') assert.ok(readme.includes('No vendor endpoint, credential, or fixture service'));
    } finally { rmSync(item.base,{recursive:true,force:true}); }
  }
});

test('cleanup preserves actual final files and probe evidence and can repeat safely', () => {
  const item = prepareFixture('ready');
  try {
    writeFileSync(join(item.workspace,'README.md'),'updated route\n');
    probeFixture(item.base);
    assert.deepEqual(inspectFixture(item.base).changed, ['README.md']);
    const result = cleanupFixture(item.base);
    assert.equal(result.workspaceRemoved,true);
    assert.equal(JSON.parse(readFileSync(join(result.evidence,'final-files.json')))['README.md'], 'updated route\n');
    assert.ok(existsSync(join(result.evidence,'product-probe.json')));
    assert.equal(cleanupFixture(item.base).workspaceRemoved,true);
  } finally { rmSync(item.base,{recursive:true,force:true}); }
});

test('north-star fixtures isolate direction gaps from healthy product behavior and retain documentation edits', () => {
  for (const scenario of ['northstar-missing','northstar-vague','northstar-ready','northstar-conflict']) {
    const item = prepareFixture(scenario);
    try {
      assert.deepEqual(inspectFixture(item.base).changed, []);
      assert.equal(probeFixture(item.base).passed, true);
      assert.equal(existsSync(join(item.workspace,'PROJECT.md')), scenario !== 'northstar-missing');
      assert.equal(existsSync(join(item.workspace,'PROPOSAL.md')), scenario === 'northstar-conflict');
      const destination = scenario === 'northstar-missing' ? 'README.md' : 'PROJECT.md';
      const before = readFileSync(join(item.workspace,destination),'utf8');
      writeFileSync(join(item.workspace,destination),before+'\nAn explicitly accepted audience change.\n');
      const state = inspectFixture(item.base);
      assert.deepEqual(state.changed,[destination]);
      assert.equal(state.productPreserved,true);
      assert.equal(state.unrelatedPreserved,true);
      assert.equal(probeFixture(item.base).passed,true);
      const final = cleanupFixture(item.base);
      assert.equal(JSON.parse(readFileSync(join(final.evidence,'final-files.json')))[destination],before+'\nAn explicitly accepted audience change.\n');
    } finally { rmSync(item.base,{recursive:true,force:true}); }
  }
});

test('fixture cleanup rejects foreign or redirected resources and preserves broken-trial evidence', () => {
  const item = prepareFixture('ready');
  const other = mkdtempSync(join(tmpdir(),'workflow-foreign-'));
  try {
    assert.throws(()=>cleanupFixture(other), /unexpected fixture name/);
    writeFileSync(join(other,'keep.txt'),'keep');
    rmSync(item.workspace,{recursive:true});
    symlinkSync(other,item.workspace);
    assert.throws(()=>cleanupFixture(item.base), /workspace must not be a symlink/);
    assert.equal(readFileSync(join(other,'keep.txt'),'utf8'),'keep');
    rmSync(item.workspace);
    assert.equal(cleanupFixture(item.base).workspaceRemoved,true);
    assert.ok(existsSync(join(item.evidence,'baseline.json')));
  } finally { rmSync(item.base,{recursive:true,force:true}); rmSync(other,{recursive:true,force:true}); }
});

test('fixture CLI rejects invalid requests through physical and aliased paths, and imports have no CLI effects', () => {
  const parent = mkdtempSync(join(tmpdir(),'workflow-setup-cli-'));
  const script = join(defaultRoot,'.agents/skills/verify-project-setup/scripts/fixture.mjs');
  try {
    const alias = join(parent,'driver.mjs');
    symlinkSync(script,alias);
    for (const entry of [script,alias]) for (const args of [[],['unknown','x'],['prepare','unknown'],['prepare','ready','extra']]) {
      const result=spawnSync(process.execPath,[entry,...args],{cwd:parent,encoding:'utf8'});
      assert.equal(result.status,1,result.stderr);
      assert.match(result.stderr,/Use/);
      assert.equal(result.stdout,'');
    }
    const imported=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(pathToFileURL(script).href)})`],{cwd:parent,encoding:'utf8'});
    assert.equal(imported.status,0,imported.stderr);
    assert.equal(imported.stdout,'');
    const stdinImport=spawnSync(process.execPath,['--input-type=module','-'],{cwd:parent,encoding:'utf8',input:`await import(${JSON.stringify(pathToFileURL(script).href)})`});
    assert.equal(stdinImport.status,0,stdinImport.stderr);
    assert.equal(stdinImport.stdout,'');
  } finally { rmSync(parent,{recursive:true,force:true}); }
});

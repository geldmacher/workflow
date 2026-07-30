import { createHash } from "node:crypto";

export const TASK_RECIPES = Object.freeze({
  bugfix: Object.freeze({ version: "recipe-1", baseline_repetitions: 2, patched_repetitions: 2, writer_allowed: true, comparison: "same-surface" }),
  refactor: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 1, writer_allowed: true, comparison: "characterization-or-equivalence" }),
  performance: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 1, writer_allowed: true, comparison: "baseline-and-post-trace" }),
  feature: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 1, writer_allowed: true, comparison: "acceptance-and-regression" }),
  investigation: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 0, writer_allowed: false, comparison: "read-only-findings" }),
  "verify-existing": Object.freeze({ version: "recipe-1", baseline_repetitions: 2, patched_repetitions: 2, writer_allowed: false, comparison: "same-input-candidate-comparison" }),
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function strategyHash(strategy) {
  return createHash("sha256").update(JSON.stringify(stable(strategy))).digest("hex");
}

export function inferTaskClass(goal) {
  const source = String(goal ?? "").toLowerCase();
  if (/verify|validate|existing (?:fix|commit|change)|bestehenden? (?:fix|commit|änderung)/.test(source)) return "verify-existing";
  if (/performance|latency|throughput|profil|trace|slow|langsam/.test(source)) return "performance";
  if (/refactor|restructure|cleanup|vereinfach|umbau/.test(source)) return "refactor";
  if (/investigat|diagnos|analyse|explain|ursache finden/.test(source)) return "investigation";
  if (/bug|fix|defect|fehler|regression|crash/.test(source)) return "bugfix";
  return "feature";
}

export function createInitialStrategy(contract) {
  const seed = structuredClone(contract.strategy ?? {});
  const taskClass = TASK_RECIPES[seed.task_class] ? seed.task_class : inferTaskClass(contract.fields.goal);
  const value = {
    strategy_schema: 1,
    strategy_id: seed.strategy_id ?? `strategy-${contract.fields.id.slice(3)}`,
    revision: 0,
    parent_hash: null,
    root_projection_hash: contract.authoritative_projection_hash,
    task_class: taskClass,
    recipe_version: TASK_RECIPES[taskClass].version,
    primary_targets: seed.primary_targets ?? [...contract.allowedTargets],
    steps: seed.steps ?? contract.slices,
    checks: seed.checks ?? contract.checks,
    evidence_requirements: seed.evidence_requirements ?? (contract.fields.profile_max === "autonomous" ? "verified" : "provisional-allowed"),
    deviations: [],
    rationale: seed.rationale ?? "initial strategy derived from the approved intent root",
    created_by: seed.created_by ?? "planner",
  };
  return { ...value, strategy_hash: strategyHash(value) };
}

function inside(path, roots) {
  return roots.some((root) => root === "." || path === root || path.startsWith(`${root.replace(/\/$/, "")}/`));
}

export function reviseStrategy(current, patch, { reason, createdBy, authority }) {
  const nextTargets = patch.primary_targets ?? current.primary_targets;
  for (const target of nextTargets) if (!inside(target, authority.allowed_roots ?? [])) throw new Error(`strategy target escapes authority: ${target}`);
  if (patch.task_class && !TASK_RECIPES[patch.task_class]) throw new Error(`unknown task recipe: ${patch.task_class}`);
  const baseHash = current.strategy_hash ?? strategyHash(Object.fromEntries(Object.entries(current).filter(([key]) => key !== "strategy_hash")));
  const taskClass = patch.task_class ?? current.task_class;
  const next = {
    ...structuredClone(current),
    ...structuredClone(patch),
    revision: current.revision + 1,
    parent_hash: baseHash,
    task_class: taskClass,
    recipe_version: TASK_RECIPES[taskClass].version,
    rationale: reason,
    created_by: createdBy,
    deviations: [...(current.deviations ?? []), ...(patch.deviations ?? [])],
  };
  delete next.strategy_hash;
  return { ...next, strategy_hash: strategyHash(next) };
}

export function evidenceGrade(receipt) {
  if (receipt?.passed === true) return "verified";
  if (receipt?.passed === false) return "failed";
  if (receipt?.supported === true) return "supported";
  if (receipt?.unavailable === true) return "unavailable";
  return "partial";
}

export function aggregateEvidence(entries) {
  const grades = entries.map((entry) => entry.grade);
  if (grades.includes("failed")) return { grade: "failed", delivery: "blocked" };
  if (entries.length > 0 && grades.every((grade) => grade === "verified")) return { grade: "verified", delivery: "verified" };
  if (grades.includes("unavailable")) return { grade: "unavailable", delivery: "provisional" };
  if (grades.includes("partial")) return { grade: "partial", delivery: "provisional" };
  return { grade: "supported", delivery: "provisional" };
}

export function checkEvidence(check, receipt, baselineOrPatched = "patched") {
  return {
    check_id: check["Check ID"],
    feature_id: null,
    grade: evidenceGrade(receipt),
    surface: receipt?.surface ?? "repository",
    method: Array.isArray(receipt?.command) ? receipt.command.join(" ") : receipt?.method ?? check["Command or Inspection"] ?? "verification-profile",
    baseline_or_patched: baselineOrPatched,
    expected: check["Expected Result"] ?? "",
    observed: receipt?.passed === true ? "passed" : receipt?.passed === false ? (receipt.error ?? receipt.stderr ?? "failed") : receipt?.reason ?? "not fully observed",
    repetitions: receipt?.repetitions ?? (receipt?.passed === true || receipt?.passed === false ? 1 : 0),
    artifact_hashes: receipt?.artifact_hashes ?? [],
    limitations: receipt?.limitations ?? (receipt?.unavailable ? [receipt.reason ?? "verification unavailable"] : []),
  };
}

export function calibrateRecipeEvidence(taskClass, entries, stage, baselineEntries = []) {
  const recipe = TASK_RECIPES[taskClass];
  if (!recipe) throw new Error(`unknown task recipe: ${taskClass}`);
  const minimum = stage === "baseline" ? recipe.baseline_repetitions : recipe.patched_repetitions;
  const baselineByCheck = new Map(baselineEntries.map((entry) => [entry.check_id, entry]));
  return entries.map((entry) => {
    const limitations = [...(entry.limitations ?? [])];
    let grade = entry.grade;
    if (grade === "verified" && entry.repetitions < minimum) {
      grade = "partial";
      limitations.push(`${taskClass} recipe requires ${minimum} ${stage} repetitions`);
    }
    if (stage === "patched" && ["bugfix", "performance", "verify-existing"].includes(taskClass)) {
      const baseline = baselineByCheck.get(entry.check_id);
      if (baseline && baseline.surface !== entry.surface) {
        if (grade === "verified") grade = "partial";
        limitations.push(`${taskClass} recipe requires comparable baseline and patched surfaces`);
      }
    }
    if (grade === "verified" && taskClass === "refactor" && !/(?:characterization|snapshot|equivalence)/i.test(`${entry.method} ${entry.observed}`)) {
      grade = "partial";
      limitations.push("refactor recipe requires characterization, snapshot, or equivalence evidence");
    }
    if (grade === "verified" && taskClass === "performance" && !/(?:benchmark|trace|latency|throughput|metric)/i.test(`${entry.method} ${entry.expected} ${entry.observed}`)) {
      grade = "partial";
      limitations.push("performance recipe requires an explicit comparable metric or trace");
    }
    return { ...entry, grade, limitations: [...new Set(limitations)] };
  });
}

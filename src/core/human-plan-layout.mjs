const REQUIRED_HEADINGS = Object.freeze([
  "Quick decision",
  "Details",
  "Agent and machine contract (authoritative)",
]);

const H2 = /^##[ \t]+([^\r\n]+?)[ \t]*$/gm;
const H3 = /^###[ \t]+([^\r\n]+?)[ \t]*$/gm;
const ROOT_FENCE = /^```yaml artifact-envelope[ \t]*$/gm;
const NEXT_STEP = /^###[ \t]+Next step[ \t]*$/gm;
const DETAIL_SECTIONS = Object.freeze([
  ["Outcome and approach", ["Outcome", "Approach and rationale"]],
  ["Scope and boundaries", ["In scope", "Non-goals", "Constraints"]],
  ["Verification, risks, and recovery", ["Acceptance and verification", "Risks and trade-offs", "Unknowns and recovery"]],
]);

function matches(source, expression) {
  expression.lastIndex = 0;
  return [...source.matchAll(expression)];
}

export function inspectHumanFirstPlanLayout(source) {
  const text = String(source ?? "").replace(/\r\n/g, "\n");
  const failures = [];
  const fences = matches(text, ROOT_FENCE);
  if (fences.length !== 1) {
    failures.push(`native Plan requires exactly one yaml artifact-envelope in the final agent and machine layer; observed ${fences.length}`);
    return { ok: false, failures };
  }

  const prefix = text.slice(0, fences[0].index);
  const headings = matches(prefix, H2);
  const observed = headings.map((match) => match[1].trim());
  if (JSON.stringify(observed) !== JSON.stringify(REQUIRED_HEADINGS)) {
    failures.push(`native Plan requires exactly these ordered H2 layers before the Root: ${REQUIRED_HEADINGS.join(" -> ")}`);
    return { ok: false, failures };
  }
  if (prefix.slice(0, headings[0].index).trim()) {
    failures.push("native Plan must start with Quick decision before other presentation prose");
  }

  const sectionBody = (index, end) => prefix.slice(headings[index].index + headings[index][0].length, end).trim();
  const quickDecision = sectionBody(0, headings[1].index);
  const details = sectionBody(1, headings[2].index);
  const agentContractIntroduction = sectionBody(2, prefix.length);
  if (!quickDecision) failures.push("Quick decision must contain a human decision summary");
  if (!details) failures.push("Details must contain the human deep dive");
  if (!agentContractIntroduction) failures.push("Agent and machine contract must explain that the exact Root below is authoritative");
  if (agentContractIntroduction && !/(?:human layers|sections above)[\s\S]*(?:projections|oversight)[\s\S]*exact Root[\s\S]*(?:only|sole)[\s\S]*authorit/i.test(agentContractIntroduction)) {
    failures.push("Agent and machine contract must identify the human layers as oversight projections and the exact Root as the only implementation authority");
  }

  const detailH3 = matches(details, H3);
  const detailH3Names = detailH3.map((match) => match[1].trim());
  if (JSON.stringify(detailH3Names) !== JSON.stringify(DETAIL_SECTIONS.map(([name]) => name))) {
    failures.push(`Details requires exactly these ordered H3 sections: ${DETAIL_SECTIONS.map(([name]) => name).join(" -> ")}`);
  } else {
    DETAIL_SECTIONS.forEach(([, labels], index) => {
      const start = detailH3[index].index + detailH3[index][0].length;
      const end = detailH3[index + 1]?.index ?? details.length;
      const body = details.slice(start, end);
      for (const label of labels) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(`^-[ \\t]+${escaped}:[ \\t]+\\S.*$`, "m").test(body)) {
          failures.push(`Details coverage requires a non-empty - ${label}: value line`);
        }
      }
    });
  }

  const agentH3 = matches(agentContractIntroduction, H3);
  const agentH3Names = agentH3.map((match) => match[1].trim());
  if (JSON.stringify(agentH3Names) !== JSON.stringify(["Completion handoff"])) {
    failures.push("Agent and machine contract requires exactly one ### Completion handoff before the Root");
  } else {
    const handoff = agentContractIntroduction.slice(agentH3[0].index + agentH3[0][0].length).trim();
    const orderedTokens = ["`Quick decision`", "`Details`", "`Agent and machine contract`"];
    const positions = orderedTokens.map((token) => handoff.indexOf(token));
    const ordered = positions.every((position) => position >= 0)
      && positions.every((position, index) => index === 0 || position > positions[index - 1]);
    const complete = /\bImplement Plan\b/i.test(handoff)
      && ordered
      && /Human:[\s\S]*(?:\/review-work|\$review-work)/i.test(handoff)
      && /changed paths/i.test(handoff)
      && /Check commands\/directories\/observations/i.test(handoff)
      && /failures\/uncertainty/i.test(handoff)
      && /(?:do not|never) claim[\s\S]*Evidence[\s\S]*Review[\s\S]*Learning/i.test(handoff);
    if (!complete) failures.push("Completion handoff must carry the three-layer implementation reply, exact implementation observations, fresh human Review action, and no Evidence/Review/Learning claim");
  }
  const allNextSteps = matches(prefix, NEXT_STEP);
  const quickNextSteps = matches(quickDecision, NEXT_STEP);
  if (allNextSteps.length !== 1) {
    failures.push(`Quick decision requires exactly one ### Next step section across all human layers; observed ${allNextSteps.length}`);
  } else if (quickNextSteps.length !== 1) {
    failures.push("the only ### Next step section must be inside Quick decision");
  }

  return { ok: failures.length === 0, failures };
}

export { REQUIRED_HEADINGS as HUMAN_FIRST_PLAN_HEADINGS };
export { DETAIL_SECTIONS as HUMAN_FIRST_DETAIL_SECTIONS };

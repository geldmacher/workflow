# skill-authoring

Use to create or revise one agent skill. Repository changes require the approved scope and implementation or correction instruction. Use applicable authoring guidance available in the host; this method does not depend on a particular vendor's built-in skill.

## Write instructions that change useful decisions

1. Define the task the skill serves, its intended audience, and its boundaries. Make discovery precise: the name and description should identify when the skill helps and avoid triggering on unrelated requests.
2. Inspect existing instructions and structural sources before adding guidance. Point to relevant types, configuration, or maintained documentation where they already express the rule. Resolve contradictory instructions rather than copying them into another place.
3. Keep the entrypoint concise. Put conditional detail in skill-owned references and state when to load each one. Use actual relative links and avoid restating another skill's full instructions.
4. Write concrete actions, decision criteria, and relevant failure cases. Retain rationale when a rule is confusing without it. Remove prose that adds no useful decision, while preserving authority limits, evidence requirements, and necessary uncertainty.
5. Validate discovery metadata, referenced files, cross-skill links, and packaged availability on supported hosts. Check that the instructions do not assume an unavailable tool, model, or external plugin.
6. Test meaningful structural behavior and inspect realistic task decisions when that is part of the assignment. Include likely misroutes and missing prerequisites. Subjective wording does not need exact-text assertions; valid frontmatter does not prove good agent behavior.
7. Check the final scope. A repeated workflow may justify proposing another skill, but it does not authorize creating unrelated capabilities, changing global settings, or installing and publishing the result.

## Result

Describe the capability, key instruction choices, relevant validation, and remaining behavioral uncertainty. Distinguish static checks, content walkthroughs, actual agent runs, and installed-host evidence. Keep the user's language and suitable presentation; this playbook prescribes useful content rather than fixed output headings.

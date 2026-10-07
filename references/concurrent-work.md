# Concurrent work

Read this when planning finds another active workstream on this repository, when a dirty checkout should stay untouched, or when a plan already records continue, wait, or isolate. A clean checkout with no other active plan or implementation stays where it is: no worktree, and no extra question.

Continuing in the current checkout remains a valid choice. This check warns and offers options. It does not lock the repository or require a worktree for every plan.

The plan in the native task is the cold-start record. Implementation, review, correction, learning, and verification follow that record. There is no side registry.

## Detect overlap

1. Identify the repository by its git common directory (`git rev-parse --git-common-dir`) and list checkouts with `git worktree list --porcelain`. Linked worktrees of that common directory are the same repository.
2. Stay read-only while detecting. Use status and listing only.
3. Inspect other worktrees and the branches they have checked out, this checkout's branch and uncommitted changes, unfinished plans or implementation reports already in this task or supplied with it that name this repository, and host-visible sessions for this repository when the host already exposes them. Do not search unrelated private conversations.
4. Overlap is uncommitted changes this assignment did not make when the next edit would land in that checkout, a documented unfinished plan or implementation that names this repository, or this branch checked out in another worktree that has those changes or that unfinished task. Another worktree counts only when that checkout has uncommitted changes, or commits the branch this task would use does not contain and a handoff, a host-visible task, or that checkout's current work identifies.
5. A clean idle worktree is not overlap. A local branch with no worktree, no unfinished handoff, and no host-visible task is not overlap. This assignment's own recorded worktree is not a new overlap.

## Choose

When overlap exists, warn and offer three options. Mark one as the recommendation the human can accept or steer. This is one checkout choice, separate from a vague-scope product round. Ask it only when detection finds overlap.

- **Continue carefully.** Edit this checkout. Preserve unrelated changes. A later merge may be messier, and that is acceptable when the human wants one checkout.
- **Wait.** The plan can still be finished. Hold edits until the other workstream releases the checkout or the overlapping files. Name who is in the way and what to recheck. Do not poll without a new request.
- **Isolate.** Use a dedicated branch and a git worktree so this workstream does not edit the other checkout.

Use the first matching rule. One recommendation.

1. The other workstream is mid-edit on files this task must change, and a branch from that state would drop their unfinished work. Recommend **wait**.
2. Another workstream is active, or implementation would change a dirty checkout this task must leave untouched, and a fresh reviewer can use the intended worktree as its workspace. Recommend **isolate**.
3. That same overlap exists, and a fresh reviewer cannot use the intended worktree as its workspace. Recommend **continue carefully**, and say that independent review would be unable to read the isolated checkout. Still offer wait.
4. The human wants one checkout, or a worktree cannot be created. Recommend **continue carefully**.

Standalone and Light planning record the recommendation and do not create the worktree. Light approval of the plan accepts the recorded choice. `git worktree add` runs only as the first implementation step, and only for the branch and path named in the plan. That step still does not authorize commit, push, merge, or deletion. Dark may take it when the commissioned sequence's plan recommends isolate and both the other owner and the overlapping files are clear. When either is unclear, pause and do not create the worktree. An explicit continue, wait, or isolate from the human overrides the recommendation.

Silence while planning is still read-only is not approval to create a worktree. Record the decision in the plan:

- repository common directory
- choice: continue, wait, or isolate
- for continue: which unrelated changes must be preserved
- for wait: what blocks edits
- for isolate: base revision, branch, worktree path, and whether the worktree has been created
- that review, correction, learning, verification, and reconcile follow this reference

A later executor that has only the plan uses these fields and does not repeat the choice.

## Isolate

Create the branch and worktree as the first implementation step, after the plan records isolate and the other owner and overlapping files are clear. Light approval or that clear Dark continuation authorizes this bounded git setup only. It does not authorize commit, push, merge, or deletion. When the owner or the files are unclear, pause and leave the worktree uncreated.

1. Choose a base that excludes unrelated dirty work. A clean HEAD can be the base. When the checkout is dirty, use the committed HEAD or the branch the plan names, and leave that dirty checkout untouched.
2. Create a branch named for this assignment. Leave a branch that is checked out elsewhere, or that holds commits the plan did not accept, as it is.
3. Add the worktree outside the current working tree: `git worktree add -b <branch> <path> <base>`. Keep the path on the same machine, outside the source tree, and off a symlink that leaves the intended parent. A sibling directory or the host's existing worktree directory both fit.
4. Record the path, branch, and base in the plan. Leave the original checkout on its current branch.
5. When `git worktree add` fails, report the command and the error. Ask the human whether to continue carefully or wait. Do not treat a failed add as an existing worktree.
6. When the host cannot place a worktree outside the checkout, say so and use continue carefully or wait.

Isolation keeps the other checkout intact. Later merge conflicts remain possible and are handled at reconcile.

## Implement

Edit only the checkout the plan names. When the choice is isolate and the worktree is missing, create it before the first product edit. When the shell is in a different checkout, move to the recorded path before editing. When the choice is continue, preserve the unrelated changes named in the plan. When the choice is wait, do not edit until the recorded blocker has cleared, then re-read the checkout and continue in the recorded place.

A cold start follows the plan's fields. It does not open a new choice unless those fields are missing and this checkout now has other in-flight work.

## Review

Review the branch and worktree the plan records. A primary checkout that does not contain the change is the wrong tree. Stay read-only: leave merge, commit, worktree removal, and copying files back for an explicitly requested reconcile. Start a delegated reviewer with that worktree as its workspace. When the recorded path cannot be read, report that missing checkout as missing proof.

Auto-Work gives the reviewer the path, branch, and this reference, and starts it in that workspace when the host can. The executor still makes no concurrent writes to that worktree while review runs.

## Correct

Apply findings in the same worktree and branch. Leave every other checkout untouched. Unrelated edits in the chosen checkout stay in place. Copying the result onto the original branch is reconcile, which needs its own explicit git request.

## Reconcile or abandon

Merge, rebase, worktree removal, and branch deletion need an explicit request. Commissioned delivery covers only the destinations it names.

**Reconcile** when the human asks to fold the isolated work back, or delivery includes that merge:

1. Name the destination branch and checkout. Update it from elsewhere only when that fetch or pull is authorized.
2. When the destination checkout is dirty, stop and show that dirt. Continue only in a checkout that can take the merge, or under a new explicit instruction. Do not stash or commit that dirt as part of reconcile.
3. Merge or rebase the assignment branch into the named destination. Keep changes that are not part of this assignment. Resolve conflicts inside this assignment's edits. Stop for a human decision when a conflict changes the goal, acceptance, or someone else's unfinished work.
4. Recheck the affected behavior on the merged result. A passing result in the worktree is not yet proof of the merged tree.
5. After the requested merge succeeds, remove only the worktree this assignment added (`git worktree remove <path>`). Delete the branch only when the human asks and the branch is merged. Leave every other worktree in place.

**Abandon** when the human discards the isolated attempt:

1. Do not merge.
2. Show uncommitted and unpushed work in that worktree. Remove it only after the human confirms the discard. Use `git worktree remove --force` only with that confirmation, and only when a normal remove refuses dirty or untracked files.
3. Delete the branch only when the human confirms and the branch exists for this abandoned attempt. Leave branches and worktrees this assignment did not create.

## Learning and verification

Save project guidance on the checkout that holds the accepted work. While that result exists only in the worktree, edit there. After reconcile, edit the destination that received the merge. Leave the other checkout unchanged.

Drive verifiers and product checks against the checkout that contains the implementation. A git worktree does not replace test-data, port, or process isolation. When safe isolation for a shared running instance is unavailable, report that constraint.

A repeated collision between workstreams is an environment lesson. Follow the learning guidance: prefer a check that can see the collision, or this shared procedure, over a new project rule that copies these steps.

## Resume

A pause record includes the choice, path, branch, base, and whether the worktree exists. On pickup, confirm the path still exists and matches the branch before editing, reviewing, or reconciling. A missing worktree is a gap. Recreate it only when the plan still says isolate and implementation is authorized, using the recorded base. Do not invent a new base that drops uncommitted work you can no longer see.

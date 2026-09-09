# pause-safely

Use when the human asks to pause or requests a handoff for a restart or interruption. Preserve a resumable boundary and incomplete work. An instruction to keep working is not a pause request; context compaction alone does not cancel an active assignment.

## Leave a concrete resume point

1. Start no new work. Bring the current bounded step to a safe stopping point only within the existing authority, or leave its incomplete state explicit. Do not hide a broken check or undo unrelated edits to create a clean-looking tree.
2. Identify any running operations owned by this task. Use available controls to stop or settle them safely where authorized, preserving results already produced. Do not cancel unrelated tasks or imply background work stopped without observing it.
3. Inspect what is actually saved and what remains only an intention. Preserve modified files, untracked artifacts, and pre-existing changes. A dirty working tree is a valid pause state; committing, resetting, cleaning, or pushing is not required to make it durable.
4. Provide the resume information in the native task: applicable plan and assignment, completed work, actual repository state, checks and limitations, useful artifact locations, unresolved decisions, and the next action. Link existing reports instead of duplicating them where the receiver can access them.
5. If moving to another executor, use the host's available task references or complete supplied text. If a necessary artifact cannot be accessed there, name that gap. Do not invent an external note path or automatically persist learning to compensate.

## Result

State where work stopped, what is saved, what is incomplete or currently failing, any operation still active, and the first action on resume. Report commits only if separately authorized and actually made. [session-pickup](./session-pickup.md) explains how to reconcile this handoff with the repository when work resumes. A pause report does not claim the original task is complete.

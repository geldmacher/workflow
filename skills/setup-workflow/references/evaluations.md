# Evaluations

Use for variable or judgment-based quality, such as grounded answers, extraction quality or agent task completion. Deterministic contracts often need ordinary tests instead. Inspect the actual task distribution, known failures, existing datasets, rubrics, evaluator agreement, runtime access and cost constraints.

## Establish a trustworthy comparison

Define the quality objective and an observable rubric before comparing candidates. Select representative normal, difficult and failure cases from approved project material; retain provenance and avoid sensitive live data when fixtures suffice. Keep development examples separate from held-out assessment cases. Never expose expected answers, observer recipes or hidden judging criteria to the subject being evaluated.

Keep candidate inputs and conditions comparable and record relevant versions/settings. Use deterministic scoring for exact properties and calibrated human or model judgment for qualitative criteria. Check automated judgments against human-reviewed examples, including known bad outputs. Report disagreement and failure categories, not only an aggregate score. For nondeterministic outcomes use proportionate repeated trials and state sample size and uncertainty; one successful run establishes no general success rate.

Choose a baseline and acceptance criteria grounded in the task; do not invent a percentage target. Set the run scope and cost before paid or lengthy evaluation. Capture inputs, outputs and judgments at a justified level with secrets excluded. There is no required vendor platform or model.

Possible artifacts are a small dataset, rubric, scoring script and reproducible run instructions. For a support-answer feature, include answerable questions and questions whose evidence is missing; grade unsupported claims and appropriate abstention separately from fluent wording.

## Prove and maintain

Trial the evaluator on human-reviewed good and bad examples and explain its agreement and limits. If the model/provider is unavailable, distinguish local evaluator checks from missing live quality proof. Maintenance adds newly demonstrated failures, rechecks representativeness and evaluator calibration, and preserves comparability when datasets or criteria change. Never tune the held-out oracle solely to improve a candidate's score.

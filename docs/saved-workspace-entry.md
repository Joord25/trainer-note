# Saved workspace entry

Entering a member resolves `workflowContext` before choosing the initial work pane. The old browser-only `trainer-reviewed-*` session marker is no longer consulted. Ready analysis opens member changes and all workflow tabs; a saved cycle or ready proposal without current analysis opens the plan; otherwise record review opens.

The entry response seeds CoachingJourney once, scoped to the same member and record revision, avoiding an immediate duplicate context read. Requests are cancelled logically on dependency changes/unmount. An interaction during lookup prevents late automatic navigation. Lookup errors offer a retry and keep record review accessible.

Reopening does not authorize `analyzeChanges`. Automatic generation requires the explicit record-review Analyze action; changes to the source revision clear that authorization. Explicit AI reanalysis remains available. New uploads return to record review. Current analyses are matched to the server input key; changed records/goals are not silently presented as already analyzed.

Opening the plan tab initially shows an existing saved plan. Clicking that tab again opens settings, and the existing settings controls remain available.

Validation: production Next build, three entry-selection unit tests, and 17 Firestore workflow service tests (including repeated read-only restoration, saved plan restoration, and cross-member isolation). No model call is made in the read-only restoration test.

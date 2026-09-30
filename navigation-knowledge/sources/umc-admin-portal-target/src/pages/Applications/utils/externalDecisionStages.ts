interface ExternalDecisionStagesOptions {
  workflowCompleted: boolean;
  submitExternalDecision: () => Promise<void>;
  onWorkflowCompleted: () => void;
  submitWorkflow: () => Promise<void>;
}

interface SubmissionLock {
  current: boolean;
}

export async function runWithSubmissionLock(
  lock: SubmissionLock,
  submit: () => Promise<void>,
): Promise<void> {
  if (lock.current) return;

  // The synchronous flag closes the double-click window before React updates loading state.
  lock.current = true;
  try {
    await submit();
  } finally {
    lock.current = false;
  }
}

export async function submitExternalDecisionStages({
  workflowCompleted,
  submitExternalDecision,
  onWorkflowCompleted,
  submitWorkflow,
}: ExternalDecisionStagesOptions): Promise<void> {
  // Complete the historical workflow action before recording the FAHR
  // external review decision. If the second stage fails, retry it only.
  if (!workflowCompleted) {
    await submitWorkflow();
    onWorkflowCompleted();
  }
  await submitExternalDecision();
}

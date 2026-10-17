export type Stage = "pending" | "parsed" | "embedding" | "evaluating" | "ready" | "failed";
export interface PaperCheckpoint { paperNumber: number; stage: Stage; retryCount: number; sourceHash: string; safeErrorCode?: string }

export function advanceCheckpoint(current: PaperCheckpoint, next: Stage, sourceHash: string): PaperCheckpoint {
  if (current.sourceHash === sourceHash && current.stage === next) return current;
  if (current.sourceHash !== sourceHash) return { paperNumber: current.paperNumber, stage: "pending", retryCount: 0, sourceHash };
  return { ...current, stage: next, safeErrorCode: undefined };
}

export function retryCheckpoint(current: PaperCheckpoint, limit = 3): PaperCheckpoint {
  if (current.retryCount >= limit) return current;
  return { ...current, stage: "pending", retryCount: current.retryCount + 1, safeErrorCode: undefined };
}

export function canActivateCorpus(input: { validPapers: number; missing: number; duplicates: number; evaluationPass: boolean }): boolean {
  return input.validPapers === 197 && input.missing === 0 && input.duplicates === 0 && input.evaluationPass;
}

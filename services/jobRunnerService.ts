
import { JobProgress } from "../types";

export interface JobCallbacks<T, I> {
  onProgress: (progress: JobProgress) => void;
  onItemUpdate?: (items: I[]) => void;
  onLog?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export class JobRunner {
  private abortController: AbortController | null = null;
  private progress: JobProgress;

  constructor(private name: string) {
    this.progress = this.initProgress();
  }

  private initProgress(): JobProgress {
    return {
      runId: `run-${Math.random().toString(36).substr(2, 9)}`,
      status: 'idle',
      currentStepName: 'Aguardando...',
      completedSteps: 0,
      totalSteps: 0,
      currentItemIndex: 0,
      totalItems: 0,
      durationMs: 0
    };
  }

  async run<T, I>(
    steps: number,
    workFn: (runner: JobRunner, controller: AbortController) => Promise<T>,
    callbacks: JobCallbacks<T, I>
  ): Promise<{ data: T; runId: string }> {
    this.abortController = new AbortController();
    const start = Date.now();
    
    this.progress = {
      ...this.initProgress(),
      status: 'running',
      totalSteps: steps,
      startedAt: new Date().toISOString()
    };
    
    callbacks.onProgress(this.progress);

    try {
      const data = await workFn(this, this.abortController);
      
      this.progress = {
        ...this.progress,
        status: 'completed',
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        currentStepName: 'Concluído'
      };
      
      callbacks.onProgress(this.progress);
      return { data, runId: this.progress.runId };

    } catch (err: any) {
      this.progress = {
        ...this.progress,
        status: err.name === 'AbortError' ? 'cancelled' : 'failed',
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - start
      };
      callbacks.onProgress(this.progress);
      throw err;
    }
  }

  updateStep(name: string, index?: number, total?: number) {
    this.progress.currentStepName = name;
    if (index !== undefined) this.progress.currentItemIndex = index;
    if (total !== undefined) this.progress.totalItems = total;
    if (index !== undefined && index === total) this.progress.completedSteps++;
  }

  getProgress() { return this.progress; }
  
  cancel() {
    if (this.abortController) this.abortController.abort();
  }
}

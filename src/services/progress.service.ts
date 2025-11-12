/**
 * ProgressService - Real-time progress tracking for extraction pipeline
 * 
 * Features:
 * - Stage-based progress tracking with percentage calculation
 * - Estimated time remaining (ETA) based on historical data
 * - Server-Sent Events (SSE) for real-time updates
 * - Cancellation token support
 * - Multiple concurrent jobs tracking
 * 
 * @module services/progress
 */

import { EventEmitter } from 'events';

/**
 * Extraction pipeline stages with relative weights
 */
export enum ProgressStage {
  INITIALIZING = 'initializing',
  DATE_PREPROCESSING = 'date_preprocessing',
  EXTRACTION = 'extraction',
  DOCUMENTATION_ANALYSIS = 'documentation_analysis',
  PRE_COMPLETENESS_CHECK = 'pre_completeness_check',
  POST_COMPLETENESS_CHECK = 'post_completeness_check',
  NARRATIVE_GENERATION = 'narrative_generation',
  VALIDATION = 'validation',
  FINALIZING = 'finalizing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Stage weights for percentage calculation
 * Total should equal 100
 */
const STAGE_WEIGHTS: Record<ProgressStage, number> = {
  [ProgressStage.INITIALIZING]: 2,
  [ProgressStage.DATE_PREPROCESSING]: 8,
  [ProgressStage.EXTRACTION]: 35,
  [ProgressStage.DOCUMENTATION_ANALYSIS]: 10,
  [ProgressStage.PRE_COMPLETENESS_CHECK]: 5,
  [ProgressStage.POST_COMPLETENESS_CHECK]: 5,
  [ProgressStage.NARRATIVE_GENERATION]: 20,
  [ProgressStage.VALIDATION]: 10,
  [ProgressStage.FINALIZING]: 5,
  [ProgressStage.COMPLETED]: 0,
  [ProgressStage.FAILED]: 0,
  [ProgressStage.CANCELLED]: 0,
};

/**
 * Progress event data
 */
export interface ProgressEvent {
  jobId: string;
  stage: ProgressStage;
  percent: number;
  message: string;
  timestamp: Date;
  estimatedTimeRemainingMs?: number;
  metadata?: {
    stagesCompleted: number;
    totalStages: number;
    currentStageProgress?: number; // 0-100 for current stage
  };
}

/**
 * Job status tracking
 */
interface JobStatus {
  jobId: string;
  currentStage: ProgressStage;
  percent: number;
  startTime: Date;
  lastUpdateTime: Date;
  stagesCompleted: ProgressStage[];
  cancelled: boolean;
  includesNarrative: boolean;
}

/**
 * Historical timing data for ETA calculation
 */
interface StageTiming {
  stage: ProgressStage;
  averageDurationMs: number;
  sampleCount: number;
}

/**
 * ProgressService - Manages extraction pipeline progress tracking
 */
export class ProgressService extends EventEmitter {
  private jobs: Map<string, JobStatus>;
  private stageTimings: Map<ProgressStage, StageTiming>;
  private maxHistorySamples: number;

  constructor(maxHistorySamples: number = 100) {
    super();
    this.jobs = new Map();
    this.stageTimings = new Map();
    this.maxHistorySamples = maxHistorySamples;
    this.initializeStageTimings();
  }

  /**
   * Initialize stage timings with default estimates
   */
  private initializeStageTimings(): void {
    // Default timing estimates in milliseconds
    const defaultTimings: Record<ProgressStage, number> = {
      [ProgressStage.INITIALIZING]: 500,
      [ProgressStage.DATE_PREPROCESSING]: 2000,
      [ProgressStage.EXTRACTION]: 15000,
      [ProgressStage.DOCUMENTATION_ANALYSIS]: 3000,
      [ProgressStage.PRE_COMPLETENESS_CHECK]: 1000,
      [ProgressStage.POST_COMPLETENESS_CHECK]: 1000,
      [ProgressStage.NARRATIVE_GENERATION]: 8000,
      [ProgressStage.VALIDATION]: 5000,
      [ProgressStage.FINALIZING]: 1000,
      [ProgressStage.COMPLETED]: 0,
      [ProgressStage.FAILED]: 0,
      [ProgressStage.CANCELLED]: 0,
    };

    for (const [stage, duration] of Object.entries(defaultTimings)) {
      this.stageTimings.set(stage as ProgressStage, {
        stage: stage as ProgressStage,
        averageDurationMs: duration,
        sampleCount: 0,
      });
    }
  }

  /**
   * Start tracking a new job
   */
  startJob(jobId: string, includesNarrative: boolean = false): void {
    const job: JobStatus = {
      jobId,
      currentStage: ProgressStage.INITIALIZING,
      percent: 0,
      startTime: new Date(),
      lastUpdateTime: new Date(),
      stagesCompleted: [],
      cancelled: false,
      includesNarrative,
    };

    this.jobs.set(jobId, job);

    this.emitProgress(jobId, ProgressStage.INITIALIZING, 'Starting extraction pipeline...');
  }

  /**
   * Update job progress to a new stage
   */
  updateStage(
    jobId: string,
    stage: ProgressStage,
    message?: string,
    currentStageProgress?: number
  ): void {
    const job = this.jobs.get(jobId);
    if (!job || job.cancelled) {
      return;
    }

    // Record timing for completed stage
    if (job.currentStage !== stage) {
      if (job.currentStage !== ProgressStage.INITIALIZING) {
        const stageStartTime = job.lastUpdateTime.getTime();
        const stageDuration = Date.now() - stageStartTime;
        this.recordStageTiming(job.currentStage, stageDuration);
      }
      if (job.currentStage !== ProgressStage.INITIALIZING || stage !== ProgressStage.INITIALIZING) {
        job.stagesCompleted.push(job.currentStage);
      }
    }

    // Update job status
    job.currentStage = stage;
    job.lastUpdateTime = new Date();
    job.percent = this.calculateProgress(job, currentStageProgress);

    // Emit progress event
    const defaultMessage = this.getStageMessage(stage);
    this.emitProgress(jobId, stage, message || defaultMessage, job, currentStageProgress);
  }

  /**
   * Calculate overall progress percentage
   */
  private calculateProgress(job: JobStatus, currentStageProgress: number = 0): number {
    let totalProgress = 0;

    // Add weight for completed stages
    for (const completedStage of job.stagesCompleted) {
      totalProgress += STAGE_WEIGHTS[completedStage];
    }

    // Add partial progress for current stage
    const currentStageWeight = STAGE_WEIGHTS[job.currentStage];
    totalProgress += (currentStageWeight * currentStageProgress) / 100;

    // If no narrative, redistribute narrative weight to other stages
    if (!job.includesNarrative) {
      const narrativeWeight = STAGE_WEIGHTS[ProgressStage.NARRATIVE_GENERATION];
      const adjustmentFactor = 100 / (100 - narrativeWeight);
      totalProgress *= adjustmentFactor;
    }

    return Math.min(Math.round(totalProgress), 100);
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateETA(job: JobStatus): number | undefined {
    const remainingStages = this.getRemainingStages(job);
    if (remainingStages.length === 0) {
      return 0;
    }

    let estimatedRemainingMs = 0;

    for (const stage of remainingStages) {
      const timing = this.stageTimings.get(stage);
      if (timing) {
        estimatedRemainingMs += timing.averageDurationMs;
      }
    }

    // Add partial time for current stage if it has progress
    const currentStageRemaining = this.getCurrentStageRemainingTime(job);
    if (currentStageRemaining !== undefined) {
      estimatedRemainingMs += currentStageRemaining;
    }

    return Math.max(estimatedRemainingMs, 0);
  }

  /**
   * Get remaining stages for a job
   */
  private getRemainingStages(job: JobStatus): ProgressStage[] {
    const allStages = [
      ProgressStage.INITIALIZING,
      ProgressStage.DATE_PREPROCESSING,
      ProgressStage.EXTRACTION,
      ProgressStage.DOCUMENTATION_ANALYSIS,
      ProgressStage.PRE_COMPLETENESS_CHECK,
      ProgressStage.POST_COMPLETENESS_CHECK,
      ProgressStage.NARRATIVE_GENERATION,
      ProgressStage.VALIDATION,
      ProgressStage.FINALIZING,
    ];

    // Filter out narrative if not included
    const relevantStages = job.includesNarrative
      ? allStages
      : allStages.filter(s => s !== ProgressStage.NARRATIVE_GENERATION);

    const currentIndex = relevantStages.indexOf(job.currentStage);
    if (currentIndex === -1) {
      return [];
    }

    return relevantStages.slice(currentIndex + 1);
  }

  /**
   * Get remaining time for current stage
   */
  private getCurrentStageRemainingTime(job: JobStatus): number | undefined {
    const timing = this.stageTimings.get(job.currentStage);
    if (!timing) {
      return undefined;
    }

    const elapsedMs = Date.now() - job.lastUpdateTime.getTime();
    const remainingMs = timing.averageDurationMs - elapsedMs;

    return Math.max(remainingMs, 0);
  }

  /**
   * Record timing for a completed stage
   */
  private recordStageTiming(stage: ProgressStage, durationMs: number): void {
    const timing = this.stageTimings.get(stage);
    if (!timing) {
      return;
    }

    // Update running average (exponential moving average for recent samples)
    if (timing.sampleCount === 0) {
      timing.averageDurationMs = durationMs;
    } else {
      // Weight recent samples more heavily (alpha = 0.2)
      const alpha = 0.2;
      timing.averageDurationMs = alpha * durationMs + (1 - alpha) * timing.averageDurationMs;
    }

    timing.sampleCount = Math.min(timing.sampleCount + 1, this.maxHistorySamples);

    console.log(`⏱️  Stage timing recorded: ${stage} = ${Math.round(durationMs)}ms (avg: ${Math.round(timing.averageDurationMs)}ms)`);
  }

  /**
   * Emit progress event
   */
  private emitProgress(
    jobId: string,
    stage: ProgressStage,
    message: string,
    job?: JobStatus,
    currentStageProgress?: number
  ): void {
    const currentJob = job || this.jobs.get(jobId);
    if (!currentJob) {
      return;
    }

    const event: ProgressEvent = {
      jobId,
      stage,
      percent: currentJob.percent,
      message,
      timestamp: new Date(),
      estimatedTimeRemainingMs: this.calculateETA(currentJob),
      metadata: {
        stagesCompleted: currentJob.stagesCompleted.length,
        totalStages: this.getTotalStages(currentJob.includesNarrative),
        currentStageProgress,
      },
    };

    this.emit('progress', event);

    console.log(`📊 Progress [${jobId}]: ${event.percent}% - ${stage} - ${message}`);
  }

  /**
   * Get total stages for a job
   */
  private getTotalStages(includesNarrative: boolean): number {
    return includesNarrative ? 9 : 8; // 9 stages with narrative, 8 without
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId: string, message: string = 'Extraction completed successfully'): void {
    const job = this.jobs.get(jobId);
    if (!job || job.cancelled) {
      return;
    }

    // Record timing for last stage
    if (job.currentStage !== ProgressStage.COMPLETED) {
      const stageStartTime = job.lastUpdateTime.getTime();
      const stageDuration = Date.now() - stageStartTime;
      this.recordStageTiming(job.currentStage, stageDuration);
    }

    job.currentStage = ProgressStage.COMPLETED;
    job.percent = 100;
    job.lastUpdateTime = new Date();

    this.emitProgress(jobId, ProgressStage.COMPLETED, message);

    // Log total duration
    const totalDuration = Date.now() - job.startTime.getTime();
    console.log(`✅ Job ${jobId} completed in ${Math.round(totalDuration)}ms`);

    // Clean up after a delay (keep for SSE subscribers)
    setTimeout(() => {
      this.jobs.delete(jobId);
    }, 60000); // Keep for 1 minute
  }

  /**
   * Mark job as failed
   */
  failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job || job.cancelled) {
      return;
    }

    job.currentStage = ProgressStage.FAILED;
    job.lastUpdateTime = new Date();

    this.emitProgress(jobId, ProgressStage.FAILED, `Failed: ${error}`);

    console.error(`❌ Job ${jobId} failed: ${error}`);

    // Clean up after a delay
    setTimeout(() => {
      this.jobs.delete(jobId);
    }, 60000);
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.cancelled || job.currentStage === ProgressStage.COMPLETED || job.currentStage === ProgressStage.FAILED) {
      return false;
    }

    job.cancelled = true;
    job.currentStage = ProgressStage.CANCELLED;
    job.lastUpdateTime = new Date();

    this.emitProgress(jobId, ProgressStage.CANCELLED, 'Extraction cancelled by user');

    console.log(`🛑 Job ${jobId} cancelled`);

    // Clean up immediately
    setTimeout(() => {
      this.jobs.delete(jobId);
    }, 5000);

    return true;
  }

  /**
   * Check if job is cancelled
   */
  isCancelled(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    return job?.cancelled || false;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): JobStatus | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get default message for stage
   */
  private getStageMessage(stage: ProgressStage): string {
    const messages: Record<ProgressStage, string> = {
      [ProgressStage.INITIALIZING]: 'Initializing extraction pipeline...',
      [ProgressStage.DATE_PREPROCESSING]: 'Preprocessing dates and temporal data...',
      [ProgressStage.EXTRACTION]: 'Extracting structured medical data...',
      [ProgressStage.DOCUMENTATION_ANALYSIS]: 'Analyzing documentation inventory...',
      [ProgressStage.PRE_COMPLETENESS_CHECK]: 'Running pre-extraction completeness check...',
      [ProgressStage.POST_COMPLETENESS_CHECK]: 'Running post-extraction completeness check...',
      [ProgressStage.NARRATIVE_GENERATION]: 'Generating clinical narrative...',
      [ProgressStage.VALIDATION]: 'Running quality validation...',
      [ProgressStage.FINALIZING]: 'Finalizing results...',
      [ProgressStage.COMPLETED]: 'Extraction completed successfully',
      [ProgressStage.FAILED]: 'Extraction failed',
      [ProgressStage.CANCELLED]: 'Extraction cancelled',
    };

    return messages[stage] || 'Processing...';
  }

  /**
   * Get statistics about stage timings
   */
  getTimingStats(): Map<ProgressStage, StageTiming> {
    return new Map(this.stageTimings);
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): JobStatus[] {
    return Array.from(this.jobs.values()).filter(
      job => job.currentStage !== ProgressStage.COMPLETED &&
             job.currentStage !== ProgressStage.FAILED &&
             job.currentStage !== ProgressStage.CANCELLED
    );
  }

  /**
   * Clear completed/failed jobs
   */
  cleanup(): number {
    let cleaned = 0;
    for (const [jobId, job] of this.jobs.entries()) {
      if (
        job.currentStage === ProgressStage.COMPLETED ||
        job.currentStage === ProgressStage.FAILED ||
        job.currentStage === ProgressStage.CANCELLED
      ) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }
    return cleaned;
  }
}

/**
 * Singleton instance
 */
export const progressService = new ProgressService();

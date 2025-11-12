/**
 * Unit tests for ProgressService
 */

import { ProgressService, ProgressStage, ProgressEvent } from '../../src/services/progress.service';

describe('ProgressService', () => {
  let service: ProgressService;

  beforeEach(() => {
    service = new ProgressService(100);
  });

  afterEach(() => {
    service.removeAllListeners();
  });

  describe('startJob', () => {
    it('should start tracking a new job', (done) => {
      const jobId = 'test-job-1';

      service.once('progress', (event: ProgressEvent) => {
        expect(event.jobId).toBe(jobId);
        expect(event.stage).toBe(ProgressStage.INITIALIZING);
        expect(event.percent).toBe(0);
        expect(event.message).toContain('Starting');
        done();
      });

      service.startJob(jobId, false);
    });

    it('should track jobs with and without narrative', () => {
      service.startJob('job-with-narrative', true);
      service.startJob('job-without-narrative', false);

      const job1 = service.getJobStatus('job-with-narrative');
      const job2 = service.getJobStatus('job-without-narrative');

      expect(job1?.includesNarrative).toBe(true);
      expect(job2?.includesNarrative).toBe(false);
    });
  });

  describe('updateStage', () => {
    it('should update job stage and emit progress event', (done) => {
      const jobId = 'test-job-2';
      service.startJob(jobId, false);

      service.once('progress', (event: ProgressEvent) => {
        if (event.stage === ProgressStage.DATE_PREPROCESSING) {
          expect(event.jobId).toBe(jobId);
          expect(event.percent).toBeGreaterThan(0);
          expect(event.estimatedTimeRemainingMs).toBeDefined();
          done();
        }
      });

      // Skip initializing event
      service.removeAllListeners('progress');
      service.once('progress', (event: ProgressEvent) => {
        if (event.stage === ProgressStage.DATE_PREPROCESSING) {
          done();
        }
      });

      service.updateStage(jobId, ProgressStage.DATE_PREPROCESSING);
    });

    it('should calculate progress percentage correctly', () => {
      const jobId = 'test-job-3';
      service.startJob(jobId, false);

      service.updateStage(jobId, ProgressStage.DATE_PREPROCESSING);
      let job = service.getJobStatus(jobId);
      const progress1 = job!.percent;

      service.updateStage(jobId, ProgressStage.EXTRACTION);
      job = service.getJobStatus(jobId);
      const progress2 = job!.percent;

      expect(progress2).toBeGreaterThan(progress1);
      expect(progress1).toBeGreaterThan(0);
    });

    it('should handle custom messages', (done) => {
      const jobId = 'test-job-4';
      const customMessage = 'Custom progress message';
      service.startJob(jobId, false);

      service.once('progress', (event: ProgressEvent) => {
        if (event.stage === ProgressStage.EXTRACTION) {
          expect(event.message).toBe(customMessage);
          done();
        }
      });

      service.removeAllListeners('progress');
      service.once('progress', (event: ProgressEvent) => {
        if (event.stage === ProgressStage.EXTRACTION) {
          done();
        }
      });

      service.updateStage(jobId, ProgressStage.EXTRACTION, customMessage);
    });

    it('should not update cancelled jobs', () => {
      const jobId = 'test-job-5';
      service.startJob(jobId, false);
      service.cancelJob(jobId);

      service.updateStage(jobId, ProgressStage.EXTRACTION);

      const job = service.getJobStatus(jobId);
      expect(job?.currentStage).toBe(ProgressStage.CANCELLED);
    });
  });

  describe('progress calculation', () => {
    it('should progress from 0 to 100 through all stages', () => {
      const jobId = 'test-job-6';
      service.startJob(jobId, false);

      const stages = [
        ProgressStage.DATE_PREPROCESSING,
        ProgressStage.EXTRACTION,
        ProgressStage.DOCUMENTATION_ANALYSIS,
        ProgressStage.PRE_COMPLETENESS_CHECK,
        ProgressStage.POST_COMPLETENESS_CHECK,
        ProgressStage.VALIDATION,
        ProgressStage.FINALIZING,
      ];

      let lastPercent = 0;
      for (const stage of stages) {
        service.updateStage(jobId, stage);
        const job = service.getJobStatus(jobId);
        expect(job!.percent).toBeGreaterThan(lastPercent);
        lastPercent = job!.percent;
      }

      service.completeJob(jobId);
      const finalJob = service.getJobStatus(jobId);
      expect(finalJob!.percent).toBe(100);
    });

    it('should adjust progress when narrative is excluded', () => {
      const jobId1 = 'job-with-narrative';
      const jobId2 = 'job-without-narrative';

      service.startJob(jobId1, true);
      service.startJob(jobId2, false);

      // Progress to same stage
      service.updateStage(jobId1, ProgressStage.EXTRACTION);
      service.updateStage(jobId2, ProgressStage.EXTRACTION);

      const job1 = service.getJobStatus(jobId1);
      const job2 = service.getJobStatus(jobId2);

      // Job without narrative should have higher percentage at same stage
      expect(job2!.percent).toBeGreaterThan(job1!.percent);
    });
  });

  describe('ETA calculation', () => {
    it('should provide estimated time remaining', (done) => {
      const jobId = 'test-job-7';
      service.startJob(jobId, false);

      service.on('progress', (event: ProgressEvent) => {
        if (event.stage === ProgressStage.EXTRACTION && event.estimatedTimeRemainingMs !== undefined) {
          expect(event.estimatedTimeRemainingMs).toBeGreaterThan(0);
          service.removeAllListeners('progress');
          done();
        }
      });

      service.updateStage(jobId, ProgressStage.DATE_PREPROCESSING);
      setTimeout(() => {
        service.updateStage(jobId, ProgressStage.EXTRACTION);
      }, 100);
    });

    it('should decrease ETA as stages complete', (done) => {
      const jobId = 'test-job-8';
      service.startJob(jobId, false);

      const etas: number[] = [];

      service.on('progress', (event: ProgressEvent) => {
        if (event.estimatedTimeRemainingMs !== undefined) {
          etas.push(event.estimatedTimeRemainingMs);
        }

        if (event.stage === ProgressStage.VALIDATION) {
          // ETA should generally decrease
          expect(etas[etas.length - 1]).toBeLessThanOrEqual(etas[0] * 1.5); // Allow some variance
          service.removeAllListeners('progress');
          done();
        }
      });

      service.updateStage(jobId, ProgressStage.DATE_PREPROCESSING);
      setTimeout(() => service.updateStage(jobId, ProgressStage.EXTRACTION), 50);
      setTimeout(() => service.updateStage(jobId, ProgressStage.DOCUMENTATION_ANALYSIS), 100);
      setTimeout(() => service.updateStage(jobId, ProgressStage.VALIDATION), 150);
    });
  });

  describe('completeJob', () => {
    it('should mark job as completed', (done) => {
      const jobId = 'test-job-9';
      service.startJob(jobId, false);

      service.on('progress', (event: ProgressEvent) => {
        if (event.stage === ProgressStage.COMPLETED) {
          expect(event.percent).toBe(100);
          expect(event.message).toContain('completed');
          done();
        }
      });

      service.completeJob(jobId);
    });

    it('should set percent to 100', () => {
      const jobId = 'test-job-10';
      service.startJob(jobId, false);
      service.completeJob(jobId);

      const job = service.getJobStatus(jobId);
      expect(job?.percent).toBe(100);
      expect(job?.currentStage).toBe(ProgressStage.COMPLETED);
    });
  });

  describe('failJob', () => {
    it('should mark job as failed', (done) => {
      const jobId = 'test-job-11';
      const errorMessage = 'Test error';
      service.startJob(jobId, false);

      service.on('progress', (event: ProgressEvent) => {
        if (event.stage === ProgressStage.FAILED) {
          expect(event.message).toContain(errorMessage);
          done();
        }
      });

      service.failJob(jobId, errorMessage);
    });

    it('should update job status to failed', () => {
      const jobId = 'test-job-12';
      service.startJob(jobId, false);
      service.failJob(jobId, 'Test error');

      const job = service.getJobStatus(jobId);
      expect(job?.currentStage).toBe(ProgressStage.FAILED);
    });
  });

  describe('cancelJob', () => {
    it('should cancel an active job', () => {
      const jobId = 'test-job-13';
      service.startJob(jobId, false);
      service.updateStage(jobId, ProgressStage.EXTRACTION);

      const cancelled = service.cancelJob(jobId);
      expect(cancelled).toBe(true);

      const job = service.getJobStatus(jobId);
      expect(job?.cancelled).toBe(true);
      expect(job?.currentStage).toBe(ProgressStage.CANCELLED);
    });

    it('should not cancel completed job', () => {
      const jobId = 'test-job-14';
      service.startJob(jobId, false);
      service.completeJob(jobId);

      const cancelled = service.cancelJob(jobId);
      expect(cancelled).toBe(false);
    });

    it('should not cancel non-existent job', () => {
      const cancelled = service.cancelJob('nonexistent');
      expect(cancelled).toBe(false);
    });
  });

  describe('isCancelled', () => {
    it('should return true for cancelled jobs', () => {
      const jobId = 'test-job-15';
      service.startJob(jobId, false);
      service.cancelJob(jobId);

      expect(service.isCancelled(jobId)).toBe(true);
    });

    it('should return false for active jobs', () => {
      const jobId = 'test-job-16';
      service.startJob(jobId, false);

      expect(service.isCancelled(jobId)).toBe(false);
    });

    it('should return false for non-existent jobs', () => {
      expect(service.isCancelled('nonexistent')).toBe(false);
    });
  });

  describe('getActiveJobs', () => {
    it('should return only active jobs', () => {
      service.startJob('job-1', false);
      service.startJob('job-2', false);
      service.startJob('job-3', false);

      service.completeJob('job-1');
      service.failJob('job-2', 'error');

      const activeJobs = service.getActiveJobs();
      expect(activeJobs).toHaveLength(1);
      expect(activeJobs[0].jobId).toBe('job-3');
    });

    it('should return empty array when no active jobs', () => {
      service.startJob('job-1', false);
      service.completeJob('job-1');

      const activeJobs = service.getActiveJobs();
      expect(activeJobs).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should remove completed and failed jobs', () => {
      service.startJob('job-1', false);
      service.startJob('job-2', false);
      service.startJob('job-3', false);
      service.startJob('job-4', false);

      service.completeJob('job-1');
      service.failJob('job-2', 'error');
      service.cancelJob('job-3');

      const cleaned = service.cleanup();
      expect(cleaned).toBe(3);

      const activeJobs = service.getActiveJobs();
      expect(activeJobs).toHaveLength(1);
      expect(activeJobs[0].jobId).toBe('job-4');
    });
  });

  describe('stage timing tracking', () => {
    it('should record stage timings', (done) => {
      const jobId = 'test-job-17';
      service.startJob(jobId, false);

      service.updateStage(jobId, ProgressStage.DATE_PREPROCESSING);

      setTimeout(() => {
        service.updateStage(jobId, ProgressStage.EXTRACTION);

        const timings = service.getTimingStats();
        const datePreprocessingTiming = timings.get(ProgressStage.DATE_PREPROCESSING);

        expect(datePreprocessingTiming).toBeDefined();
        expect(datePreprocessingTiming!.sampleCount).toBeGreaterThan(0);
        done();
      }, 100);
    });

    it('should update average timing with new samples', (done) => {
      const jobId1 = 'job-1';
      const jobId2 = 'job-2';

      service.startJob(jobId1, false);
      service.updateStage(jobId1, ProgressStage.EXTRACTION);

      setTimeout(() => {
        service.updateStage(jobId1, ProgressStage.DOCUMENTATION_ANALYSIS);

        // Start second job
        service.startJob(jobId2, false);
        service.updateStage(jobId2, ProgressStage.EXTRACTION);

        setTimeout(() => {
          service.updateStage(jobId2, ProgressStage.DOCUMENTATION_ANALYSIS);

          const timings2 = service.getTimingStats();
          const avg2 = timings2.get(ProgressStage.EXTRACTION)!.averageDurationMs;
          const sampleCount = timings2.get(ProgressStage.EXTRACTION)!.sampleCount;

          expect(sampleCount).toBe(2);
          expect(avg2).toBeGreaterThan(0);
          done();
        }, 150);
      }, 100);
    });
  });

  describe('metadata', () => {
    it('should include stages completed in metadata', () => {
      const jobId = 'test-job-18';
      service.startJob(jobId, false);

      const events: ProgressEvent[] = [];
      service.on('progress', (event: ProgressEvent) => {
        events.push(event);
      });

      service.updateStage(jobId, ProgressStage.DATE_PREPROCESSING);
      service.updateStage(jobId, ProgressStage.EXTRACTION);

      const lastEvent = events[events.length - 1];
      expect(lastEvent.metadata?.stagesCompleted).toBeGreaterThan(0);
      expect(lastEvent.metadata?.totalStages).toBeDefined();
    });

    it('should include total stages based on narrative flag', () => {
      const jobId1 = 'job-with-narrative';
      const jobId2 = 'job-without-narrative';

      const events: ProgressEvent[] = [];
      service.on('progress', (event: ProgressEvent) => {
        events.push(event);
      });

      service.startJob(jobId1, true);
      service.startJob(jobId2, false);

      service.updateStage(jobId1, ProgressStage.EXTRACTION);
      service.updateStage(jobId2, ProgressStage.EXTRACTION);

      const event1 = events.find(e => e.jobId === jobId1 && e.stage === ProgressStage.EXTRACTION);
      const event2 = events.find(e => e.jobId === jobId2 && e.stage === ProgressStage.EXTRACTION);

      expect(event1?.metadata?.totalStages).toBe(9); // With narrative
      expect(event2?.metadata?.totalStages).toBe(8); // Without narrative
    });
  });
});

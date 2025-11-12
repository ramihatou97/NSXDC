/**
 * ProgressTracker Component
 * Main progress tracking component with real-time SSE updates
 */

import { useEffect } from 'react';
import { useProgress } from '../store/hooks';
import ProgressBar from './ProgressBar';
import StageIndicator from './StageIndicator';
import type { ProgressStage } from '../types';
import './ProgressTracker.css';

interface ProgressTrackerProps {
  jobId: string | null;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

export default function ProgressTracker({
  jobId,
  onComplete,
  onError,
  onCancel,
}: ProgressTrackerProps) {
  const {
    currentProgress,
    progressHistory,
    connectProgress,
    disconnectProgress,
    cancelJob,
  } = useProgress();

  // Connect to progress stream when jobId is provided
  useEffect(() => {
    if (jobId) {
      connectProgress(jobId);
    }

    return () => {
      disconnectProgress();
    };
  }, [jobId, connectProgress, disconnectProgress]);

  // Handle completion/failure
  useEffect(() => {
    if (currentProgress) {
      if (currentProgress.stage === 'completed' && onComplete) {
        onComplete();
      } else if (currentProgress.stage === 'failed' && onError) {
        onError(currentProgress.message || 'Extraction failed');
      }
    }
  }, [currentProgress, onComplete, onError]);

  const handleCancel = async () => {
    if (jobId) {
      try {
        await cancelJob(jobId);
        if (onCancel) {
          onCancel();
        }
      } catch (error) {
        console.error('Failed to cancel job:', error);
      }
    }
  };

  // Get completed stages from history
  const completedStages: ProgressStage[] = progressHistory
    .filter(event => event.percent === 100 || event.stage !== currentProgress?.stage)
    .map(event => event.stage);

  // Format estimated time remaining
  const formatTimeRemaining = (ms: number | undefined): string => {
    if (!ms) return '';

    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `~${seconds}s remaining`;
    }

    const minutes = Math.ceil(seconds / 60);
    return `~${minutes}m remaining`;
  };

  if (!currentProgress) {
    return null;
  }

  const isActive = !['completed', 'failed', 'cancelled'].includes(currentProgress.stage);

  return (
    <div className="progress-tracker">
      <div className="progress-tracker-header">
        <div className="progress-tracker-title">
          <h3>Extraction in Progress</h3>
          {currentProgress.estimatedTimeRemainingMs !== undefined && (
            <span className="time-remaining">
              {formatTimeRemaining(currentProgress.estimatedTimeRemainingMs)}
            </span>
          )}
        </div>
        {isActive && (
          <button
            className="btn-cancel"
            onClick={handleCancel}
            title="Cancel extraction"
          >
            Cancel
          </button>
        )}
      </div>

      <ProgressBar
        percent={currentProgress.percent}
        stage={currentProgress.stage}
        message={currentProgress.message}
        showPercentage
      />

      <StageIndicator
        currentStage={currentProgress.stage}
        completedStages={completedStages}
      />

      {currentProgress.metadata && (
        <div className="progress-metadata">
          <div className="metadata-item">
            <span className="metadata-label">Stage:</span>
            <span className="metadata-value">
              {currentProgress.metadata.stagesCompleted} / {currentProgress.metadata.totalStages}
            </span>
          </div>
          {currentProgress.metadata.currentStageProgress !== undefined && (
            <div className="metadata-item">
              <span className="metadata-label">Current Stage:</span>
              <span className="metadata-value">
                {currentProgress.metadata.currentStageProgress.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      )}

      {currentProgress.stage === 'completed' && (
        <div className="progress-complete">
          <div className="complete-icon">✓</div>
          <div className="complete-message">
            Extraction completed successfully!
          </div>
        </div>
      )}

      {currentProgress.stage === 'failed' && (
        <div className="progress-failed">
          <div className="failed-icon">✗</div>
          <div className="failed-message">
            {currentProgress.message || 'Extraction failed'}
          </div>
        </div>
      )}

      {currentProgress.stage === 'cancelled' && (
        <div className="progress-cancelled">
          <div className="cancelled-icon">⊘</div>
          <div className="cancelled-message">
            Extraction was cancelled
          </div>
        </div>
      )}
    </div>
  );
}

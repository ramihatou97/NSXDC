/**
 * StageIndicator Component
 * Shows all extraction stages with current stage highlighted
 */

import type { ProgressStage } from '../types';
import './StageIndicator.css';

interface StageIndicatorProps {
  currentStage: ProgressStage;
  completedStages?: ProgressStage[];
}

interface StageInfo {
  id: ProgressStage;
  label: string;
  icon: string;
}

const STAGES: StageInfo[] = [
  { id: 'initializing', label: 'Initialize', icon: '🔄' },
  { id: 'date_preprocessing', label: 'Date Processing', icon: '📅' },
  { id: 'documentation_analysis', label: 'Documentation', icon: '📋' },
  { id: 'pre_completeness_check', label: 'Pre-Check', icon: '✓' },
  { id: 'extraction', label: 'Extraction', icon: '🔍' },
  { id: 'post_completeness_check', label: 'Post-Check', icon: '✓' },
  { id: 'narrative_generation', label: 'Narrative', icon: '📄' },
  { id: 'validation', label: 'Validation', icon: '✅' },
  { id: 'finalizing', label: 'Finalize', icon: '🎯' },
];

export default function StageIndicator({
  currentStage,
  completedStages = [],
}: StageIndicatorProps) {
  const getStageStatus = (stageId: ProgressStage): 'completed' | 'current' | 'pending' | 'failed' | 'cancelled' => {
    if (currentStage === 'failed') {
      return 'failed';
    }
    if (currentStage === 'cancelled') {
      return 'cancelled';
    }
    if (currentStage === 'completed') {
      return 'completed';
    }
    if (completedStages.includes(stageId)) {
      return 'completed';
    }
    if (stageId === currentStage) {
      return 'current';
    }
    return 'pending';
  };

  const getCurrentStageIndex = () => {
    return STAGES.findIndex(s => s.id === currentStage);
  };

  const currentIndex = getCurrentStageIndex();

  return (
    <div className="stage-indicator">
      <div className="stage-indicator-header">
        <h4>Extraction Pipeline</h4>
        {currentStage === 'completed' && (
          <span className="stage-badge success">✓ Complete</span>
        )}
        {currentStage === 'failed' && (
          <span className="stage-badge error">✗ Failed</span>
        )}
        {currentStage === 'cancelled' && (
          <span className="stage-badge warning">⊘ Cancelled</span>
        )}
      </div>

      <div className="stages-container">
        {STAGES.map((stage, index) => {
          const status = getStageStatus(stage.id);
          const isActive = index <= currentIndex;

          return (
            <div
              key={stage.id}
              className={`stage-item ${status} ${isActive ? 'active' : ''}`}
            >
              <div className="stage-icon">
                {status === 'completed' && '✓'}
                {status === 'current' && (
                  <span className="spinner">{stage.icon}</span>
                )}
                {status === 'pending' && stage.icon}
                {status === 'failed' && '✗'}
                {status === 'cancelled' && '⊘'}
              </div>
              <div className="stage-label">{stage.label}</div>
              {index < STAGES.length - 1 && (
                <div className={`stage-connector ${isActive ? 'active' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

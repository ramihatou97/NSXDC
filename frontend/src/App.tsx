import Header from './components/Header';
import ExtractionPanel from './components/ExtractionPanel';
import ResultsPanel from './components/ResultsPanel';
import ProgressTracker from './components/ProgressTracker';
import { useExtraction } from './store/hooks';
import './App.css';

function App() {
  // Use Zustand store for state management
  const {
    currentExtraction,
    currentJobId,
    isLoading,
    error,
    extract,
    clearExtraction,
  } = useExtraction();

  const handleExtraction = async (clinicalNotes: string) => {
    try {
      await extract({
        clinicalNotes,
        narrativeMode: 'STANDARD', // CRITICAL: Generate discharge summary narrative
      });
    } catch (err) {
      // Error is already handled and stored in the extraction slice
      // No additional error handling needed here
    }
  };

  const handleClear = () => {
    clearExtraction();
  };

  const handleProgressComplete = () => {
    // Progress complete - extraction result will be shown via currentExtraction
  };

  const handleProgressError = (errorMsg: string) => {
    // Error already handled in extraction slice
    console.error('Progress error:', errorMsg);
  };

  const handleProgressCancel = () => {
    clearExtraction();
  };

  return (
    <div className="app">
      <Header />
      <div className="container">
        <div className="main-content">
          <ExtractionPanel
            onExtract={handleExtraction}
            onClear={handleClear}
            isLoading={isLoading}
            error={error}
          />

          {/* Show progress tracker during extraction */}
          {isLoading && currentJobId && (
            <ProgressTracker
              jobId={currentJobId}
              onComplete={handleProgressComplete}
              onError={handleProgressError}
              onCancel={handleProgressCancel}
            />
          )}

          {/* Show results when extraction is complete */}
          {currentExtraction && !isLoading && (
            <ResultsPanel
              result={currentExtraction}
              onClose={handleClear}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

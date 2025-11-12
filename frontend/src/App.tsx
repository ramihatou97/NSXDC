import Header from './components/Header';
import ExtractionPanel from './components/ExtractionPanel';
import ResultsPanel from './components/ResultsPanel';
import { useExtraction } from './store/hooks';
import './App.css';

function App() {
  // Use Zustand store for state management
  const {
    currentExtraction,
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
          {currentExtraction && (
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

import { useState } from 'react';
import Header from './components/Header';
import ExtractionPanel from './components/ExtractionPanel';
import ResultsPanel from './components/ResultsPanel';
import APIClient, { APIError } from './services/api-client';
import type { ExtractionResult } from './types';
import './App.css';

function App() {
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtraction = async (clinicalNotes: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await APIClient.extract({
        clinicalNotes,
        narrativeMode: 'STANDARD', // CRITICAL: Generate discharge summary narrative
      });

      // Transform backend response to frontend format
      const result: ExtractionResult = {
        extraction: data.extraction || {},
        narrative: data.narrative, // The discharge summary - CORE DELIVERABLE
        validation: {
          overallConfidence: data.validation?.score || 0,
          passed: data.validation?.passed || false,
          score: data.validation?.score || 0,
        },
        warnings: data.validation?.issues
          ?.filter(issue => issue.severity === 'major' || issue.severity === 'critical')
          .map(issue => `${issue.severity.toUpperCase()}: ${issue.message}`) || [],
      };

      setExtractionResult(result);
    } catch (err) {
      // Handle different error types
      if (err instanceof APIError) {
        setError(`API Error: ${err.message}${err.code ? ` (${err.code})` : ''}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }

      // Log error to server
      if (err instanceof Error) {
        APIClient.logError({
          message: err.message,
          stack: err.stack,
          context: { component: 'App', action: 'handleExtraction' },
        }).catch(() => {
          // Silently fail if error logging fails
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setExtractionResult(null);
    setError(null);
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
          {extractionResult && (
            <ResultsPanel
              result={extractionResult}
              onClose={handleClear}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

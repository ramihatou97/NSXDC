import { useState } from 'react';
import Header from './components/Header';
import ExtractionPanel from './components/ExtractionPanel';
import ResultsPanel from './components/ResultsPanel';
import './App.css';

export interface ExtractionResult {
  extraction: Record<string, any>;
  narrative?: string;  // The discharge summary narrative - CORE DELIVERABLE
  validation?: {
    overallConfidence: number;
    passed: boolean;
    score?: number;
  };
  confidence?: {
    score: number;
    level?: string;
    factors?: Record<string, number>;
    uncertainties?: string[];
    recommendations?: string[];
  };
  warnings?: string[];
}

function App() {
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtraction = async (clinicalNotes: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'demo-key', // In production, use environment variable
        },
        body: JSON.stringify({
          clinicalNotes,
          narrativeMode: 'STANDARD', // CRITICAL: Generate discharge summary narrative
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
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
          ?.filter((issue: any) => issue.severity === 'major' || issue.severity === 'critical')
          .map((issue: any) => `${issue.severity.toUpperCase()}: ${issue.message}`) || [],
      };
      
      setExtractionResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
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

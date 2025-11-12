#!/bin/bash

echo "═══════════════════════════════════════════════════════════════"
echo "📊 PHASE 1 FINAL TEST RESULTS - ALL 3 TESTS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

for test in 1 2 3; do
  echo "────────────────────────────────────────────────────────────────"
  echo "TEST $test Results:"
  echo "────────────────────────────────────────────────────────────────"
  
  if [ -f "test${test}_full_response.json" ]; then
    echo "✓ File exists"
    
    # Extract key dates
    echo ""
    echo "Key Dates:"
    echo "  Surgery: $(jq -r '.extraction.surgeryDate.value // "N/A"' test${test}_full_response.json)"
    
    # Look for POD dates in hospital course
    echo "  POD 1: $(jq -r '.extraction.hospitalCourse.dailyProgress[] | select(.postOpDay == 1) | .date // "N/A"' test${test}_full_response.json | head -1)"
    echo "  POD 2: $(jq -r '.extraction.hospitalCourse.dailyProgress[] | select(.postOpDay == 2) | .date // "N/A"' test${test}_full_response.json | head -1)"
    echo "  POD 17: $(jq -r '.extraction.hospitalCourse.dailyProgress[] | select(.postOpDay == 17) | .date // "N/A"' test${test}_full_response.json | head -1)"
    
    echo ""
    echo "Validation:"
    echo "  Score: $(jq -r '.validation.score // "N/A"' test${test}_full_response.json)/100"
    echo "  Passed: $(jq -r '.validation.passed // "N/A"' test${test}_full_response.json)"
    echo "  Issues: $(jq -r '.validation.issues | length // 0' test${test}_full_response.json)"
    
    # Count temporal errors specifically
    temporal_errors=$(jq -r '[.validation.issues[] | select(.category == "temporal")] | length' test${test}_full_response.json)
    echo "  Temporal Errors: $temporal_errors"
    
    # Show first 2 temporal errors if any
    if [ "$temporal_errors" -gt 0 ]; then
      echo ""
      echo "  First Temporal Issues:"
      jq -r '.validation.issues[] | select(.category == "temporal") | "    - [\(.severity)] \(.message)"' test${test}_full_response.json | head -2
    fi
    
    echo ""
    echo "Performance:"
    echo "  Processing Time: $(jq -r '.metadata.processingTime // "N/A"' test${test}_full_response.json)ms"
    echo "  Output Tokens: $(jq -r '.metadata.tokenCount.output // "N/A"' test${test}_full_response.json)"
    
    # Check for datePreprocessing field
    has_date_preprocessing=$(jq -r 'has("datePreprocessing")' test${test}_full_response.json)
    if [ "$has_date_preprocessing" == "true" ]; then
      echo ""
      echo "Date Preprocessing: ✓ PRESENT"
      jq -r '.datePreprocessing | "  Format: \(.detectedFormat)\n  Confidence: \(.confidence)\n  Ambiguous: \(.ambiguousDatesCount)\n  Warnings: \(.warnings | length)"' test${test}_full_response.json
    else
      echo ""
      echo "Date Preprocessing: ❌ MISSING"
    fi
    
  else
    echo "❌ File not found"
  fi
  
  echo ""
done

echo "═══════════════════════════════════════════════════════════════"
echo "🔍 COMPARISON SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "TEST 1 (AUTO) vs TEST 2 (DD/MM/YYYY) vs TEST 3 (MM/DD/YYYY):"
echo ""

echo "Surgery Dates:"
for test in 1 2 3; do
  date=$(jq -r '.extraction.surgeryDate.value // "N/A"' test${test}_full_response.json 2>/dev/null)
  echo "  TEST $test: $date"
done

echo ""
echo "POD 1 Dates:"
for test in 1 2 3; do
  date=$(jq -r '.extraction.hospitalCourse.dailyProgress[] | select(.postOpDay == 1) | .date // "N/A"' test${test}_full_response.json 2>/dev/null | head -1)
  echo "  TEST $test: $date"
done

echo ""
echo "Validation Scores:"
for test in 1 2 3; do
  score=$(jq -r '.validation.score // "N/A"' test${test}_full_response.json 2>/dev/null)
  echo "  TEST $test: $score/100"
done

echo ""
echo "Temporal Errors:"
for test in 1 2 3; do
  count=$(jq -r '[.validation.issues[] | select(.category == "temporal")] | length' test${test}_full_response.json 2>/dev/null)
  echo "  TEST $test: $count issues"
done

echo ""
echo "═══════════════════════════════════════════════════════════════"


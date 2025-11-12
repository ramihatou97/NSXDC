/**
 * Phase 2: Test Documentation Inventory Service
 * Verifies document detection and gap analysis
 */

import { readFileSync } from 'fs';
import { DocumentationInventoryService } from './src/services/documentation-inventory.service.js';

// Read test clinical notes
const clinicalNotes = readFileSync('./test_clinical_notes.txt', 'utf-8');

// Known facts from test notes:
// - Surgery date: 10/10/2025 (October 10, 2025)
// - Discharge date: 27/10/2025 (October 27, 2025)
// - Expected PODs: 0-17 (18 days)
// - Present PODs: 1, 2, 17
// - Missing PODs: 0, 3-16 (14 missing)

const surgeryDate = '2025-10-10';
const dischargeDate = '2025-10-27';

console.log('═══════════════════════════════════════════════════════════════');
console.log('📋 Phase 2: Documentation Inventory Service Test');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Create service instance
const inventoryService = new DocumentationInventoryService({
  requireAdmissionHP: true,
  requireDischargeSummary: true,
  minPODCoveragePercent: 80,
});

// Analyze documentation
console.log('🔍 Analyzing clinical notes...');
const result = inventoryService.analyze(clinicalNotes, surgeryDate, dischargeDate);

console.log('');
console.log('─────────────────────────────────────────────────────────────');
console.log('📄 Documents Detected:');
console.log('─────────────────────────────────────────────────────────────');
result.documents.forEach((doc, index) => {
  console.log(`\n${index + 1}. ${doc.title}`);
  console.log(`   Type: ${doc.type}`);
  console.log(`   POD: ${doc.postOpDay !== null ? doc.postOpDay : 'N/A'}`);
  console.log(`   Author: ${doc.author || 'Unknown'}`);
  console.log(`   Specialty: ${doc.specialty || 'Unknown'}`);
  console.log(`   Date: ${doc.date || 'Unknown'}`);
  console.log(`   Confidence: ${doc.confidence}`);
  console.log(`   Quote: "${doc.sourceQuote.substring(0, 80)}..."`);
});

console.log('');
console.log('─────────────────────────────────────────────────────────────');
console.log('📊 POD Coverage Analysis:');
console.log('─────────────────────────────────────────────────────────────');
console.log(`Surgery Date: ${result.podCoverage.surgeryDate}`);
console.log(`Discharge Date: ${result.podCoverage.dischargeDate}`);
console.log(`Expected PODs: ${result.podCoverage.expectedPODs.join(', ')}`);
console.log(`Present PODs: ${result.podCoverage.presentPODs.join(', ')}`);
console.log(`Missing PODs: ${result.podCoverage.missingPODs.join(', ')}`);
console.log(`Missing Ranges: ${result.podCoverage.missingRanges.join(', ')}`);
console.log(`Coverage: ${result.podCoverage.coveragePercentage}%`);

console.log('');
console.log('─────────────────────────────────────────────────────────────');
console.log('⚠️  Documentation Gaps:');
console.log('─────────────────────────────────────────────────────────────');
console.log(`Missing Critical: ${result.gaps.missingCritical.join(', ') || 'None'}`);
console.log(`Missing Important: ${result.gaps.missingImportant.join(', ') || 'None'}`);
console.log(`Missing POD Count: ${result.gaps.missingPODCount}`);
console.log(`Missing POD Ranges: ${result.gaps.missingPODRanges.join(', ')}`);
console.log(`Total Gap Days: ${result.gaps.totalGapDays}`);

console.log('');
console.log('─────────────────────────────────────────────────────────────');
console.log(`📈 Completeness Score: ${result.completenessScore}/100`);
console.log('─────────────────────────────────────────────────────────────');

console.log('');
console.log('⚠️  Warnings:');
result.warnings.forEach((warning, index) => {
  console.log(`${index + 1}. ${warning}`);
});

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('✅ Phase 2 Test Complete');
console.log('═══════════════════════════════════════════════════════════════');

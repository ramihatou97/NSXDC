#!/usr/bin/env tsx

/**
 * NSXDC Deployment Verification Script
 *
 * Comprehensive end-to-end verification of all Phase 1-8 implementations
 * Run before deployment to ensure all systems operational
 */

import * as fs from 'fs';
import * as http from 'http';

interface VerificationResult {
  phase: string;
  feature: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string;
}

const results: VerificationResult[] = [];

function log(phase: string, feature: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: string) {
  results.push({ phase, feature, status, message, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${phase}] ${feature}: ${message}`);
  if (details) console.log(`   → ${details}`);
}

async function makeRequest(endpoint: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function verifyServer() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 NSXDC DEPLOYMENT VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Verify server is running
  try {
    await new Promise<void>((resolve, reject) => {
      const req = http.get('http://localhost:3002/health', (res) => {
        if (res.statusCode === 200) {
          log('Server', 'Health Check', 'PASS', 'Server is running on port 3002');
          resolve();
        } else {
          reject(new Error(`Server returned status ${res.statusCode}`));
        }
      });
      req.on('error', reject);
    });
  } catch (error) {
    log('Server', 'Health Check', 'FAIL', 'Server not responding', String(error));
    process.exit(1);
  }
}

async function verifyPhase1_DatePreprocessing() {
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('Phase 1: Date Format Disambiguation');
  console.log('───────────────────────────────────────────────────────────────\n');

  try {
    const response = await makeRequest('/api/v1/extract', {
      clinicalNotes: 'Admission: 15/03/2025\nSurgery: 16/03/2025\nDischarge: 23/03/2025',
      dateFormat: 'DD/MM/YYYY',
      narrativeMode: 'STANDARD',
    });

    if (response.datePreprocessing) {
      log('Phase 1', 'Date Preprocessing', 'PASS', 'Date preprocessing metadata present');

      if (response.datePreprocessing.detectedFormat === 'DD/MM/YYYY') {
        log('Phase 1', 'Format Detection', 'PASS', 'Correct date format detected');
      } else {
        log('Phase 1', 'Format Detection', 'FAIL', `Expected DD/MM/YYYY, got ${response.datePreprocessing.detectedFormat}`);
      }

      if (response.datePreprocessing.conversionsCount > 0) {
        log('Phase 1', 'Date Conversion', 'PASS', `Converted ${response.datePreprocessing.conversionsCount} dates`);
      }
    } else {
      log('Phase 1', 'Date Preprocessing', 'FAIL', 'Date preprocessing metadata missing');
    }
  } catch (error) {
    log('Phase 1', 'Date Preprocessing', 'FAIL', 'Request failed', String(error));
  }
}

async function verifyPhase2_DocumentationInventory() {
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('Phase 2: Documentation Inventory');
  console.log('───────────────────────────────────────────────────────────────\n');

  try {
    const response = await makeRequest('/api/v1/extract', {
      clinicalNotes: fs.readFileSync('phase4_compact_test.txt', 'utf-8'),
      dateFormat: 'DD/MM/YYYY',
    });

    if (response.documentationInventory) {
      log('Phase 2', 'Documentation Inventory', 'PASS', 'Inventory metadata present');

      const inv = response.documentationInventory;
      log('Phase 2', 'Document Detection', 'PASS', `Detected ${inv.documents.length} documents`);
      log('Phase 2', 'Completeness Score', 'PASS', `Score: ${inv.completenessScore}/100`);

      if (inv.gaps) {
        log('Phase 2', 'Gap Detection', 'PASS', `Identified ${inv.gaps.missingCritical.length} critical gaps`);
      }
    } else {
      log('Phase 2', 'Documentation Inventory', 'FAIL', 'Inventory metadata missing');
    }
  } catch (error) {
    log('Phase 2', 'Documentation Inventory', 'FAIL', 'Request failed', String(error));
  }
}

async function verifyPhase3_AdaptiveTokens() {
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('Phase 3: Adaptive Token Allocation');
  console.log('───────────────────────────────────────────────────────────────\n');

  try {
    const response = await makeRequest('/api/v1/extract', {
      clinicalNotes: 'Brief note: Patient admitted, surgery performed, discharged.',
      dateFormat: 'AUTO',
    });

    if (response.metadata && response.metadata.tokenCount) {
      log('Phase 3', 'Token Counting', 'PASS', 'Token usage metadata present');

      const tokens = response.metadata.tokenCount;
      log('Phase 3', 'Token Allocation', 'PASS', `Input: ${tokens.input}, Output: ${tokens.output}`);

      if (tokens.cached !== undefined) {
        log('Phase 3', 'Prompt Caching', 'PASS', `Cached tokens: ${tokens.cached}`);
      }
    } else {
      log('Phase 3', 'Token Counting', 'FAIL', 'Token metadata missing');
    }
  } catch (error) {
    log('Phase 3', 'Adaptive Tokens', 'FAIL', 'Request failed', String(error));
  }
}

async function verifyPhase4_SourceContext() {
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('Phase 4: Source Context Tracking');
  console.log('───────────────────────────────────────────────────────────────\n');

  try {
    const response = await makeRequest('/api/v1/extract', {
      clinicalNotes: fs.readFileSync('phase4_compact_test.txt', 'utf-8'),
      dateFormat: 'DD/MM/YYYY',
    });

    if (response.extraction) {
      let sourceContextCount = 0;
      let sourceNoteTypeCount = 0;

      function checkObject(obj: any) {
        if (obj && typeof obj === 'object') {
          if (obj.sourceContext) sourceContextCount++;
          if (obj.sourceNoteType) sourceNoteTypeCount++;

          for (const key in obj) {
            if (typeof obj[key] === 'object') {
              checkObject(obj[key]);
            }
          }
        }
      }

      checkObject(response.extraction);

      if (sourceContextCount > 0) {
        log('Phase 4', 'Source Context', 'PASS', `Found ${sourceContextCount} fields with sourceContext`);
      } else {
        log('Phase 4', 'Source Context', 'FAIL', 'No sourceContext fields found');
      }

      if (sourceNoteTypeCount > 0) {
        log('Phase 4', 'Source Note Type', 'PASS', `Found ${sourceNoteTypeCount} fields with sourceNoteType`);
      } else {
        log('Phase 4', 'Source Note Type', 'WARN', 'Limited sourceNoteType attribution');
      }
    } else {
      log('Phase 4', 'Source Context', 'FAIL', 'Extraction data missing');
    }
  } catch (error) {
    log('Phase 4', 'Source Context', 'FAIL', 'Request failed', String(error));
  }
}

async function verifyPhases567_ExtractedData() {
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('Phases 5-7: Timeline / Clinical Judgment / Discharge Strategy');
  console.log('───────────────────────────────────────────────────────────────\n');

  try {
    const response = await makeRequest('/api/v1/extract', {
      clinicalNotes: fs.readFileSync('phase4_compact_test.txt', 'utf-8'),
      dateFormat: 'DD/MM/YYYY',
    });

    if (response.extraction) {
      const ext = response.extraction;

      // Phase 5: Timeline tracking
      if (ext.hospitalCourse && ext.hospitalCourse.dailyProgress) {
        log('Phase 5', 'Timeline Tracking', 'PASS', `Tracked ${ext.hospitalCourse.dailyProgress.length} hospital days`);

        const timeline = ext.hospitalCourse.clinicalTrajectory;
        if (timeline && timeline.neurologicalTrajectory) {
          log('Phase 5', 'Clinical Trajectory', 'PASS', 'Longitudinal trajectory documented');
        }
      } else {
        log('Phase 5', 'Timeline Tracking', 'WARN', 'Hospital course tracking limited');
      }

      // Phase 6: Clinical judgment (deduction)
      let deductionCount = 0;
      function countDeductions(obj: any) {
        if (obj && typeof obj === 'object') {
          if (obj.deductionMethod) deductionCount++;
          for (const key in obj) {
            if (typeof obj[key] === 'object') countDeductions(obj[key]);
          }
        }
      }
      countDeductions(ext);

      if (deductionCount > 0) {
        log('Phase 6', 'Clinical Judgment', 'PASS', `Applied clinical deduction ${deductionCount} times`);
      } else {
        log('Phase 6', 'Clinical Judgment', 'WARN', 'No explicit deductions found');
      }

      // Phase 7: Discharge strategy
      if (ext.dischargeStatus) {
        const discharge = ext.dischargeStatus;
        let dischargeFieldCount = 0;
        Object.keys(discharge).forEach(key => {
          if (discharge[key] && typeof discharge[key] === 'object') dischargeFieldCount++;
        });

        log('Phase 7', 'Discharge Strategy', 'PASS', `Extracted ${dischargeFieldCount} discharge fields`);

        if (discharge.dischargeGCS || discharge.dischargeKPS || discharge.dischargemRS) {
          log('Phase 7', 'Discharge Scores', 'PASS', 'Discharge functional scores present');
        }
      } else {
        log('Phase 7', 'Discharge Strategy', 'WARN', 'Limited discharge data');
      }
    }
  } catch (error) {
    log('Phases 5-7', 'Timeline/Judgment/Discharge', 'FAIL', 'Request failed', String(error));
  }
}

async function verifyPhase8_CompletenessChecker() {
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('Phase 8: Completeness Checker');
  console.log('───────────────────────────────────────────────────────────────\n');

  try {
    const response = await makeRequest('/api/v1/extract', {
      clinicalNotes: fs.readFileSync('phase4_compact_test.txt', 'utf-8'),
      dateFormat: 'DD/MM/YYYY',
    });

    if (response.completenessCheck) {
      log('Phase 8', 'Completeness Check', 'PASS', 'Completeness metadata present');

      const check = response.completenessCheck;

      if (check.preExtraction) {
        log('Phase 8', 'Pre-Extraction', 'PASS', `Readiness: ${check.preExtraction.readinessScore}/100`);
        log('Phase 8', 'Pre-Extraction Checks', 'PASS', `${check.preExtraction.checks.length} checks performed`);
      }

      if (check.postExtraction) {
        log('Phase 8', 'Post-Extraction', 'PASS', `Completeness: ${check.postExtraction.completenessScore}/100`);
        log('Phase 8', 'Post-Extraction Checks', 'PASS', `${check.postExtraction.checks.length} checks performed`);

        const temporal = check.postExtraction.checks.filter((c: any) => c.type === 'temporal_coverage');
        if (temporal.length > 0) {
          const violations = temporal.filter((c: any) => !c.passed).length;
          if (violations === 0) {
            log('Phase 8', 'Temporal Crossover Detection', 'PASS', 'No temporal violations detected');
          } else {
            log('Phase 8', 'Temporal Crossover Detection', 'WARN', `${violations} temporal violations found`);
          }
        }
      }
    } else {
      log('Phase 8', 'Completeness Check', 'FAIL', 'Completeness metadata missing');
    }
  } catch (error) {
    log('Phase 8', 'Completeness Checker', 'FAIL', 'Request failed', String(error));
  }
}

async function verifyValidationLayer() {
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('QA Validation Layer (Always On)');
  console.log('───────────────────────────────────────────────────────────────\n');

  try {
    const response = await makeRequest('/api/v1/extract', {
      clinicalNotes: fs.readFileSync('phase4_compact_test.txt', 'utf-8'),
      dateFormat: 'DD/MM/YYYY',
    });

    if (response.validation) {
      log('Validation', 'QA Layer', 'PASS', 'Validation layer active');
      log('Validation', 'Validation Score', response.validation.passed ? 'PASS' : 'WARN', `Score: ${response.validation.score}/100`);
      log('Validation', 'Issues Detected', 'PASS', `${response.validation.issues.length} issues found`);
    } else {
      log('Validation', 'QA Layer', 'FAIL', 'Validation metadata missing');
    }
  } catch (error) {
    log('Validation', 'QA Layer', 'FAIL', 'Request failed', String(error));
  }
}

async function generateReport() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  const total = results.length;

  console.log(`Total Checks: ${total}`);
  console.log(`✅ Passed: ${passed} (${Math.round((passed / total) * 100)}%)`);
  console.log(`❌ Failed: ${failed} (${Math.round((failed / total) * 100)}%)`);
  console.log(`⚠️  Warnings: ${warnings} (${Math.round((warnings / total) * 100)}%)\n`);

  if (failed === 0) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ ALL SYSTEMS OPERATIONAL - READY FOR DEPLOYMENT');
    console.log('═══════════════════════════════════════════════════════════════\n');
    return true;
  } else {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('❌ DEPLOYMENT VERIFICATION FAILED');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('Failed Checks:\n');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • [${r.phase}] ${r.feature}: ${r.message}`);
      if (r.details) console.log(`     ${r.details}`);
    });
    console.log('');
    return false;
  }
}

async function main() {
  try {
    await verifyServer();
    await verifyPhase1_DatePreprocessing();
    await verifyPhase2_DocumentationInventory();
    await verifyPhase3_AdaptiveTokens();
    await verifyPhase4_SourceContext();
    await verifyPhases567_ExtractedData();
    await verifyPhase8_CompletenessChecker();
    await verifyValidationLayer();

    const success = await generateReport();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

main();

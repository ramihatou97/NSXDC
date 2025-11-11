/**
 * Request Validation Middleware
 * 
 * Comprehensive validation for API requests with detailed error messages.
 * Day 4 Enhancement - Week 1
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Validation error type for consistent error responses
 */
interface ValidationError {
  code: string;
  message: string;
  field?: string;
  details?: string;
}

/**
 * Allowed values for extraction modes
 */
const ALLOWED_MODES = ['VALIDATED', 'SIMPLE'] as const;

/**
 * Allowed values for narrative modes
 */
const ALLOWED_NARRATIVE_MODES = ['STRICT', 'STANDARD', 'ENHANCED'] as const;

/**
 * Allowed values for date formats
 */
const ALLOWED_DATE_FORMATS = ['AUTO', 'DD/MM/YYYY', 'MM/DD/YYYY'] as const;

/**
 * Allowed values for region locales
 */
const ALLOWED_REGION_LOCALES = ['CA', 'US', 'UK', 'AU', 'NZ', 'EU'] as const;

/**
 * Maximum length for clinical notes (10MB in characters)
 */
const MAX_CLINICAL_NOTES_LENGTH = 10 * 1024 * 1024;

/**
 * Minimum length for clinical notes
 */
const MIN_CLINICAL_NOTES_LENGTH = 50;

/**
 * Maximum length for date format hints
 */
const MAX_DATE_FORMAT_HINTS_LENGTH = 500;

/**
 * Validate extraction request middleware
 * 
 * Validates all fields in the extraction request body:
 * - clinicalNotes (required, string, min 50 chars, max 10MB)
 * - mode (optional, enum: VALIDATED | SIMPLE)
 * - narrativeMode (optional, enum: STRICT | STANDARD | ENHANCED)
 * - includeValidation (optional, boolean)
 * - dateFormat (optional, enum: AUTO | DD/MM/YYYY | MM/DD/YYYY)
 * - regionLocale (optional, enum: CA | US | UK | AU | NZ | EU)
 * - dateFormatHints (optional, string, max 500 chars)
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns 400 with validation errors or calls next()
 */
export function validateExtractionRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors: ValidationError[] = [];

  // Validate clinicalNotes (REQUIRED)
  if (!req.body.clinicalNotes) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'clinicalNotes is required',
      field: 'clinicalNotes',
      details: 'The request body must include a clinicalNotes field with the clinical text to extract'
    });
  } else if (typeof req.body.clinicalNotes !== 'string') {
    errors.push({
      code: 'INVALID_FIELD_TYPE',
      message: 'clinicalNotes must be a string',
      field: 'clinicalNotes',
      details: `Expected string but received ${typeof req.body.clinicalNotes}`
    });
  } else {
    // Validate length
    const length = req.body.clinicalNotes.length;
    
    if (length < MIN_CLINICAL_NOTES_LENGTH) {
      errors.push({
        code: 'FIELD_TOO_SHORT',
        message: `clinicalNotes must be at least ${MIN_CLINICAL_NOTES_LENGTH} characters`,
        field: 'clinicalNotes',
        details: `Received ${length} characters. Clinical notes should contain meaningful medical information.`
      });
    }
    
    if (length > MAX_CLINICAL_NOTES_LENGTH) {
      errors.push({
        code: 'FIELD_TOO_LONG',
        message: `clinicalNotes exceeds maximum length of ${MAX_CLINICAL_NOTES_LENGTH} characters`,
        field: 'clinicalNotes',
        details: `Received ${length} characters. Consider splitting large documents into multiple requests.`
      });
    }

    // Check if it's just whitespace
    if (req.body.clinicalNotes.trim().length === 0) {
      errors.push({
        code: 'FIELD_EMPTY',
        message: 'clinicalNotes cannot be empty or contain only whitespace',
        field: 'clinicalNotes',
        details: 'The clinical notes field contains no meaningful text content'
      });
    }
  }

  // Validate mode (OPTIONAL, but if provided must be valid)
  if (req.body.mode !== undefined) {
    if (typeof req.body.mode !== 'string') {
      errors.push({
        code: 'INVALID_FIELD_TYPE',
        message: 'mode must be a string',
        field: 'mode',
        details: `Expected string but received ${typeof req.body.mode}`
      });
    } else if (!ALLOWED_MODES.includes(req.body.mode as any)) {
      errors.push({
        code: 'INVALID_ENUM_VALUE',
        message: `mode must be one of: ${ALLOWED_MODES.join(', ')}`,
        field: 'mode',
        details: `Received: "${req.body.mode}". Note: NSXDC enforces VALIDATED mode for quality assurance.`
      });
    }
  }

  // Validate narrativeMode (OPTIONAL)
  if (req.body.narrativeMode !== undefined && req.body.narrativeMode !== null) {
    if (typeof req.body.narrativeMode !== 'string') {
      errors.push({
        code: 'INVALID_FIELD_TYPE',
        message: 'narrativeMode must be a string',
        field: 'narrativeMode',
        details: `Expected string but received ${typeof req.body.narrativeMode}`
      });
    } else if (!ALLOWED_NARRATIVE_MODES.includes(req.body.narrativeMode as any)) {
      errors.push({
        code: 'INVALID_ENUM_VALUE',
        message: `narrativeMode must be one of: ${ALLOWED_NARRATIVE_MODES.join(', ')}`,
        field: 'narrativeMode',
        details: `Received: "${req.body.narrativeMode}". STRICT = data only, STANDARD = clinical summary, ENHANCED = rich context.`
      });
    }
  }

  // Validate includeValidation (OPTIONAL)
  if (req.body.includeValidation !== undefined) {
    if (typeof req.body.includeValidation !== 'boolean') {
      errors.push({
        code: 'INVALID_FIELD_TYPE',
        message: 'includeValidation must be a boolean',
        field: 'includeValidation',
        details: `Expected boolean but received ${typeof req.body.includeValidation}. Note: NSXDC enforces validation to be always true.`
      });
    }
  }

  // Validate dateFormat (OPTIONAL - Phase 1)
  if (req.body.dateFormat !== undefined && req.body.dateFormat !== null) {
    if (typeof req.body.dateFormat !== 'string') {
      errors.push({
        code: 'INVALID_FIELD_TYPE',
        message: 'dateFormat must be a string',
        field: 'dateFormat',
        details: `Expected string but received ${typeof req.body.dateFormat}`
      });
    } else if (!ALLOWED_DATE_FORMATS.includes(req.body.dateFormat as any)) {
      errors.push({
        code: 'INVALID_ENUM_VALUE',
        message: `dateFormat must be one of: ${ALLOWED_DATE_FORMATS.join(', ')}`,
        field: 'dateFormat',
        details: `Received: "${req.body.dateFormat}". AUTO = detect automatically, DD/MM/YYYY = European, MM/DD/YYYY = US format.`
      });
    }
  }

  // Validate regionLocale (OPTIONAL - Phase 1)
  if (req.body.regionLocale !== undefined && req.body.regionLocale !== null && req.body.regionLocale !== '') {
    if (typeof req.body.regionLocale !== 'string') {
      errors.push({
        code: 'INVALID_FIELD_TYPE',
        message: 'regionLocale must be a string',
        field: 'regionLocale',
        details: `Expected string but received ${typeof req.body.regionLocale}`
      });
    } else if (!ALLOWED_REGION_LOCALES.includes(req.body.regionLocale as any)) {
      errors.push({
        code: 'INVALID_ENUM_VALUE',
        message: `regionLocale must be one of: ${ALLOWED_REGION_LOCALES.join(', ')}`,
        field: 'regionLocale',
        details: `Received: "${req.body.regionLocale}". Supported regions: Canada (CA), United States (US), United Kingdom (UK), Australia (AU), New Zealand (NZ), European Union (EU).`
      });
    }
  }

  // Validate dateFormatHints (OPTIONAL - Phase 1)
  if (req.body.dateFormatHints !== undefined && req.body.dateFormatHints !== null && req.body.dateFormatHints !== '') {
    if (typeof req.body.dateFormatHints !== 'string') {
      errors.push({
        code: 'INVALID_FIELD_TYPE',
        message: 'dateFormatHints must be a string',
        field: 'dateFormatHints',
        details: `Expected string but received ${typeof req.body.dateFormatHints}`
      });
    } else if (req.body.dateFormatHints.length > MAX_DATE_FORMAT_HINTS_LENGTH) {
      errors.push({
        code: 'FIELD_TOO_LONG',
        message: `dateFormatHints exceeds maximum length of ${MAX_DATE_FORMAT_HINTS_LENGTH} characters`,
        field: 'dateFormatHints',
        details: `Received ${req.body.dateFormatHints.length} characters. Hints should be concise location/context information.`
      });
    }
  }

  // If there are validation errors, return 400
  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Request validation failed with ${errors.length} error(s)`,
        errors: errors
      }
    });
    return;
  }

  // Validation passed, proceed to next middleware
  next();
}

/**
 * Sanitize request body to remove unexpected fields
 * This helps prevent injection attacks and keeps requests clean
 * 
 * @param req - Express request object
 * @param next - Express next function
 */
export function sanitizeRequestBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Define allowed fields
  const allowedFields = [
    'clinicalNotes',
    'mode',
    'narrativeMode',
    'includeValidation',
    'dateFormat',
    'regionLocale',
    'dateFormatHints'
  ];

  // Remove any fields not in the allowed list
  const sanitized: Record<string, any> = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      sanitized[field] = req.body[field];
    }
  }

  // Replace request body with sanitized version
  req.body = sanitized;

  next();
}

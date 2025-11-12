/**
 * Unit Tests: Validation Middleware
 * Tests for validateExtractionRequest and sanitizeRequestBody
 */

import { Request, Response, NextFunction } from 'express';
import { validateExtractionRequest, sanitizeRequestBody } from '../../../src/middleware/validation.middleware';

// Mock Express objects
const createMockRequest = (body: any = {}): Partial<Request> => ({
  body,
  method: 'POST',
  path: '/api/v1/extract',
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = (): NextFunction => jest.fn();

describe('validateExtractionRequest', () => {
  describe('clinicalNotes validation', () => {
    it('should reject missing clinicalNotes', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            errors: expect.arrayContaining([
              expect.objectContaining({
                code: 'MISSING_REQUIRED_FIELD',
                field: 'clinicalNotes',
              }),
            ]),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject non-string clinicalNotes', () => {
      const req = createMockRequest({ clinicalNotes: 123 });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                code: 'INVALID_FIELD_TYPE',
                field: 'clinicalNotes',
              }),
            ]),
          }),
        })
      );
    });

    it('should reject clinicalNotes shorter than 50 characters', () => {
      const req = createMockRequest({ clinicalNotes: 'Short note' });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                code: 'FIELD_TOO_SHORT',
                field: 'clinicalNotes',
                message: expect.stringContaining('at least 50 characters'),
              }),
            ]),
          }),
        })
      );
    });

    it('should reject clinicalNotes longer than 10MB', () => {
      const largeClinicalNotes = 'a'.repeat(10 * 1024 * 1024 + 1); // 10MB + 1 char
      const req = createMockRequest({ clinicalNotes: largeClinicalNotes });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                code: 'FIELD_TOO_LONG',
                field: 'clinicalNotes',
              }),
            ]),
          }),
        })
      );
    });

    it('should reject empty/whitespace-only clinicalNotes', () => {
      const req = createMockRequest({ clinicalNotes: '   '.repeat(20) }); // 60 spaces
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                code: 'FIELD_EMPTY',
                field: 'clinicalNotes',
              }),
            ]),
          }),
        })
      );
    });

    it('should accept valid clinicalNotes (50+ chars)', () => {
      const validNotes = 'This is a valid clinical note with sufficient length for testing purposes.';
      const req = createMockRequest({ clinicalNotes: validNotes });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('mode validation', () => {
    it('should accept valid mode: VALIDATED', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        mode: 'VALIDATED',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should accept valid mode: SIMPLE', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        mode: 'SIMPLE',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid mode value', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        mode: 'INVALID_MODE',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                code: 'INVALID_ENUM_VALUE',
                field: 'mode',
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('narrativeMode validation', () => {
    it('should accept valid narrativeMode: STRICT', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        narrativeMode: 'STRICT',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should accept valid narrativeMode: STANDARD', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        narrativeMode: 'STANDARD',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should accept valid narrativeMode: ENHANCED', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        narrativeMode: 'ENHANCED',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid narrativeMode value', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        narrativeMode: 'INVALID',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                code: 'INVALID_ENUM_VALUE',
                field: 'narrativeMode',
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('dateFormat validation', () => {
    it('should accept valid dateFormat: AUTO', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        dateFormat: 'AUTO',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should accept valid dateFormat: DD/MM/YYYY', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        dateFormat: 'DD/MM/YYYY',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should accept valid dateFormat: MM/DD/YYYY', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        dateFormat: 'MM/DD/YYYY',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid dateFormat value', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        dateFormat: 'YYYY-MM-DD',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                code: 'INVALID_ENUM_VALUE',
                field: 'dateFormat',
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('regionLocale validation', () => {
    const validLocales = ['CA', 'US', 'UK', 'AU', 'NZ', 'EU'];

    validLocales.forEach((locale) => {
      it(`should accept valid regionLocale: ${locale}`, () => {
        const req = createMockRequest({
          clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
          regionLocale: locale,
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateExtractionRequest(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
      });
    });

    it('should reject invalid regionLocale value', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        regionLocale: 'INVALID',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                code: 'INVALID_ENUM_VALUE',
                field: 'regionLocale',
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('dateFormatHints validation', () => {
    it('should accept valid dateFormatHints', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        dateFormatHints: 'Use DD/MM/YYYY format for European dates.',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject dateFormatHints longer than 500 characters', () => {
      const longHints = 'a'.repeat(501);
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        dateFormatHints: longHints,
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                code: 'FIELD_TOO_LONG',
                field: 'dateFormatHints',
              }),
            ]),
          }),
        })
      );
    });

    it('should reject non-string dateFormatHints', () => {
      const req = createMockRequest({
        clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
        dateFormatHints: 12345,
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                code: 'INVALID_FIELD_TYPE',
                field: 'dateFormatHints',
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('multiple validation errors', () => {
    it('should report all validation errors at once', () => {
      const req = createMockRequest({
        clinicalNotes: 'Short',
        mode: 'INVALID',
        narrativeMode: 'WRONG',
        dateFormat: 'BAD',
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateExtractionRequest(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('4 error(s)'), // All 4 field errors
            errors: expect.arrayContaining([
              expect.objectContaining({ field: 'clinicalNotes' }),
              expect.objectContaining({ field: 'mode' }),
              expect.objectContaining({ field: 'narrativeMode' }),
              expect.objectContaining({ field: 'dateFormat' }),
            ]),
          }),
        })
      );
    });
  });
});

describe('sanitizeRequestBody', () => {
  it('should allow all expected fields', () => {
    const req = createMockRequest({
      clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
      mode: 'VALIDATED',
      narrativeMode: 'STANDARD',
      dateFormat: 'AUTO',
      regionLocale: 'CA',
      dateFormatHints: 'Some hints',
    });
    const res = createMockResponse();
    const next = createMockNext();

    sanitizeRequestBody(req as Request, res as Response, next);

    expect(req.body).toEqual({
      clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
      mode: 'VALIDATED',
      narrativeMode: 'STANDARD',
      dateFormat: 'AUTO',
      regionLocale: 'CA',
      dateFormatHints: 'Some hints',
    });
    expect(next).toHaveBeenCalled();
  });

  it('should remove unexpected fields (XSS protection)', () => {
    const req = createMockRequest({
      clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
      mode: 'VALIDATED',
      maliciousField: '<script>alert("XSS")</script>',
      extraData: 'Should be removed',
    });
    const res = createMockResponse();
    const next = createMockNext();

    sanitizeRequestBody(req as Request, res as Response, next);

    expect(req.body).toEqual({
      clinicalNotes: 'Valid clinical note with sufficient length for testing purposes.',
      mode: 'VALIDATED',
    });
    expect(req.body.maliciousField).toBeUndefined();
    expect(req.body.extraData).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('should handle empty body', () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = createMockNext();

    sanitizeRequestBody(req as Request, res as Response, next);

    expect(req.body).toEqual({});
    expect(next).toHaveBeenCalled();
  });
});

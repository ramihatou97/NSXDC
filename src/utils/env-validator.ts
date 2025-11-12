/**
 * Environment Variable Validation Utility
 * Validates required environment variables at startup
 */

interface EnvValidationError {
  variable: string;
  message: string;
  required: boolean;
}

interface EnvValidationResult {
  isValid: boolean;
  errors: EnvValidationError[];
  warnings: EnvValidationError[];
}

/**
 * Validates required environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: EnvValidationError[] = [];
  const warnings: EnvValidationError[] = [];

  // Critical: Anthropic API Key
  if (!process.env.ANTHROPIC_API_KEY) {
    errors.push({
      variable: 'ANTHROPIC_API_KEY',
      message: 'Anthropic API key is required. Set ANTHROPIC_API_KEY in your .env file.',
      required: true,
    });
  } else if (process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
    errors.push({
      variable: 'ANTHROPIC_API_KEY',
      message: 'ANTHROPIC_API_KEY is set to placeholder value. Please set a valid API key.',
      required: true,
    });
  }

  // Optional but recommended: Model
  if (!process.env.MODEL) {
    warnings.push({
      variable: 'MODEL',
      message: 'MODEL not set. Using default: claude-sonnet-4-5-20250929',
      required: false,
    });
  }

  // Optional: Port
  if (!process.env.PORT) {
    warnings.push({
      variable: 'PORT',
      message: 'PORT not set. Using default: 3002',
      required: false,
    });
  }

  // Optional but important: Node Environment
  if (!process.env.NODE_ENV) {
    warnings.push({
      variable: 'NODE_ENV',
      message: 'NODE_ENV not set. Using default: development',
      required: false,
    });
  }

  // Validate numeric values if present
  if (process.env.PORT && isNaN(Number(process.env.PORT))) {
    errors.push({
      variable: 'PORT',
      message: 'PORT must be a valid number',
      required: true,
    });
  }

  if (process.env.ANTHROPIC_MAX_TOKENS && isNaN(Number(process.env.ANTHROPIC_MAX_TOKENS))) {
    errors.push({
      variable: 'ANTHROPIC_MAX_TOKENS',
      message: 'ANTHROPIC_MAX_TOKENS must be a valid number',
      required: true,
    });
  }

  if (process.env.ANTHROPIC_TEMPERATURE) {
    const temp = Number(process.env.ANTHROPIC_TEMPERATURE);
    if (isNaN(temp) || temp < 0 || temp > 1) {
      errors.push({
        variable: 'ANTHROPIC_TEMPERATURE',
        message: 'ANTHROPIC_TEMPERATURE must be a number between 0 and 1',
        required: true,
      });
    }
  }

  // Validate rate limiting values if present
  if (process.env.RATE_LIMIT_MAX_REQUESTS && isNaN(Number(process.env.RATE_LIMIT_MAX_REQUESTS))) {
    errors.push({
      variable: 'RATE_LIMIT_MAX_REQUESTS',
      message: 'RATE_LIMIT_MAX_REQUESTS must be a valid number',
      required: true,
    });
  }

  if (process.env.RATE_LIMIT_WINDOW_MS && isNaN(Number(process.env.RATE_LIMIT_WINDOW_MS))) {
    errors.push({
      variable: 'RATE_LIMIT_WINDOW_MS',
      message: 'RATE_LIMIT_WINDOW_MS must be a valid number',
      required: true,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Prints validation results to console
 */
export function printValidationResults(result: EnvValidationResult): void {
  if (result.errors.length > 0) {
    console.error('\n❌ Environment Validation Failed\n');
    console.error('The following required environment variables have issues:\n');

    result.errors.forEach((error, index) => {
      console.error(`  ${index + 1}. ${error.variable}`);
      console.error(`     ${error.message}\n`);
    });

    console.error('Please check your .env file and ensure all required variables are set.');
    console.error('Refer to .env.example for the complete list of variables.\n');
  }

  if (result.warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn('\n⚠️  Environment Warnings:\n');

    result.warnings.forEach((warning, index) => {
      console.warn(`  ${index + 1}. ${warning.variable}`);
      console.warn(`     ${warning.message}\n`);
    });
  }

  if (result.isValid && result.errors.length === 0) {
    console.log('✅ Environment validation passed\n');
  }
}

/**
 * Validates environment and exits if validation fails
 */
export function validateEnvironmentOrExit(): void {
  const result = validateEnvironment();
  printValidationResults(result);

  if (!result.isValid) {
    console.error('Server cannot start due to environment validation errors.');
    process.exit(1);
  }
}

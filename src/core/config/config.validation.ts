import { Logger } from '@nestjs/common';

/**
 * Validate all required environment variables at application startup.
 * Called from main.ts before creating the Nest app.
 * Crashes the process with clear error messages if critical vars are missing.
 */
export function validateEnvironment(): void {
  const logger = new Logger('ConfigValidation');
  const errors: string[] = [];
  const warnings: string[] = [];

  // ═══ CRITICAL — App MUST NOT start without these ═══
  const required: Array<{ key: string; description: string }> = [
    { key: 'DATABASE_URL', description: 'PostgreSQL connection string' },
    { key: 'JWT_SECRET', description: 'JWT signing secret (min 32 chars recommended)' },
    { key: 'REDIS_URL', description: 'Redis connection string' },
    { key: 'CREDENTIAL_ENCRYPTION_KEY', description: 'AES-256 encryption key for user credentials' },
    { key: 'N8N_WEBHOOK_SECRET', description: 'Shared secret for n8n → FlowOS callbacks' },
  ];

  for (const { key, description } of required) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      errors.push(`  ❌ ${key} — ${description}`);
    }
  }

  // Validate JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    warnings.push(`  ⚠️  JWT_SECRET is only ${jwtSecret.length} chars. Recommended: 32+ chars.`);
  }

  // Validate CREDENTIAL_ENCRYPTION_KEY length (AES-256 = 32 bytes)
  const encKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (encKey && encKey.length < 32) {
    warnings.push(`  ⚠️  CREDENTIAL_ENCRYPTION_KEY is only ${encKey.length} chars. Must be exactly 32 chars for AES-256.`);
  }

  // ═══ RECOMMENDED — Log warnings but don't crash ═══
  const recommended: Array<{ key: string; description: string; devDefault?: string }> = [
    { key: 'N8N_API_URL', description: 'n8n API base URL', devDefault: 'http://localhost:5679' },
    { key: 'N8N_API_KEY', description: 'n8n API key for workflow management' },
    { key: 'CORS_ORIGIN', description: 'Allowed CORS origins (comma-separated)' },
  ];

  for (const { key, description, devDefault } of recommended) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      if (process.env.NODE_ENV === 'production') {
        warnings.push(`  ⚠️  ${key} — ${description} (not set, required for production)`);
      } else if (devDefault) {
        // Set default for development
        process.env[key] = devDefault;
      }
    }
  }

  // Production-only checks
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.PAYMENT_WEBHOOK_SECRET) {
      warnings.push('  ⚠️  PAYMENT_WEBHOOK_SECRET — Payment signature verification disabled');
    }
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
      errors.push('  ❌ CORS_ORIGIN — Must be set explicitly in production (not *)');
    }
  }

  // Output results
  if (warnings.length > 0) {
    logger.warn('Environment configuration warnings:');
    warnings.forEach((w) => logger.warn(w));
  }

  if (errors.length > 0) {
    logger.error('═══════════════════════════════════════════');
    logger.error('FATAL: Missing required environment variables');
    logger.error('═══════════════════════════════════════════');
    errors.forEach((e) => logger.error(e));
    logger.error('');
    logger.error('Copy .env.example to .env and fill in all required values.');
    logger.error('═══════════════════════════════════════════');
    process.exit(1);
  }

  logger.log('✅ Environment configuration validated');
}

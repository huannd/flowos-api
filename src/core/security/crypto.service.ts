import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedPayload {
  encryptedData: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const rawKey =
      this.configService.getOrThrow<string>('CREDENTIAL_ENCRYPTION_KEY');
    if (rawKey.length < 32) {
      throw new Error(
        `CREDENTIAL_ENCRYPTION_KEY must be at least 32 characters (got ${rawKey.length}). ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"`,
      );
    }
    // Derive a 32-byte key from the configured secret
    this.key = Buffer.alloc(32);
    Buffer.from(rawKey, 'utf-8').copy(this.key);
  }

  /**
   * Encrypt data using AES-256-GCM.
   * Returns encrypted data, IV, and auth tag as hex strings.
   */
  encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt data encrypted with AES-256-GCM.
   */
  decrypt(payload: EncryptedPayload): string {
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(payload.encryptedData, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  }

  /**
   * Encrypt a JSON object.
   */
  encryptJson(data: Record<string, unknown>): EncryptedPayload {
    return this.encrypt(JSON.stringify(data));
  }

  /**
   * Decrypt to a JSON object.
   */
  decryptJson<T = Record<string, unknown>>(payload: EncryptedPayload): T {
    return JSON.parse(this.decrypt(payload));
  }
}

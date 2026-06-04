import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CryptoService } from '../../core/security/crypto.service';

@Injectable()
export class CredentialService {
  private readonly logger = new Logger(CredentialService.name);

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  /**
   * Create a new encrypted credential.
   */
  async create(
    userId: string,
    name: string,
    type: string,
    data: Record<string, unknown>,
  ) {
    const encrypted = this.crypto.encryptJson(data);

    const credential = await this.prisma.userCredential.create({
      data: {
        userId,
        name,
        type,
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      },
      select: { id: true, name: true, type: true, createdAt: true },
    });

    this.logger.log(
      `🔐 Credential created: user=${userId} type=${type} name=${name}`,
    );

    return credential;
  }

  /**
   * Update an existing credential's data.
   */
  async update(
    userId: string,
    credentialId: string,
    data: Record<string, unknown>,
  ) {
    const existing = await this.prisma.userCredential.findFirst({
      where: { id: credentialId, userId },
    });
    if (!existing) throw new NotFoundException('Credential not found');

    const encrypted = this.crypto.encryptJson(data);

    return this.prisma.userCredential.update({
      where: { id: credentialId },
      data: {
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      },
      select: { id: true, name: true, type: true, updatedAt: true },
    });
  }

  /**
   * List all credentials for a user (masked, no decrypted data).
   */
  async findAll(userId: string) {
    return this.prisma.userCredential.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get credential types that a user has configured.
   */
  async getConfiguredTypes(userId: string): Promise<string[]> {
    const credentials = await this.prisma.userCredential.findMany({
      where: { userId },
      select: { type: true },
      distinct: ['type'],
    });
    return credentials.map((c) => c.type);
  }

  /**
   * Check if a user has a credential of a specific type.
   */
  async hasCredential(userId: string, type: string): Promise<boolean> {
    const count = await this.prisma.userCredential.count({
      where: { userId, type },
    });
    return count > 0;
  }

  /**
   * Delete a credential.
   */
  async delete(userId: string, credentialId: string) {
    const credential = await this.prisma.userCredential.findFirst({
      where: { id: credentialId, userId },
    });
    if (!credential) throw new NotFoundException('Credential not found');

    await this.prisma.userCredential.delete({ where: { id: credentialId } });

    this.logger.log(
      `🗑️ Credential deleted: user=${userId} type=${credential.type} name=${credential.name}`,
    );

    return { deleted: true };
  }

  /**
   * Internal: Decrypt credential for n8n worker (just-in-time delivery).
   * @param userId User whose credential to fetch
   * @param type Credential type (e.g., "telegram", "openai")
   * @param name Optional credential name (for multiple of same type)
   */
  async decryptForWorker(
    userId: string,
    type: string,
    name?: string,
  ): Promise<Record<string, unknown> | null> {
    const where: any = { userId, type };
    if (name) where.name = name;

    const credential = await this.prisma.userCredential.findFirst({
      where,
    });
    if (!credential) return null;

    this.logger.log(
      `🔓 Credential decrypted for worker: user=${userId} type=${type}`,
    );

    return this.crypto.decryptJson({
      encryptedData: credential.encryptedData,
      iv: credential.iv,
      authTag: credential.authTag,
    });
  }
}

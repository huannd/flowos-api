import { Module } from '@nestjs/common';
import { CredentialController } from './credential.controller';
import { InternalCredentialController } from './internal/internal-credential.controller';
import { CredentialService } from './credential.service';
import { PrismaService } from '../../core/database/prisma.service';
import { CryptoService } from '../../core/security/crypto.service';

@Module({
  controllers: [CredentialController, InternalCredentialController],
  providers: [CredentialService, PrismaService, CryptoService],
  exports: [CredentialService],
})
export class CredentialModule {}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
  Post,
} from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAdminService } from './supabase-admin';
import { UserId } from './user.decorator';
import {
  currentBusinessId,
  currentUserEmail,
  currentUserName,
  requireRole,
  tenantStore,
} from './tenant-context';

class BootstrapDto {
  @IsString()
  @IsNotEmpty({ message: 'Please enter your full name.' })
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Please enter a name for this workspace.' })
  @MaxLength(120)
  businessName!: string;

  @IsOptional()
  @IsIn(['PERSONAL', 'BUSINESS'], {
    message: 'Choose a personal or business workspace.',
  })
  kind?: 'PERSONAL' | 'BUSINESS';
}

class UpdateBusinessDto {
  @IsString()
  @IsNotEmpty({ message: 'Please enter a workspace name.' })
  @MaxLength(120)
  name!: string;
}

/**
 * Runs right after sign-up: creates the user's Profile and their first workspace, with an OWNER
 * membership, exactly once. Everything else in the API scopes to a workspace the user is an active
 * member of, so there is no way to read or write another tenant's data.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: SupabaseAdminService,
  ) {}

  /** The signed-in user, every workspace they belong to, and the active one. */
  @Get('me')
  @ApiOkResponse({ description: 'The signed-in user and their workspaces' })
  async me(@UserId() userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });
    const memberships = await this.prisma.organisationMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        workspace: {
          select: { id: true, name: true, currency: true, kind: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const activeId = tenantStore()?.workspaceId;
    const active =
      memberships.find((m) => m.workspaceId === activeId) ?? memberships[0];
    return {
      userId,
      email: currentUserEmail(),
      fullName: profile?.fullName ?? currentUserName(),
      business: active
        ? {
            id: active.workspace.id,
            name: active.workspace.name,
            currency: active.workspace.currency,
            kind: active.workspace.kind,
          }
        : null,
      role: active?.role ?? null,
      workspaces: memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        currency: m.workspace.currency,
        kind: m.workspace.kind,
        role: m.role,
        membershipId: m.id,
      })),
    };
  }

  /** First sign-up: create the profile and first workspace. Safe to call again (idempotent). */
  @Post('bootstrap')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Creates the profile and workspace on first run' })
  async bootstrap(@UserId() userId: string, @Body() dto: BootstrapDto) {
    const fullName = dto.fullName.trim();
    const workspaceName = dto.businessName.trim();

    const existing = await this.prisma.organisationMembership.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return {
        userId,
        fullName: existing.workspace.name ? fullName : fullName,
        business: {
          id: existing.workspace.id,
          name: existing.workspace.name,
          currency: existing.workspace.currency,
          kind: existing.workspace.kind,
        },
        role: existing.role,
        workspaces: [
          {
            id: existing.workspace.id,
            name: existing.workspace.name,
            currency: existing.workspace.currency,
            kind: existing.workspace.kind,
            role: existing.role,
            membershipId: existing.id,
          },
        ],
      };
    }

    await this.prisma.profile.upsert({
      where: { userId },
      update: { fullName },
      create: { userId, fullName },
    });

    const workspace = await this.prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: { ownerId: userId, name: workspaceName, kind: dto.kind ?? 'BUSINESS' },
      });
      await tx.organisationMembership.create({
        data: {
          workspaceId: created.id,
          userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });
      return created;
    });

    return {
      userId,
      fullName,
      business: {
        id: workspace.id,
        name: workspace.name,
        currency: workspace.currency,
        kind: workspace.kind,
      },
      role: 'OWNER' as const,
      workspaces: [
        {
          id: workspace.id,
          name: workspace.name,
          currency: workspace.currency,
          kind: workspace.kind,
          role: 'OWNER' as const,
          membershipId: null,
        },
      ],
    };
  }

  /**
   * Renames the workspace the request is acting on. The workspace id comes from the verified
   * membership, never from the browser, so one user can never rename another user's workspace.
   */
  @Patch('business')
  @ApiOkResponse({ description: 'The updated workspace' })
  async updateBusiness(@Body() dto: UpdateBusinessDto) {
    requireRole('OWNER', 'MANAGER');
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Please enter a workspace name.');
    const id = currentBusinessId();
    const { count } = await this.prisma.business.updateMany({
      where: { id },
      data: { name },
    });
    if (count === 0)
      throw new NotFoundException(
        'We could not find your workspace. Finish setting it up first.',
      );
    const workspace = await this.prisma.business.findUniqueOrThrow({
      where: { id },
    });
    return {
      business: {
        id: workspace.id,
        name: workspace.name,
        currency: workspace.currency,
        kind: workspace.kind,
      },
    };
  }

  /**
   * Deletes the signed-in user's account: removes every workspace they own (children first, in one
   * transaction), their memberships elsewhere, and then the Supabase auth user. Idempotent — an
   * already-deleted user is a success.
   */
  @Delete('account')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Deletes the account and all of its data' })
  async deleteAccount(@UserId() userId: string) {
    const owned = await this.prisma.business.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (owned.length > 0) {
      await this.prisma.$transaction(
        async (tx) => {
          for (const { id: workspaceId } of owned) {
            // Transactions go first: a confirmed CSV match stores a Transaction that references its
            // ImportedTransaction with onDelete: Restrict.
            await tx.notificationLog.deleteMany({ where: { workspaceId } });
            await tx.reminder.deleteMany({ where: { debt: { workspaceId } } });
            await tx.paymentRequest.deleteMany({
              where: { debt: { workspaceId } },
            });
            await tx.recoveryActivity.deleteMany({
              where: { debt: { workspaceId } },
            });
            await tx.supportingDocument.deleteMany({ where: { workspaceId } });
            await tx.debtRepayment.deleteMany({
              where: { debt: { workspaceId } },
            });
            await tx.debt.deleteMany({ where: { workspaceId } });

            await tx.transaction.deleteMany({ where: { businessId: workspaceId } });
            await tx.importedTransaction.deleteMany({
              where: { import: { businessId: workspaceId } },
            });
            await tx.reconciliationImport.deleteMany({
              where: { businessId: workspaceId },
            });
            await tx.invoicePayment.deleteMany({
              where: { invoice: { businessId: workspaceId } },
            });
            await tx.invoiceItem.deleteMany({
              where: { invoice: { businessId: workspaceId } },
            });
            await tx.invoice.deleteMany({ where: { businessId: workspaceId } });
            await tx.customer.deleteMany({ where: { businessId: workspaceId } });
            await tx.auditEvent.deleteMany({ where: { businessId: workspaceId } });
            await tx.organisationMembership.deleteMany({ where: { workspaceId } });
            await tx.business.delete({ where: { id: workspaceId } });
          }
        },
        { timeout: 60_000, maxWait: 20_000 },
      );
    }
    // Memberships in workspaces they do not own are removed too; the workspace itself stays.
    await this.prisma.organisationMembership.deleteMany({ where: { userId } });
    await this.prisma.profile.deleteMany({ where: { userId } });
    // Delete the auth user last so, if this fails, they can still sign in and retry.
    await this.admin.deleteUser(userId);
    return { status: 'deleted' };
  }
}

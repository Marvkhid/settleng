import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAdminService } from './supabase-admin';
import { UserId } from './user.decorator';
import { currentUserName } from './tenant-context';

class BootstrapDto {
  @IsString()
  @IsNotEmpty({ message: 'Please enter your full name.' })
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Please enter your business name.' })
  @MaxLength(120)
  businessName!: string;
}

/**
 * Runs right after sign-up: creates the user's Profile and their Business (owned by their Supabase
 * user id) exactly once. Everything else in the API scopes to that business, so there is no way to
 * read or write another tenant's data.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: SupabaseAdminService,
  ) {}

  /** Who am I: the signed-in user's name and business, or nulls before onboarding. */
  @Get('me')
  @ApiOkResponse({ description: 'The signed-in user and their business' })
  async me(@UserId() userId: string) {
    const [profile, business] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.business.findUnique({ where: { ownerId: userId } }),
    ]);
    return {
      userId,
      fullName: profile?.fullName ?? currentUserName(),
      business: business
        ? { id: business.id, name: business.name, currency: business.currency }
        : null,
    };
  }

  /** First sign-up: create the profile and business. Safe to call again (idempotent). */
  @Post('bootstrap')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Creates the profile and business on first run',
  })
  async bootstrap(@UserId() userId: string, @Body() dto: BootstrapDto) {
    const fullName = dto.fullName.trim();
    const businessName = dto.businessName.trim();
    await this.prisma.profile.upsert({
      where: { userId },
      update: { fullName },
      create: { userId, fullName },
    });
    const business = await this.prisma.business.upsert({
      where: { ownerId: userId },
      update: {},
      create: { ownerId: userId, name: businessName },
    });
    return {
      userId,
      fullName,
      business: {
        id: business.id,
        name: business.name,
        currency: business.currency,
      },
    };
  }

  /**
   * Deletes the signed-in user's account: removes their business data (children first, in one
   * transaction) and then the Supabase auth user. Idempotent — an already-deleted user is a success.
   */
  @Delete('account')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Deletes the account and all of its data' })
  async deleteAccount(@UserId() userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (business) {
      const businessId = business.id;
      await this.prisma.$transaction(
        async (tx) => {
          // Children first: ImportedTransaction references invoices/transactions, so clear links
          // before deleting the rows they point at.
          await tx.importedTransaction.deleteMany({ where: { import: { businessId } } });
          await tx.reconciliationImport.deleteMany({ where: { businessId } });
          await tx.transaction.deleteMany({ where: { businessId } });
          await tx.invoicePayment.deleteMany({ where: { invoice: { businessId } } });
          await tx.invoiceItem.deleteMany({ where: { invoice: { businessId } } });
          await tx.invoice.deleteMany({ where: { businessId } });
          await tx.customer.deleteMany({ where: { businessId } });
          await tx.auditEvent.deleteMany({ where: { businessId } });
          await tx.business.delete({ where: { id: businessId } });
        },
        { timeout: 60_000, maxWait: 20_000 },
      );
    }
    await this.prisma.profile.deleteMany({ where: { userId } });
    // Delete the auth user last so, if this fails, they can still sign in and retry.
    await this.admin.deleteUser(userId);
    return { status: 'deleted' };
  }
}

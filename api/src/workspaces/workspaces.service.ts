import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  currentUserId,
  type MemberRole,
} from '../auth/tenant-context';
import type {
  ChangeRoleDto,
  CreateWorkspaceDto,
  InviteMemberDto,
  RenameWorkspaceDto,
} from './workspace.dto';

export interface WorkspaceSummary {
  id: string;
  name: string;
  kind: 'PERSONAL' | 'BUSINESS';
  currency: string;
  role: MemberRole;
  memberCount: number;
}

/**
 * Workspaces and their members. Every method re-checks the caller's membership of the workspace it
 * touches, using the path id — the active workspace in the request is not enough, because a user may
 * belong to several and the path could name a different one.
 */
@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(workspaceId: string, roles?: MemberRole[]) {
    const membership = await this.prisma.organisationMembership.findFirst({
      where: { workspaceId, userId: currentUserId(), status: 'ACTIVE' },
      include: { workspace: true },
    });
    if (!membership)
      throw new NotFoundException('We could not find that workspace.');
    if (roles && !roles.includes(membership.role as MemberRole))
      throw new ForbiddenException(
        roles.includes('MANAGER')
          ? 'Only a workspace owner or manager can do that.'
          : 'Only a workspace owner can do that.',
      );
    return membership;
  }

  async list(): Promise<{ items: WorkspaceSummary[] }> {
    const rows = await this.prisma.organisationMembership.findMany({
      where: { userId: currentUserId(), status: 'ACTIVE' },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            kind: true,
            currency: true,
            _count: { select: { memberships: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      items: rows.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        kind: m.workspace.kind as 'PERSONAL' | 'BUSINESS',
        currency: m.workspace.currency,
        role: m.role as MemberRole,
        memberCount: m.workspace._count.memberships,
      })),
    };
  }

  async create(dto: CreateWorkspaceDto): Promise<WorkspaceSummary> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Please enter a name.');
    const workspace = await this.prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: { ownerId: currentUserId(), name, kind: dto.kind ?? 'BUSINESS' },
      });
      await tx.organisationMembership.create({
        data: {
          workspaceId: created.id,
          userId: currentUserId(),
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });
      return created;
    });
    return {
      id: workspace.id,
      name: workspace.name,
      kind: workspace.kind as 'PERSONAL' | 'BUSINESS',
      currency: workspace.currency,
      role: 'OWNER',
      memberCount: 1,
    };
  }

  async rename(id: string, dto: RenameWorkspaceDto) {
    await this.requireMembership(id, ['OWNER', 'MANAGER']);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Please enter a name.');
    const workspace = await this.prisma.business.update({
      where: { id },
      data: { name },
    });
    return { id: workspace.id, name: workspace.name, kind: workspace.kind };
  }

  async members(id: string) {
    await this.requireMembership(id);
    const rows = await this.prisma.organisationMembership.findMany({
      where: { workspaceId: id, status: { not: 'REMOVED' } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      items: rows.map((m) => ({
        id: m.id,
        role: m.role,
        status: m.status,
        email: m.invitedEmail,
        userId: m.userId,
        joinedAt: m.status === 'ACTIVE' ? m.createdAt.toISOString() : null,
      })),
    };
  }

  async invite(id: string, dto: InviteMemberDto) {
    await this.requireMembership(id, ['OWNER']);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.organisationMembership.findFirst({
      where: { workspaceId: id, invitedEmail: email, status: { not: 'REMOVED' } },
    });
    if (existing)
      throw new ConflictException(`${email} is already invited to this workspace.`);
    const row = await this.prisma.organisationMembership.create({
      data: { workspaceId: id, invitedEmail: email, role: dto.role, status: 'INVITED' },
    });
    return { id: row.id, email: row.invitedEmail, role: row.role, status: row.status };
  }

  async changeRole(id: string, memberId: string, dto: ChangeRoleDto) {
    await this.requireMembership(id, ['OWNER']);
    const target = await this.prisma.organisationMembership.findFirst({
      where: { id: memberId, workspaceId: id, status: { not: 'REMOVED' } },
    });
    if (!target) throw new NotFoundException('We could not find that member.');
    if (target.role === 'OWNER')
      throw new ConflictException('The workspace owner keeps the owner role.');
    const updated = await this.prisma.organisationMembership.update({
      where: { id: memberId },
      data: { role: dto.role },
    });
    return { id: updated.id, role: updated.role };
  }

  async remove(id: string, memberId: string) {
    const me = await this.requireMembership(id);
    const target = await this.prisma.organisationMembership.findFirst({
      where: { id: memberId, workspaceId: id, status: { not: 'REMOVED' } },
    });
    if (!target) throw new NotFoundException('We could not find that member.');
    if (target.role === 'OWNER')
      throw new ConflictException('The workspace owner cannot be removed.');
    const membership = await this.requireMembership(id, ['OWNER']);
    void membership;
    if (target.userId === me.userId)
      throw new ConflictException('You cannot remove yourself.');
    await this.prisma.organisationMembership.update({
      where: { id: memberId },
      data: { status: 'REMOVED' },
    });
    return { status: 'removed' };
  }
}

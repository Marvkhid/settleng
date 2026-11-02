import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  ChangeRoleDto,
  CreateWorkspaceDto,
  InviteMemberDto,
  RenameWorkspaceDto,
} from './workspace.dto';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@Controller('workspaces')
@UseGuards(RolesGuard)
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get() list() {
    return this.workspaces.list();
  }

  @Post() create(@Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(dto);
  }

  @Patch(':id') rename(@Param('id') id: string, @Body() dto: RenameWorkspaceDto) {
    return this.workspaces.rename(id, dto);
  }

  @Get(':id/members') members(@Param('id') id: string) {
    return this.workspaces.members(id);
  }

  @Post(':id/members') @Roles('OWNER') invite(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspaces.invite(id, dto);
  }

  @Patch(':id/members/:memberId') @Roles('OWNER') changeRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.workspaces.changeRole(id, memberId, dto);
  }

  @Delete(':id/members/:memberId') @Roles('OWNER') remove(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.workspaces.remove(id, memberId);
  }
}

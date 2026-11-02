import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, RolesGuard],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}

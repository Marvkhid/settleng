import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DemoService } from './demo.service';

@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get('workspace')
  @ApiOkResponse({
    description: 'Demo business info and the sample-data notice',
  })
  workspace() {
    return this.demo.workspace();
  }

  @Post('reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Restores the original sample data' })
  reset() {
    return this.demo.reset();
  }
}

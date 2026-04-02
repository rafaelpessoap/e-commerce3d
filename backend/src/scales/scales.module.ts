import { Module } from '@nestjs/common';
import { ScalesService } from './scales.service';

@Module({
  providers: [ScalesService],
  exports: [ScalesService],
})
export class ScalesModule {}

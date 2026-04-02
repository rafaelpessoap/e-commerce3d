import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { SearchService } from './search.service';
import { SearchIndexer } from './search.indexer';
import { SearchController } from './search.controller';

@Module({
  imports: [ConfigModule],
  controllers: [SearchController],
  providers: [
    {
      provide: 'ELASTICSEARCH_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Client({
          node:
            configService.get<string>('ELASTICSEARCH_URL') ??
            'http://localhost:9200',
        });
      },
    },
    SearchService,
    SearchIndexer,
  ],
  exports: [SearchService, SearchIndexer],
})
export class SearchModule {}

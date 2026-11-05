import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TeacherAuthGuard } from '../auth/teacher-auth.guard';
import { ContentService } from './content.service';
import { CreateWordPairDto, ListWordPairsQueryDto, UpdateWordPairDto } from './dto/word-pair.dto';
import type { CategorySummary, MediaAssetView, WordPairListResult, WordPairRecord } from './content.types';

@UseGuards(TeacherAuthGuard)
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('word-pairs')
  list(@Query() query: ListWordPairsQueryDto): Promise<WordPairListResult> {
    return this.content.list(query);
  }

  @Get('word-pairs/:id')
  get(@Param('id') id: string): Promise<WordPairRecord> {
    return this.content.getById(id);
  }

  @Post('word-pairs')
  create(@Body() dto: CreateWordPairDto): Promise<WordPairRecord> {
    return this.content.create(dto);
  }

  @Patch('word-pairs/:id')
  update(@Param('id') id: string, @Body() dto: UpdateWordPairDto): Promise<WordPairRecord> {
    return this.content.update(id, dto);
  }

  @Delete('word-pairs/:id')
  remove(@Param('id') id: string): Promise<{ ok: true }> {
    return this.content.softDelete(id);
  }

  @Get('categories')
  categories(): Promise<CategorySummary[]> {
    return this.content.categories();
  }

  @Get('media')
  media(): Promise<MediaAssetView[]> {
    return this.content.media();
  }
}

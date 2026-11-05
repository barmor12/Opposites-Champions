import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { JoinRoomResponse, RoomPublicView } from '@oc/shared';
import { RoomsService } from './rooms.service';
import { JoinRoomDto } from './dto/join-room.dto';
import { GameError } from '../games/game-error';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  /** הצטרפות תלמיד – מוגבל ל־20 בקשות לדקה לכל כתובת IP */
  @Post('join')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  join(@Body() dto: JoinRoomDto): Promise<JoinRoomResponse> {
    return this.rooms.join(dto.code, dto.displayName, dto.avatar);
  }

  @Get(':code')
  getRoom(@Param('code') code: string): Promise<RoomPublicView> {
    if (!/^\d{6}$/.test(code)) throw GameError.badRequest('INVALID_CODE', 'קוד החדר חייב להכיל 6 ספרות');
    return this.rooms.getPublicView(code);
  }
}

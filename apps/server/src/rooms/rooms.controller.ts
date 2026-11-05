import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { JoinRoomResponse, RoomPublicView } from '@oc/shared';
import { RoomsService } from './rooms.service';
import { JoinRoomDto } from './dto/join-room.dto';
import { GameError } from '../games/game-error';

export const JOIN_RATE_LIMIT_PER_MINUTE = 60;
export const ROOM_LOOKUP_RATE_LIMIT_PER_MINUTE = 60;

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  /**
   * הצטרפות תלמיד – מוגבל ל־60 בקשות לדקה לכל כתובת IP (נאכף ע"י ה־ThrottlerGuard הגלובלי של האפליקציה).
   * כיתה שלמה מאחורי NAT אחד מצטרפת בתוך דקה, ולכן המגבלה אינה נמוכה יותר; nginx מגביל בנוסף.
   */
  @Post('join')
  @HttpCode(200)
  @Throttle({ default: { limit: JOIN_RATE_LIMIT_PER_MINUTE, ttl: 60_000 } })
  join(@Body() dto: JoinRoomDto): Promise<JoinRoomResponse> {
    return this.rooms.join(dto.code, dto.displayName, dto.avatar);
  }

  /** תצוגה ציבורית (ללא שמות) – מוגבל לכל IP כדי להקשות על ניחוש קודים (6 ספרות, תוקף 24 שעות) */
  @Get(':code')
  @Throttle({ default: { limit: ROOM_LOOKUP_RATE_LIMIT_PER_MINUTE, ttl: 60_000 } })
  getRoom(@Param('code') code: string): Promise<RoomPublicView> {
    if (!/^\d{6}$/.test(code)) throw GameError.badRequest('INVALID_CODE', 'קוֹד הַחֶדֶר חַיָּיב לְהָכִיל 6 סְפָרוֹת');
    return this.rooms.getPublicView(code);
  }
}

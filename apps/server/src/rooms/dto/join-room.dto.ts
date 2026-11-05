import { IsIn, IsString, Length, Matches } from 'class-validator';
import { AVATARS, MAX_DISPLAY_NAME, MIN_DISPLAY_NAME, type AvatarId, type JoinRoomRequest } from '@oc/shared';

export class JoinRoomDto implements JoinRoomRequest {
  @IsString({ message: 'קוד החדר חייב להיות מחרוזת' })
  @Matches(/^\d{6}$/, { message: 'קוד החדר חייב להכיל 6 ספרות' })
  code!: string;

  @IsString({ message: 'יש להזין שם' })
  @Length(MIN_DISPLAY_NAME, MAX_DISPLAY_NAME * 2, { message: 'אורך השם אינו תקין' })
  displayName!: string;

  @IsIn(AVATARS, { message: 'יש לבחור דמות מהרשימה' })
  avatar!: AvatarId;
}

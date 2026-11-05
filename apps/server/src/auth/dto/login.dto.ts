import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'כתובת האימייל אינה תקינה' })
  @MaxLength(254, { message: 'כתובת האימייל ארוכה מדי' })
  email!: string;

  @IsString({ message: 'יש להזין סיסמה' })
  @MinLength(1, { message: 'יש להזין סיסמה' })
  @MaxLength(256, { message: 'הסיסמה ארוכה מדי' })
  password!: string;
}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TeacherAuthGuard } from './teacher-auth.guard';
import { TEACHER_SESSION_EXPIRES_IN } from './auth.constants';

/**
 * Teacher authentication. Exports JwtModule + TeacherAuthGuard so feature modules
 * can `@UseGuards(TeacherAuthGuard)` after importing AuthModule.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: TEACHER_SESSION_EXPIRES_IN, algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TeacherAuthGuard],
  exports: [JwtModule, AuthService, TeacherAuthGuard],
})
export class AuthModule {}

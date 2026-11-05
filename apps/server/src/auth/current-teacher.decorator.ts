import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TeacherProfile } from '@oc/shared';
import type { RequestWithTeacher } from './teacher-auth.guard';

export const CurrentTeacher = createParamDecorator((_data: unknown, ctx: ExecutionContext): TeacherProfile => {
  const req = ctx.switchToHttp().getRequest<RequestWithTeacher>();
  if (!req.teacher) throw new Error('CurrentTeacher used without TeacherAuthGuard');
  return req.teacher;
});

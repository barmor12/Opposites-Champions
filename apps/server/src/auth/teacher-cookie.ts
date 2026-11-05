import type { JwtService } from '@nestjs/jwt';
import { TEACHER_COOKIE, type TeacherJwtPayload } from './teacher-auth.guard';
import { CSRF_HEADER_VALUE, TEACHER_SESSION_TTL_SEC } from './auth.constants';

/** Parses a raw `Cookie` header into a key → value map (first occurrence wins). */
export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    if (!name || name in out) continue;
    let value = part.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/**
 * Extracts and verifies the teacher JWT from a raw Cookie header.
 * Intended for the Socket.IO handshake, where express cookie-parser is not available.
 */
export async function extractTeacherFromCookieHeader(
  cookieHeader: string | undefined,
  jwt: JwtService,
): Promise<TeacherJwtPayload | null> {
  const token = parseCookieHeader(cookieHeader)[TEACHER_COOKIE];
  if (!token) return null;
  try {
    const payload = await jwt.verifyAsync<TeacherJwtPayload>(token);
    if (typeof payload?.sub !== 'string' || payload.sub.length === 0) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface TeacherCookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
  maxAge: number;
}

/** Cookie options for `oc_teacher`; `maxAge` is in milliseconds (express). */
export function teacherCookieOptions(isProd: boolean): TeacherCookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: TEACHER_SESSION_TTL_SEC * 1000 };
}

export function hasCsrfHeader(headerValue: string | undefined): boolean {
  return headerValue === CSRF_HEADER_VALUE;
}

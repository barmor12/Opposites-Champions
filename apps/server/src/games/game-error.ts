import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * שגיאת משחק: שומרת על מבנה השגיאה הסטנדרטי של NestJS ({ statusCode, message, error })
 * כאשר `error` נושא קוד מכונה (למשל ALREADY_ANSWERED) שמשמש גם ב־ack של Socket.IO.
 */
export class GameError extends HttpException {
  readonly code: string;

  constructor(status: HttpStatus, code: string, message: string) {
    super({ statusCode: status, message, error: code }, status);
    this.code = code;
  }

  static badRequest(code: string, message: string): GameError {
    return new GameError(HttpStatus.BAD_REQUEST, code, message);
  }
  static forbidden(code: string, message: string): GameError {
    return new GameError(HttpStatus.FORBIDDEN, code, message);
  }
  static notFound(code: string, message: string): GameError {
    return new GameError(HttpStatus.NOT_FOUND, code, message);
  }
  static conflict(code: string, message: string): GameError {
    return new GameError(HttpStatus.CONFLICT, code, message);
  }
}

/** ממיר שגיאה כלשהי ל־{ code, message } עבור ack של socket */
export function toSocketError(err: unknown): { code: string; message: string } {
  if (err instanceof GameError) return { code: err.code, message: extractMessage(err.getResponse()) };
  if (err instanceof HttpException) {
    const res = err.getResponse();
    const code = typeof res === 'object' && res !== null && 'error' in res && typeof (res as { error?: unknown }).error === 'string'
      ? (res as { error: string }).error
      : `HTTP_${err.getStatus()}`;
    return { code, message: extractMessage(res) };
  }
  return { code: 'INTERNAL', message: 'אירעה שגיאה, נסו שוב' };
}

function extractMessage(res: string | object): string {
  if (typeof res === 'string') return res;
  const msg = (res as { message?: unknown }).message;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg.map(String).join(', ');
  return 'אירעה שגיאה';
}

import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { HE } from './hebrew-messages';

/** Global rate limiter for HTTP only (gateways handle their own limits). Hebrew error message. */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return context.getType() !== 'http';
  }

  protected override async getErrorMessage(): Promise<string> {
    return HE.tooManyRequests;
  }
}

/** User-facing messages never expose transport errors, HTML or server traces. */
export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (/network|fetch|connection|offline|timed?\s*out|abort/i.test(message)) return 'Connection interrupted. Check your internet and try again.';
  if (/401|unauthorized|token.*expired/i.test(message)) return 'Your session has expired. Please sign in again.';
  if (/403|forbidden/i.test(message)) return 'This action is not available for your account.';
  if (/429|too.many/i.test(message)) return 'A little too fast. Please wait a moment and try again.';
  if (/HTTP 5|traceback|exception|<html|<!doctype|mongodb/i.test(message)) return 'We’re taking a timeout. Please try again shortly.';
  return message && message.length < 240 ? message : fallback;
}

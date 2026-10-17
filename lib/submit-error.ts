/**
 * Message for a form submission that failed before the server answered
 * (#214), e.g. the network dropped or the server errored. Distinguishes
 * being offline so the person knows what to fix, and reassures them that
 * nothing they typed was lost.
 */
export function submitFailureMessage(online: boolean, what = "issue"): string {
  return online
    ? `Your ${what} couldn't be sent. What you typed is still here, so you can try again.`
    : `You're offline, so your ${what} hasn't been sent. Reconnect, then try again.`;
}

export function getNextActionFromTimeline(events = []) {
  const now = new Date();

  const future = events
    .filter(
      e =>
        e.type === "follow_up" &&
        e.metadata?.nextFollowUpAt
    )
    .map(e => ({
      ...e,
      next: e.metadata.nextFollowUpAt.toDate()
    }))
    .filter(e => e.next > now)
    .sort((a, b) => a.next - b.next);

  return future[0] || null;
}

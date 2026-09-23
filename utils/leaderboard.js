// utils/leaderboard.js
const PRIORITY_POINTS = { Critical: 20, High: 12, Medium: 6, Low: 3 };

function isSameMonth(ts, ref = new Date()) {
  const d = new Date(ts);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function computeLeaderboard(tickets, itStaff) {
  const closedThisMonth = tickets.filter(t => t.resolvedAt && isSameMonth(t.resolvedAt));
  const stats = itStaff.map(agent => {
    const closed = closedThisMonth.filter(t => t.assigneeId === agent.id);
    const points = closed.reduce((s, t) => s + (PRIORITY_POINTS[t.priority] || 0), 0);
    const avgHours = closed.length
      ? closed.reduce((s, t) => s + (t.resolvedAt - t.createdAt), 0) / closed.length / 3600000
      : null;
    return { agentId: agent.id, name: agent.name, closed: closed.length, points, avgResolutionHours: avgHours };
  }).sort((a, b) => b.points - a.points);

  const fastest = stats.filter(s => s.avgResolutionHours !== null).sort((a, b) => a.avgResolutionHours - b.avgResolutionHours)[0] || null;

  return stats.map((s, i) => ({
    ...s, rank: i + 1,
    badges: [
      ...(i === 0 && s.points > 0 ? ['top_closer'] : []),
      ...(fastest && s.name === fastest.name ? ['speed_wizard'] : [])
    ]
  }));
}

module.exports = { PRIORITY_POINTS, isSameMonth, computeLeaderboard };

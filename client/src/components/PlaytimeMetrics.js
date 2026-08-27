import './PlaytimeMetrics.css';

const toHours = value => Number(value || 0);

function PlaytimeMetrics({ game }) {
  const totalHours = toHours(game.playtime_hours);
  const recentHours = toHours(game.playtime_2weeks_hours);

  return (
    <div className="playtime-metrics" aria-label="Steam playtime metrics">
      <span className="playtime-pill playtime-pill--total">
        {totalHours > 0 ? `🎮 ${totalHours.toFixed(1)} hrs total` : '🆕 Never Played'}
      </span>
      {recentHours > 0 && (
        <span className="playtime-pill playtime-pill--recent">🔥 {recentHours.toFixed(1)} hrs past 2 weeks</span>
      )}
    </div>
  );
}

export default PlaytimeMetrics;

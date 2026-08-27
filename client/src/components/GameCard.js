import './GameCard.css';
import PlaytimeMetrics from './PlaytimeMetrics';

function GameCard({ game }) {
  const headerImage = game.headerImage || game.image;
  const hoverImage = game.backgroundImage || game.screenshotImage || headerImage;

  return (
    <article className="game-card">
      <div className="game-card__artwork">
        <img className="game-card__image game-card__image--header" src={headerImage} alt={`Cover art for ${game.name}`} />
        <img className="game-card__image game-card__image--background" src={hoverImage} alt="" aria-hidden="true" />
      </div>

      <div className="game-card__content">
        <h2 className="game-card__title">{game.name}</h2>
        <p className="game-card__reason">{game.reason}</p>
        <PlaytimeMetrics game={game} />
      </div>
    </article>
  );
}

export default GameCard;

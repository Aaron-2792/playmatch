import './GamingLoader.css';

const controllerButtons = ['↑', 'A', 'B', 'X', '←', '↓', 'Y', '→', 'L1', 'R1', '◉', '◆', 'L2', 'R2', '●', '✦'];

function GamingLoader() {
  return (
    <section className="gaming-loader" aria-label="Finding games in your Steam library" role="status">
      <div className="gaming-loader__panel">
        <div className="gaming-loader__buttons" aria-hidden="true">
          {controllerButtons.map((label, index) => (
            <span key={`${label}-${index}`} className="controller-button" style={{ '--cascade-delay': `${index * 90}ms` }}>
              {label}
            </span>
          ))}
        </div>
        <p className="gaming-loader__label">Matching your next great session</p>
      </div>
    </section>
  );
}

export default GamingLoader;

import React, { useEffect, useState, useMemo } from 'react';
import './RouletteWheel.css';

const COLORS = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FF8F33', '#33FFF5',
  '#8D33FF', '#FF3333', '#33FF8F', '#3380FF'
];

const RouletteWheel = ({ isSpinning, games, targetGame, spinKey }) => {
  const [spinDegrees, setSpinDegrees] = useState(0);

  // --- 1. PREPARE SLICES ---
  // We want exactly 10 slices. 
  // Slice 0 will be our TARGET (Winner). 
  // The rest are random fillers.
  const visualGames = useMemo(() => {
    const totalSlices = 10;
    const fillers = [];

    // Create 9 random fillers
    for (let i = 0; i < totalSlices - 1; i++) {
      // If we have real user games, pick one random
      if (games && games.length > 0) {
        fillers.push(games[Math.floor(Math.random() * games.length)]);
      } else {
        // Fallback if we don't have the user's full library loaded
        fillers.push({ name: '???' });
      }
    }

    // If we have a target winner, put it at Index 0.
    // If not (still loading), put a placeholder at Index 0.
    const winnerSlice = targetGame ? targetGame : { name: 'WINNER' };

    return [winnerSlice, ...fillers];
  }, [targetGame, games]); // Recalculate only when target changes

  const sliceSize = 360 / visualGames.length;

  // --- 2. SPIN LOGIC ---
  useEffect(() => {
    if (isSpinning && targetGame) {
      // MATH: How to land on Index 0?
      // Index 0 is at 0 degrees (top).
      // To land there, we just need full rotations (360 * X).
      // We add a tiny random offset (-10 to +10) to make it look "real" but still inside the slice.

      const fullSpins = 360 * 10; // 10 full spins
      const randomOffset = Math.floor(Math.random() * 20) - 10; // +/- 10 deg variance

      // Since Index 0 is at the top, we just rotate 360s.
      // NOTE: If we wanted to land on Index 3, we would subtract (3 * sliceSize).
      const targetRotation = fullSpins + randomOffset;

      setSpinDegrees(targetRotation);
    } else if (isSpinning && !targetGame) {
      // If spinning but waiting for API, just do a generic endless spin visual?
      // Actually, simplified: we just wait for targetGame to trigger the main spin.
      setSpinDegrees(360 * 20); // Spin lots while waiting
    } else {
      setSpinDegrees(0);
    }
  }, [isSpinning, targetGame, spinKey]);

  // Generate Gradient
  const gradientString = visualGames.map((_, index) => {
    const start = index * sliceSize;
    const end = (index + 1) * sliceSize;
    const color = COLORS[index % COLORS.length];
    return `${color} ${start}deg ${end}deg`;
  }).join(', ');

  return (
    <div className="roulette-container">
      <div className="roulette-pointer">▼</div>

      <div
        className={`roulette-wheel ${isSpinning ? 'spinning' : ''}`}
        style={{
          background: `conic-gradient(${gradientString})`,
          '--spin-degrees': `${spinDegrees}deg`,
          // IMPORTANT: Reset animation when spinKey changes
          transition: isSpinning ? 'transform 4s cubic-bezier(0.1, 0, 0.1, 1)' : 'none'
        }}
      >
        {visualGames.map((game, index) => {
          // Calculate center of slice
          // Fix: Subtract 90 degrees because CSS rotation starts at 3 o'clock, 
          // but our gradient starts at 12 o'clock.
          const centerAngle = (index * sliceSize) + (sliceSize / 2) - 90;

          return (
            <div
              key={index}
              className="wheel-spoke"
              style={{ transform: `rotate(${centerAngle}deg)` }}
            >
              <span className="text-inner" style={{ fontSize: '0.7rem' }}>
                {game ? game.name : '???'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RouletteWheel;
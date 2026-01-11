import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './SteamStats.css';

const SteamStats = ({ stats, onClose }) => {
    if (!stats) return null;

    // Data for "Pile of Shame" Donut Chart
    const playData = [
        { name: 'Played', value: stats.playedCount },
        { name: 'Unplayed', value: stats.unplayedCount },
    ];
    const COLORS = ['#00d4ff', '#ff5500']; // Neon Blue & Orange

    return (
        <div className="stats-overlay">
            <div className="stats-card">
                <button className="exit-btn-top-right" onClick={onClose}>✕</button>

                <h2>🎮 Profile DNA</h2>

                <div className="stats-header">
                    <div className="stat-box">
                        <h3>{stats.totalGames}</h3>
                        <p>Total Games</p>
                    </div>
                    <div className="stat-box">
                        <h3>{stats.totalPlaytime.toLocaleString()}</h3>
                        <p>Hours Played</p>
                    </div>
                </div>

                <div className="charts-container">
                    {/* CHART 1: PILE OF SHAME */}
                    <div className="chart-section">
                        <h4>Pile of Shame</h4>
                        <div className="chart-wrapper">
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={playData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {playData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="legend">
                                <span style={{ color: COLORS[0] }}>● Played</span>
                                <span style={{ color: COLORS[1] }}>● Unplayed</span>
                            </div>
                        </div>
                    </div>

                    {/* CHART 2: TOP GENRES */}
                    <div className="chart-section">
                        <h4>Top Genres</h4>
                        <div className="chart-wrapper">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={stats.genreData} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#fff', fontSize: 10 }} />
                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#1a1a1a' }} />
                                    <Bar dataKey="value" fill="#00ff88" barSize={15} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SteamStats;
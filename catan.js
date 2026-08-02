const CATAN_COLORS = {
    red: "#c94a4a",
    orange: "#d9782d",
    white: "#b5aa95",
    blue: "#3a6ea5",
    green: "#2f8a5b",
    brown: "#76523b"
};

const getCatanColor = color => CATAN_COLORS[color?.toLowerCase()] ?? color ?? "#777";

const RECENT_GAMES_WITH_FULL_WEIGHT = 5;
const OLDER_GAME_DECAY = 0.9;

const getPerformance = (score, target) => {
    const numericScore = Number(score);
    const numericTarget = Number(target);
    return Number.isFinite(numericScore) && Number.isFinite(numericTarget) && numericTarget > 0
        ? numericScore / numericTarget * 100
        : null;
};

const formatPerformance = value => {
    const rounded = Math.round(value * 10) / 10;
    return rounded.toFixed(Number.isInteger(rounded) ? 0 : 1);
};

const getCatanStats = (players, games) => {
    const stats = Object.fromEntries(players.map(player => [player.id, {
        player, games: 0, wins: 0, weightedPerformance: 0, performanceHistory: []
    }]));

    Object.keys(games).forEach(gameKey => {
        const winner = getWinner(players, gameKey);
        if (winner) stats[winner.player.id].wins += 1;
        players.forEach(player => {
            const score = Number(player.scores[gameKey]);
            if (!Number.isFinite(score)) return;
            stats[player.id].games += 1;
        });
    });

    players.forEach(player => {
        const performanceHistory = Object.entries(games)
            .filter(([gameKey]) => Number.isFinite(Number(player.scores[gameKey])))
            .sort(([keyA, gameA], [keyB, gameB]) =>
                gameA.date.localeCompare(gameB.date) || keyA.localeCompare(keyB, undefined, { numeric: true })
            )
            .map(([gameKey, game]) => ({
                date: game.date,
                value: getPerformance(player.scores[gameKey], game.target)
            }))
            .filter(entry => Number.isFinite(entry.value));
        const performances = performanceHistory.map(entry => entry.value).reverse();

        const weightedTotals = performances.reduce((totals, performance, index) => {
            const ageAfterRecentGames = Math.max(0, index - RECENT_GAMES_WITH_FULL_WEIGHT + 1);
            const weight = OLDER_GAME_DECAY ** ageAfterRecentGames;
            totals.performance += performance * weight;
            totals.weight += weight;
            return totals;
        }, { performance: 0, weight: 0 });

        stats[player.id].weightedPerformance = weightedTotals.weight > 0
            ? weightedTotals.performance / weightedTotals.weight
            : 0;
        stats[player.id].performanceHistory = performanceHistory;
    });

    return Object.values(stats).sort((a, b) =>
        b.wins - a.wins
        || b.weightedPerformance - a.weightedPerformance
        || a.player.name.localeCompare(b.player.name)
    );
};

const renderPerformanceChart = history => {
    if (!history.length) return "";

    const width = 460;
    const height = 64;
    const padding = 6;
    const maxValue = Math.max(100, ...history.map(entry => entry.value));
    const getX = index => history.length === 1
        ? width / 2
        : padding + index * (width - padding * 2) / (history.length - 1);
    const getY = value => height - padding - value / maxValue * (height - padding * 2);
    const points = history.map((entry, index) => `${getX(index).toFixed(1)},${getY(entry.value).toFixed(1)}`).join(" ");
    const chartBottom = height - padding;
    const areaPoints = `${getX(0).toFixed(1)},${chartBottom} ${points} ${getX(history.length - 1).toFixed(1)},${chartBottom}`;
    const latest = history[history.length - 1];
    const ariaLabel = `Performance history: ${history.map(entry => `${formatPerformance(entry.value)}%`).join(", ")}`;

    return `
        <div class="settler-chart">
            <div class="settler-chart-heading"><span>Performance history</span><strong>${formatPerformance(latest.value)}% latest</strong></div>
            <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}">
                <line class="settler-chart-grid" x1="${padding}" y1="${getY(maxValue / 2)}" x2="${width - padding}" y2="${getY(maxValue / 2)}"></line>
                ${history.length > 1 ? `<polygon class="settler-chart-area" points="${areaPoints}"></polygon>` : ""}
                ${history.length > 1 ? `<polyline class="settler-chart-line" points="${points}"></polyline>` : ""}
                ${history.map((entry, index) => `
                    <circle class="settler-chart-dot${index === history.length - 1 ? " is-latest" : ""}" cx="${getX(index).toFixed(1)}" cy="${getY(entry.value).toFixed(1)}" r="${index === history.length - 1 ? 3.5 : 2.5}">
                        <title>${formatDate(entry.date)}: ${formatPerformance(entry.value)}%</title>
                    </circle>
                `).join("")}
            </svg>
        </div>
    `;
};

const renderPlayerStats = stats => {
    const mostWins = Math.max(0, ...stats.map(entry => entry.wins));
    document.getElementById("catanStats").innerHTML = stats.map((entry, index) => `
        <article class="settler-card">
            <div class="settler-rank" aria-label="Rank ${index + 1}">${index + 1}</div>
            <div class="settler-identity">
                <div class="avatar">
                    <img src="${IMG("catan", entry.player.id)}" alt="${entry.player.name}">
                    ${entry.wins === mostWins && mostWins > 0 ? `
                        <svg class="settler-crown" viewBox="0 0 40 28" role="img" aria-label="Most victories">
                            <title>Most victories</title>
                            <path d="M3 6L11 14L19 3L27 14L36 6L32 23H7Z"></path>
                            <path d="M8 20H32"></path>
                        </svg>
                    ` : ""}
                </div>
                <div><span>Council member</span><h3>${entry.player.name}</h3></div>
            </div>
            <div class="settler-victories"><strong>${entry.wins}</strong><span>${entry.wins === 1 ? "victory" : "victories"}</span></div>
            ${renderPerformanceChart(entry.performanceHistory)}
            <div class="settler-details">
                <span title="Last 5 games have full weight; older games decay by 10% each"><strong>${formatPerformance(entry.weightedPerformance)}%</strong> weighted performance</span>
                <span><strong>${entry.games}</strong> games</span>
            </div>
        </article>
    `).join("");
};

const renderWinners = (players, games) => {
    const gameEntries = Object.entries(games).sort(([, a], [, b]) => b.date.localeCompare(a.date));
    document.getElementById("bestList").innerHTML = gameEntries.map(([gameKey, game]) => {
        const winner = getWinner(players, gameKey);
        return winner ? `
            <article class="best-card">
                <div class="best-photo">
                    <img src="${IMG("catan", winner.player.id)}" alt="${winner.player.name}">
                    <div class="best-year">${formatDate(game.date)}</div>
                </div>
                <div class="best-info"><span>${winner.player.name}</span></div>
            </article>
        ` : "";
    }).join("");
};

const renderCatanTable = (players, games) => {
    const gameEntries = Object.entries(games).sort(([keyA, gameA], [keyB, gameB]) =>
        gameB.date.localeCompare(gameA.date) || keyB.localeCompare(keyA, undefined, { numeric: true })
    );
    const head = `<thead><tr><th>Game</th>${players.map(player => `<th>${player.name}</th>`).join("")}</tr></thead>`;
    let previousDate = null;
    const body = gameEntries.map(([gameKey, game]) => {
        const winner = getWinner(players, gameKey);
        const dlc = Array.isArray(game.dlc) && game.dlc.length
            ? game.dlc.map(name => `<span class="table-secondary table-dlc">${name}</span>`).join("")
            : "";
        const dateRow = game.date !== previousDate
            ? `<tr class="catan-date-row"><th colspan="${players.length + 1}" scope="rowgroup">${formatDate(game.date)}</th></tr>`
            : "";
        previousDate = game.date;
        return `${dateRow}<tr>
            <td><span class="game-name">${game.name}</span>${dlc}</td>
            ${players.map(player => {
                const score = Number(player.scores[gameKey]);
                if (!Number.isFinite(score)) return "<td>—</td>";
                const color = getCatanColor(game.players?.[player.id]);
                const winnerClass = winner?.player.id === player.id ? "cell-good" : "";
                const performance = getPerformance(score, game.target);
                const performanceLabel = Number.isFinite(performance) ? `${formatPerformance(performance)}%` : "—";
                return `<td class="${winnerClass}"><span class="score-with-color" style="--player-color:${color}"><strong>${score}</strong><small>${performanceLabel}</small></span></td>`;
            }).join("")}
        </tr>`;
    }).join("");
    document.getElementById("catanTable").innerHTML = `${head}<tbody>${body}</tbody>`;
};

loadData().then(data => {
    const game = data.catan;
    const players = parsePlayers(game.players);
    document.getElementById("gameInfoLink").href = game.link;
    renderPlayerStats(getCatanStats(players, game.games));
    renderWinners(players, game.games);
    renderCatanTable(players, game.games);
}).catch(showLoadError);

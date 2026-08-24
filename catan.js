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
        const hasGameDetails = Array.isArray(game.order) && game.order.length > 0
            && Array.isArray(game.dices) && game.dices.length > 0;
        const gameName = hasGameDetails
            ? `<button class="game-name catan-details-trigger" type="button" data-catan-game="${gameKey}" aria-label="View dice and turns for ${game.name}">
                    <span>${game.name}</span><i class="catan-details-indicator" aria-hidden="true"></i>
                </button>`
            : `<span class="game-name">${game.name}</span>`;
        const dateRow = game.date !== previousDate
            ? `<tr class="catan-date-row"><th colspan="${players.length + 1}" scope="rowgroup">${formatDate(game.date)}</th></tr>`
            : "";
        previousDate = game.date;
        return `${dateRow}<tr>
            <td>${gameName}${dlc}</td>
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

const getCatanTurns = game => {
    const order = Array.isArray(game.order) ? game.order : [];
    const skipped = new Set((Array.isArray(game.skipped) ? game.skipped : []).map(Number));
    const turns = [];
    let pendingRolls = [];

    (Array.isArray(game.dices) ? game.dices : []).forEach(rawRoll => {
        const roll = Number(rawRoll);
        if (!Number.isFinite(roll)) return;

        pendingRolls.push(roll);
        if (skipped.has(roll)) return;

        const turnIndex = turns.length;
        turns.push({
            number: turnIndex + 1,
            round: Math.floor(turnIndex / order.length) + 1,
            playerId: order[turnIndex % order.length],
            rolls: pendingRolls
        });
        pendingRolls = [];
    });

    return { turns, pendingRolls, skipped };
};

const renderDiceHistogram = (game, skipped) => {
    const rolls = (Array.isArray(game.dices) ? game.dices : []).map(Number).filter(Number.isFinite);
    const counts = Object.fromEntries(Array.from({ length: 11 }, (_, index) => [index + 2, 0]));
    rolls.forEach(roll => {
        if (Object.hasOwn(counts, roll)) counts[roll] += 1;
    });
    const maxCount = Math.max(1, ...Object.values(counts));
    const chartLabel = Object.entries(counts).map(([roll, count]) => `${roll}: ${count}`).join(", ");

    return `
        <section class="catan-dialog-section">
            <div class="catan-dialog-section-heading">
                <h3>Dice histogram</h3>
                <span>All rolls, including rerolls</span>
            </div>
            <div class="dice-histogram-scroll">
                <div class="dice-histogram" role="img" aria-label="Dice roll counts. ${chartLabel}">
                    ${Object.entries(counts).map(([roll, count]) => {
                        const isSkipped = skipped.has(Number(roll));
                        return `
                            <div class="dice-histogram-column${isSkipped ? " is-rerolled" : ""}">
                                <div class="dice-histogram-track">
                                    <span class="dice-histogram-bar" style="--dice-bar-height:${count / maxCount * 100}%">
                                        ${count > 0 ? `<b>${count}</b>` : ""}
                                    </span>
                                </div>
                                <strong>${roll}</strong>
                                <small>${isSkipped ? "reroll" : ""}</small>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        </section>
    `;
};

const renderRollChain = (rolls, skipped) => rolls.map((roll, index) => `
    <span class="turn-roll${skipped.has(roll) ? " is-rerolled" : ""}" title="${skipped.has(roll) ? "Rerolled" : "Final roll"}">${roll}</span>
    ${index < rolls.length - 1 ? `<span class="turn-roll-arrow" aria-hidden="true">&#8594;</span>` : ""}
`).join("");

const renderPlayerDiceStats = (players, game, turns, skipped) => {
    const playersById = Object.fromEntries(players.map(player => [player.id, player]));
    const orderedPlayerIds = [...new Set(game.order)];

    return `
        <section class="catan-dialog-section">
            <div class="catan-dialog-section-heading">
                <h3>Rolls by player</h3>
                <span>Rerolls belong to the player whose turn it was</span>
            </div>
            <div class="player-dice-stats">
                ${orderedPlayerIds.map(playerId => {
                    const playerTurns = turns.filter(turn => turn.playerId === playerId);
                    const rolls = playerTurns.flatMap(turn => turn.rolls);
                    const rerolls = rolls.filter(roll => skipped.has(roll)).length;
                    const counts = Object.fromEntries(Array.from({ length: 11 }, (_, index) => [index + 2, 0]));
                    rolls.forEach(roll => {
                        if (Object.hasOwn(counts, roll)) counts[roll] += 1;
                    });
                    const maxCount = Math.max(1, ...Object.values(counts));
                    const playerName = playersById[playerId]?.name ?? playerId;
                    const playerColor = getCatanColor(game.players?.[playerId]);

                    return `
                        <article class="player-dice-card" style="--player-color:${playerColor}">
                            <div class="player-dice-card-header">
                                <h4><i></i>${playerName}</h4>
                                <p><strong>${playerTurns.length}</strong> turns · <strong>${rerolls}</strong> rerolls</p>
                            </div>
                            <div class="player-dice-distribution" aria-label="${playerName} dice distribution">
                                ${Object.entries(counts).map(([roll, count]) => `
                                    <span class="player-dice-column${skipped.has(Number(roll)) ? " is-rerolled" : ""}">
                                        <i><em style="--player-dice-height:${count / maxCount * 100}%">
                                            ${count > 0 ? `<b>${count}</b>` : ""}
                                        </em></i>
                                        <small>${roll}</small>
                                    </span>
                                `).join("")}
                            </div>
                        </article>
                    `;
                }).join("")}
            </div>
        </section>
    `;
};

const renderCatanGameDetails = (players, game) => {
    const playersById = Object.fromEntries(players.map(player => [player.id, player]));
    const { turns, pendingRolls, skipped } = getCatanTurns(game);
    const rerolls = (Array.isArray(game.dices) ? game.dices : []).map(Number).filter(roll => skipped.has(roll)).length;

    return `
        <div class="catan-game-summary" aria-label="Game roll summary">
            <span><strong>${game.dices.length}</strong> rolls</span>
            <span><strong>${turns.length}</strong> turns</span>
            <span><strong>${rerolls}</strong> rerolls</span>
        </div>
        ${renderDiceHistogram(game, skipped)}
        ${renderPlayerDiceStats(players, game, turns, skipped)}
        <section class="catan-dialog-section">
            <div class="catan-dialog-section-heading">
                <h3>Turn history</h3>
                <span>Skipped results do not advance the turn</span>
            </div>
            <ol class="catan-turn-list">
                ${turns.map((turn, index) => {
                    const player = playersById[turn.playerId];
                    const playerName = player?.name ?? turn.playerId;
                    const playerColor = getCatanColor(game.players?.[turn.playerId]);
                    return `
                        ${index === 0 || turn.round !== turns[index - 1].round
                            ? `<li class="turn-round-separator"><span>Round ${turn.round}</span></li>`
                            : ""}
                        <li class="catan-turn-row">
                            <span class="turn-number">#${turn.number}</span>
                            <span class="turn-player"><i style="--player-color:${playerColor}"></i>${playerName}</span>
                            <span class="turn-rolls" aria-label="Rolls: ${turn.rolls.join(", ")}">${renderRollChain(turn.rolls, skipped)}</span>
                        </li>
                    `;
                }).join("")}
                ${pendingRolls.length ? `
                    <li class="catan-turn-row is-incomplete">
                        <span class="turn-number">#${turns.length + 1}</span>
                        <span class="turn-player">Waiting for final roll</span>
                        <span class="turn-rolls">${renderRollChain(pendingRolls, skipped)}</span>
                    </li>
                ` : ""}
            </ol>
        </section>
    `;
};

const setupCatanGameDialog = (players, games) => {
    const dialog = document.getElementById("catanGameDialog");
    const content = document.getElementById("catanGameDialogContent");
    const title = document.getElementById("catanGameDialogTitle");
    const date = document.getElementById("catanGameDialogDate");
    const closeButton = dialog.querySelector(".catan-dialog-close");

    document.getElementById("catanTable").addEventListener("click", event => {
        const button = event.target.closest("[data-catan-game]");
        if (!button) return;

        const game = games[button.dataset.catanGame];
        if (!game) return;

        title.textContent = game.name;
        date.textContent = formatDate(game.date);
        content.innerHTML = renderCatanGameDetails(players, game);
        dialog.showModal();
        document.body.classList.add("has-open-dialog");
    });

    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => document.body.classList.remove("has-open-dialog"));
};

loadData().then(data => {
    const game = data.catan;
    const players = parsePlayers(game.players);
    document.getElementById("gameInfoLink").href = game.link;
    renderPlayerStats(getCatanStats(players, game.games));
    renderWinners(players, game.games);
    renderCatanTable(players, game.games);
    setupCatanGameDialog(players, game.games);
}).catch(showLoadError);

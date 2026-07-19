const getRecordedRounds = game => {
    if (game.games) return Object.keys(game.games).length;
    return getScoreKeys(parsePlayers(game.players), /^\d{4}$/).length;
};

const getGameLeader = (gameId, game) => {
    const players = parsePlayers(game.players);

    if (gameId === "catan") {
        const wins = Object.fromEntries(players.map(player => [player.id, 0]));
        Object.keys(game.games ?? {}).forEach(gameKey => {
            const winner = getWinner(players, gameKey);
            if (winner) wins[winner.player.id] += 1;
        });
        return [...players].sort((a, b) =>
            wins[b.id] - wins[a.id] || getPlayerTotal(b) - getPlayerTotal(a)
        )[0]?.name ?? "—";
    }

    return [...players].sort((a, b) => getPlayerTotal(b) - getPlayerTotal(a))[0]?.name ?? "—";
};

const renderOverviewStats = data => {
    const games = Object.values(data);
    const playerIds = new Set(games.flatMap(game => Object.keys(game.players ?? {})));
    const recordedRounds = games.reduce((total, game) => total + getRecordedRounds(game), 0);

    document.getElementById("overviewStats").innerHTML = `
        <article class="stat-card"><span class="stat-value">${games.length}</span><span class="stat-label">Games</span></article>
        <article class="stat-card"><span class="stat-value">${playerIds.size}</span><span class="stat-label">Players</span></article>
        <article class="stat-card"><span class="stat-value">${recordedRounds}</span><span class="stat-label">Recorded rounds</span></article>
    `;
};

const renderGameLinks = data => {
    const pages = { ticket_to_ride: "./ticket-to-ride.html", catan: "./catan.html" };

    document.getElementById("gamesGrid").innerHTML = Object.entries(data).map(([gameId, game]) => `
        <article class="game-card">
            <div><p class="card-kicker">Board game</p><h3>${game.name}</h3></div>
            <dl class="game-card-stats">
                <div><dt>Players</dt><dd>${Object.keys(game.players ?? {}).length}</dd></div>
                <div><dt>Rounds</dt><dd>${getRecordedRounds(game)}</dd></div>
                <div><dt>Leader</dt><dd>${getGameLeader(gameId, game)}</dd></div>
            </dl>
            <div class="game-card-actions">
                <a class="primary-link" href="${pages[gameId]}">View results <span aria-hidden="true">→</span></a>
                <a class="secondary-link" href="${game.link}" target="_blank" rel="noreferrer">BoardGameGeek ↗</a>
            </div>
        </article>
    `).join("");
};

loadData().then(data => {
    renderOverviewStats(data);
    renderGameLinks(data);
}).catch(showLoadError);

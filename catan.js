const CATAN_COLORS = {
    red: "#c94a4a",
    orange: "#d9782d",
    white: "#b5aa95",
    blue: "#3a6ea5",
    green: "#2f8a5b",
    brown: "#76523b"
};

const getCatanColor = color => CATAN_COLORS[color?.toLowerCase()] ?? color ?? "#777";

const getCatanStats = (players, games) => {
    const stats = Object.fromEntries(players.map(player => [player.id, {
        player, games: 0, wins: 0, points: 0
    }]));

    Object.keys(games).forEach(gameKey => {
        const winner = getWinner(players, gameKey);
        if (winner) stats[winner.player.id].wins += 1;
        players.forEach(player => {
            const score = Number(player.scores[gameKey]);
            if (!Number.isFinite(score)) return;
            stats[player.id].games += 1;
            stats[player.id].points += score;
        });
    });

    return Object.values(stats).sort((a, b) =>
        b.wins - a.wins || b.points - a.points || a.player.name.localeCompare(b.player.name)
    );
};

const renderPlayerStats = stats => {
    document.getElementById("catanStats").innerHTML = stats.map((entry, index) => `
        <article class="settler-card">
            <div class="settler-rank" aria-label="Rank ${index + 1}">${index + 1}</div>
            <div class="settler-identity">
                <div class="avatar"><img src="${IMG("catan", entry.player.id)}" alt="${entry.player.name}"></div>
                <div><span>Council member</span><h3>${entry.player.name}</h3></div>
            </div>
            <div class="settler-victories"><strong>${entry.wins}</strong><span>${entry.wins === 1 ? "victory" : "victories"}</span></div>
            <div class="settler-details">
                <span><strong>${entry.points}</strong> total points</span>
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
    const gameEntries = Object.entries(games).sort(([, a], [, b]) => a.date.localeCompare(b.date));
    const head = `<thead><tr><th>Game</th>${players.map(player => `<th>${player.name}</th>`).join("")}</tr></thead>`;
    const body = gameEntries.map(([gameKey, game]) => {
        const winner = getWinner(players, gameKey);
        const dlc = Array.isArray(game.dlc) && game.dlc.length
            ? `<span class="table-secondary">${game.dlc.join(", ")}</span>`
            : "";
        return `<tr>
            <td><span class="game-name">${game.name}</span><span class="table-secondary">${formatDate(game.date)}</span>${dlc}</td>
            ${players.map(player => {
                const score = Number(player.scores[gameKey]);
                if (!Number.isFinite(score)) return "<td>—</td>";
                const color = getCatanColor(game.players?.[player.id]);
                const winnerClass = winner?.player.id === player.id ? "cell-good" : "";
                return `<td class="${winnerClass}"><span class="score-with-color" style="--player-color:${color}">${score}</span></td>`;
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

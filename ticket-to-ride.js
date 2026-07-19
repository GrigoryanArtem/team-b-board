const getYears = (players, desc = false) => {
    const years = getScoreKeys(players, /^\d{4}$/);
    return years.sort((a, b) => desc ? Number(b) - Number(a) : Number(a) - Number(b));
};

const renderPlayers = players => {
    document.getElementById("playersGrid").innerHTML = players.map(player => `
        <div class="player-card" style="--accent: ${player.color}">
            <div class="avatar"><img src="${IMG(player.id)}" alt="${player.name}"></div>
            <div class="player-name">${player.name}</div>
        </div>
    `).join("");
};

const renderBest = (players, years) => {
    document.getElementById("bestList").innerHTML = years.map(year => {
        const winner = getWinner(players, year);
        return winner ? `
            <div class="best-card">
                <div class="best-photo">
                    <img src="${IMG(winner.player.id)}" alt="${winner.player.name}">
                    <div class="best-year">${year}</div>
                </div>
                <div class="best-info" style="color:${winner.player.color}">
                    <span>${winner.player.name}</span><span>${winner.score} pts</span>
                </div>
            </div>
        ` : "";
    }).join("");
};

const renderTable = (players, years) => {
    const totals = players.map(getPlayerTotal);
    const bestTotal = Math.max(...totals);
    const head = `<thead><tr><th>Year</th>${players.map(player => `<th style="color:${player.color}">${player.name}</th>`).join("")}</tr></thead>`;
    const body = years.map(year => {
        const scores = players.map(player => Number(player.scores[year])).filter(Number.isFinite);
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        return `<tr><td>${year}</td>${players.map(player => {
            const score = Number(player.scores[year]);
            if (!Number.isFinite(score)) return "<td>—</td>";
            const className = score === max ? "cell-good" : score === min ? "cell-bad" : "";
            return `<td class="${className}" style="color:${player.color}">${score}</td>`;
        }).join("")}</tr>`;
    }).join("");
    const totalRow = `<tr class="total-row"><td>Total</td>${totals.map((total, index) =>
        `<td class="${total === bestTotal ? "cell-good" : ""}" style="color:${players[index].color}">${total}</td>`
    ).join("")}</tr>`;
    document.getElementById("leaderboardTable").innerHTML = `${head}<tbody>${body}${totalRow}</tbody>`;
};

loadData().then(data => {
    const game = data.ticket_to_ride;
    const players = parsePlayers(game.players);
    document.getElementById("gameInfoLink").href = game.link;
    renderPlayers(players);
    renderBest(players, getYears(players, true));
    renderTable(players, getYears(players));
}).catch(showLoadError);

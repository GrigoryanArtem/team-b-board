const DATA_URL = "./leaderboard.json";
const IMG = id => `./resources/${id}.png`;

const loadData = async () => (await fetch(DATA_URL)).json();

const parsePlayers = (raw) => Object.entries(raw).map(([key, obj]) => {
    const { name, color, ...data } = obj;
    return {
        id: key.replace(/[^a-z0-9]/gi, "").toLowerCase(),
        name: name ?? key,
        color: color ?? "#999",
        data
    };
});

const getYears = (players, desc = false) => {
    const years = [...new Set(players.flatMap(p => Object.keys(p.data).filter(y => /^\d{4}$/.test(y))))];
    return years.sort((a, b) => desc ? b - a : a - b);
};

const renderPlayers = (players) => {
    document.getElementById("playersGrid").innerHTML = players.map(p => `
        <div class="player-card" style="--accent: ${p.color}">
            <div class="avatar"><img src="${IMG(p.id)}" alt="${p.name}"></div>
            <div class="player-name">${p.name}</div>
        </div>
    `).join("");
};

const renderBest = (players, years) => {
    document.getElementById("bestList").innerHTML = years.map(year => {
        const best = players.reduce((prev, curr) => {
            const val = Number(curr.data[year]);
            return (Number.isFinite(val) && (!prev || val > prev.score)) ? { p: curr, score: val } : prev;
        }, null);

        return best ? `
            <div class="best-card">
                <div class="best-photo">
                    <img src="${IMG(best.p.id)}" alt="${best.p.name}">
                    <div class="best-year">${year}</div>
                </div>
                <div class="best-info" style="color:${best.p.color}">
                    <span>${best.p.name}</span>
                    <span>${best.score} pts</span>
                </div>
            </div>
        ` : "";
    }).join("");
};

const renderTable = (players, years) => {
    const table = document.getElementById("leaderboardTable");
    const totals = players.map(p => Object.values(p.data).map(Number).filter(Number.isFinite).reduce((a, b) => a + b, 0));
    const bestTotal = Math.max(...totals);

    const head = `<thead><tr><th>Year</th>${players.map(p => `<th style="color:${p.color}">${p.name}</th>`).join("")}</tr></thead>`;

    const body = years.map(year => {
        const scores = players.map(p => Number(p.data[year])).filter(Number.isFinite);
        const [max, min] = [Math.max(...scores), Math.min(...scores)];

        return `<tr><td>${year}</td>${players.map(p => {
            const v = Number(p.data[year]);
            if (!Number.isFinite(v)) return `<td>—</td>`;
            const cls = v === max ? "cell-good" : v === min ? "cell-bad" : "";
            return `<td class="${cls}" style="color:${p.color}">${v}</td>`;
        }).join("")}</tr>`;
    }).join("");

    const totalRow = `<tr class="total-row"><td>TOTAL</td>${totals.map((t, i) =>
        `<td class="${t === bestTotal ? 'cell-good' : ''}" style="color:${players[i].color}">${t}</td>`
    ).join("")}</tr>`;

    table.innerHTML = `${head}<tbody>${body}${totalRow}</tbody>`;
};

(async () => {
    const data = await loadData();
    const players = parsePlayers(data.ticket_to_ride.players);
    renderPlayers(players);
    renderBest(players, getYears(players, true));
    renderTable(players, getYears(players));
})();

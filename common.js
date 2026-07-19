const DATA_URL = "./leaderboard.json";
const IMG = (gameId, playerId) => `./resources/${gameId}/${playerId.replace(/[^a-z0-9]/gi, "").toLowerCase()}.png`;

const loadData = async () => {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Could not load leaderboard data (${response.status})`);
    return response.json();
};

const parsePlayers = raw => Object.entries(raw).map(([id, player]) => {
    const { name, color, ...scores } = player;
    return { id, name: name ?? id, color: color ?? "#777", scores };
});

const getScoreKeys = (players, pattern) => [...new Set(
    players.flatMap(player => Object.keys(player.scores).filter(key => pattern.test(key)))
)];

const getPlayerTotal = player => Object.values(player.scores)
    .map(Number)
    .filter(Number.isFinite)
    .reduce((total, score) => total + score, 0);

const getWinner = (players, scoreKey) => players.reduce((winner, player) => {
    const score = Number(player.scores[scoreKey]);
    if (!Number.isFinite(score)) return winner;
    return !winner || score > winner.score ? { player, score } : winner;
}, null);

const formatDate = value => new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
});

const showLoadError = error => {
    console.error(error);
    const container = document.querySelector("main");
    if (container) container.innerHTML = `<p class="load-error">Could not load leaderboard data.</p>`;
};

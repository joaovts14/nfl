/* Front-end completo */
const API_BASE = "/api/picks";
let currentWeek = 1;
let currentUser = null;
const pending = {};

function selectUser(user) {
  currentUser = user;
  document.getElementById("userSelect").style.display = "none";
  document.getElementById("mainApp").style.display = "block";
  document.getElementById("whoTag").textContent = `• Usuário: ${currentUser}`;
  loadData();
}

async function loadData() {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${currentWeek}`;
    const res = await fetch(url);
    const data = await res.json();

    document.getElementById("weekLabel").firstChild.textContent = `Semana ${currentWeek} `;
    const container = document.getElementById("scoreboard");
    container.innerHTML = "";

    data.events.forEach(event => {
      const comp = event.competitions[0];
      const teams = comp.competitors.sort((a, b) => a.homeAway === "home" ? 1 : -1);

      const game = document.createElement("div");
      game.className = "game-card";
      game.dataset.gameId = event.id;

      game.innerHTML = `
        <div class="teams">
          <div class="team home">
            <img src="${teams[0].team.logo}" alt="${teams[0].team.displayName}">
            <span class="team-name">${teams[0].team.displayName}</span>
            <span class="score">${teams[0].score || "-"}</span>
          </div>
          <div style="margin: 0 10px;">@</div>
          <div class="team away" style="text-align:right; justify-content: flex-end;">
            <span class="score">${teams[1].score || "-"}</span>
            <span class="team-name">${teams[1].team.displayName}</span>
            <img src="${teams[1].team.logo}" alt="${teams[1].team.displayName}">
          </div>
        </div>
        <div class="status">${comp.status?.type?.detail || ""}</div>
        <div class="choose-winner">
          <button onclick="setWinner('${event.id}', '${teams[0].team.displayName}', this)">${teams[0].team.abbreviation}</button>
          <div class="draw-btn"><button onclick="setDraw('${event.id}', this)">Empate</button></div>
          <button onclick="setWinner('${event.id}', '${teams[1].team.displayName}', this)">${teams[1].team.abbreviation}</button>
        </div>
      `;

      container.appendChild(game);
    });
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    document.getElementById("scoreboard").innerHTML = "<p>Não foi possível carregar os dados.</p>";
  }
}

function highlight(card, mode) {
  const teams = card.querySelectorAll(".team");
  teams.forEach(t => t.classList.remove("winner", "draw"));
  if (mode === "draw") {
    teams.forEach(t => t.classList.add("draw"));
  } else if (mode === "home") {
    teams[0].classList.add("winner");
  } else if (mode === "away") {
    teams[1].classList.add("winner");
  }
}

async function savePick(gameId, pick) {
  const body = { week: currentWeek, gameId, user: currentUser, pick };
  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log("✅ salvo:", body);
    if (pending[currentWeek] && pending[currentWeek][gameId]) {
      delete pending[currentWeek][gameId];
    }
  } catch (e) {
    console.warn("⚠️ falhou salvar, guardando localmente…", e);
    if (!pending[currentWeek]) pending[currentWeek] = {};
    pending[currentWeek][gameId] = { pick, user: currentUser };
  }
}

function setWinner(gameId, teamName, btn) {
  const card = btn.closest(".game-card");
  const isHome = card.querySelector(".home .team-name").textContent === teamName;
  highlight(card, isHome ? "home" : "away");
  savePick(gameId, teamName);
}

function setDraw(gameId, btn) {
  const card = btn.closest(".game-card");
  highlight(card, "draw");
  savePick(gameId, "Empate");
}

document.getElementById("prevWeek").addEventListener("click", () => {
  if (currentWeek > 1) { currentWeek--; loadData(); }
});
document.getElementById("nextWeek").addEventListener("click", () => {
  currentWeek++; loadData();
});
document.getElementById("save").addEventListener("click", async () => {
  const pack = pending[currentWeek] || {};
  const entries = Object.entries(pack);
  if (!entries.length) {
    console.log("Nada a salvar. 👍");
    return;
  }
  const payload = entries.map(([gameId, v]) => ({
    week: currentWeek, gameId, user: currentUser, pick: v.pick
  }));
  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log("💾 lote salvo:", JSON.stringify(payload, null, 2));
    delete pending[currentWeek];
  } catch (e) {
    console.error("Falha salvando lote:", e);
  }
});

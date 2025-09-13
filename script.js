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
  const btns = card.querySelectorAll('.choose-winner button');
  btns.forEach(b=>b.classList.remove('selected'));
  (isHome ? btns[0] : btns[btns.length-1])?.classList.add('selected');
  savePick(gameId, teamName);
}

function setDraw(gameId, btn) {
  const card = btn.closest(".game-card");
  highlight(card, "draw");
  const btns = card.querySelectorAll('.choose-winner button');
  btns.forEach(b=>b.classList.remove('selected'));
  card.querySelector('.draw-btn button')?.classList.add('selected');
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

// === Ver salvos: busca no backend e imprime no console ===

async function viewSaved() {
  if (!currentUser) {
    console.warn("Nenhum usuário selecionado.");
    return;
  }
  try {
    const url = `${API_BASE}?week=${encodeURIComponent(currentWeek)}&user=${encodeURIComponent(currentUser)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    applySavedPicks(data);
  } catch (e) {
    console.error("Falha ao buscar salvos:", e);
  }
}

/**
 * Aplica picks salvos nos cards da UI.
 * Estratégias de compatibilidade:
 *  1) Radios com name="pick-<game_id>" e value="<pick>"
 *  2) Botões/opções dentro de um card com [data-game-id="<game_id>"] e [data-value="<pick>"]
 *  3) Atualiza memória local 'pending[currentWeek]' se existir
 */
function applySavedPicks(rows) {
  if (!Array.isArray(rows)) return;
  if (!pending[currentWeek]) pending[currentWeek] = {};

  rows.forEach(row => {
    const gameId = String(row.game_id);
    const pick = String(row.pick);

    // 1) radios
    let radio = document.querySelector(`input[type="radio"][name="pick-${CSS.escape(gameId)}"][value="${CSS.escape(pick)}"]`);
    if (radio) {
      radio.checked = true;
      // dispare change para outros handlers existentes
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // 2) elementos clicáveis com data-value
      const opt = document.querySelector(`[data-game-id="${CSS.escape(gameId)}"] [data-value="${CSS.escape(pick)}"]`);
      if (opt) {
        // marca visualmente
        opt.classList.add("selected");
        // desmarca irmãos se for toggle
        const sibs = opt.parentElement?.querySelectorAll('[data-value]');
        if (sibs) sibs.forEach(el => { if (el !== opt) el.classList.remove("selected"); });
      } else {
        console.warn("Não encontrei controles para game_id:", gameId);
      }
    }

    // 3) memória local
    pending[currentWeek][gameId] = pick;
  });
}


document.getElementById("viewSaved")?.addEventListener("click", viewSaved);


function applySavedPicks(rows) {
  if (!Array.isArray(rows)) return;
  if (!pending[currentWeek]) pending[currentWeek] = {};

  rows.forEach(row => {
    const gameId = String(row.game_id);
    const pick = String(row.pick);
    const card = document.querySelector(`.game-card[data-game-id="${CSS.escape(gameId)}"]`);
    if (!card) {
      console.warn("Não encontrei card para game_id:", gameId);
      return;
    }

    const homeName = card.querySelector(".home .team-name")?.textContent?.trim();
    const awayName = card.querySelector(".away .team-name")?.textContent?.trim();
    const homeBtn = card.querySelector(".choose-winner button:nth-child(1)");
    const drawBtn = card.querySelector(".choose-winner .draw-btn button");
    const awayBtn = card.querySelector(".choose-winner button:last-child");

    // limpeza visual
    [homeBtn, drawBtn, awayBtn].forEach(b => b && b.classList.remove("selected"));

    if (pick.toLowerCase() === "empate" || pick.toLowerCase() === "draw") {
      highlight(card, "draw");
      drawBtn && drawBtn.classList.add("selected");
      pending[currentWeek][gameId] = { pick: "Empate", user: currentUser };
    } else if (homeName && pick === homeName) {
      highlight(card, "home");
      homeBtn && homeBtn.classList.add("selected");
      pending[currentWeek][gameId] = { pick: homeName, user: currentUser };
    } else if (awayName && pick === awayName) {
      highlight(card, "away");
      awayBtn && awayBtn.classList.add("selected");
      pending[currentWeek][gameId] = { pick: awayName, user: currentUser };
    } else {
      // fallback: tenta por abreviação nos botões
      if (homeBtn && homeBtn.textContent.trim() === pick) {
        highlight(card, "home");
        homeBtn.classList.add("selected");
        pending[currentWeek][gameId] = { pick: homeName || pick, user: currentUser };
      } else if (awayBtn && awayBtn.textContent.trim() === pick) {
        highlight(card, "away");
        awayBtn.classList.add("selected");
        pending[currentWeek][gameId] = { pick: awayName || pick, user: currentUser };
      } else {
        console.warn("Pick não corresponde a nomes/abrev. deste card:", gameId, pick, {homeName, awayName});
      }
    }
  });
}


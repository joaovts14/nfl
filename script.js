/* Front-end completo */
const API_BASE = "/api/picks";
let currentWeek = 1;
let currentUser = null;
const pending = {};
function resetPendingAll(){ for (const k in pending) delete pending[k]; }

function selectUser(user) {
  currentUser = user;
  document.getElementById("userSelect").style.display = "none";
  document.getElementById("mainApp").style.display = "block";
  document.getElementById("whoTag").textContent = `• Usuário: ${currentUser}`;
  resetPendingAll();
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
      // se jogo finalizado, adicionar classe finished
      if (comp.status?.type?.state === 'post') { game.classList.add('finished'); }
      game.dataset.gameId = event.id;
      const st = comp?.status?.type || {};
      const isFinal = !!(st.completed || st.state === 'post' || /final/i.test(st.description||'') || /final/i.test(st.detail||''));
      if (isFinal) game.classList.add('finished');

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

    // Após renderizar os cards, buscar e aplicar palpites salvos automaticamente
    await fetchSavedAndApply();
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
  evaluateCard(card);
}

function setDraw(gameId, btn) {
  const card = btn.closest(".game-card");
  highlight(card, "draw");
  const btns = card.querySelectorAll('.choose-winner button');
  btns.forEach(b=>b.classList.remove('selected'));
  card.querySelector('.draw-btn button')?.classList.add('selected');
  savePick(gameId, "Empate");
  evaluateCard(card);

}
document.getElementById("prevWeek").addEventListener("click", () => {
  if (currentWeek > 1) { currentWeek--; pending[currentWeek] = {}; loadData(); }
});
document.getElementById("nextWeek").addEventListener("click", () => {
  currentWeek++; pending[currentWeek] = {}; loadData();
});

/**
 * Aplica picks salvos nos cards da UI.
 * Estratégias de compatibilidade:
 *  1) Radios com name="pick-<game_id>" e value="<pick>"
 *  2) Botões/opções dentro de um card com [data-game-id="<game_id>"] e [data-value="<pick>"]
 *  3) Atualiza memória local 'pending[currentWeek]' se existir
 */

async function applySavedPicks(rows) {
  if (!Array.isArray(rows)) return;

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
    const awayBtn = card.querySelector(".choose-winner").children[2];

    // limpeza visual
    [homeBtn, drawBtn, awayBtn].forEach(b => b && b.classList.remove("selected"));

    if (pick.toLowerCase() === "empate" || pick.toLowerCase() === "draw") {
      highlight(card, "draw");
      drawBtn && drawBtn.classList.add("selected");
    } else if (homeName && pick === homeName) {
      highlight(card, "home");
      homeBtn && homeBtn.classList.add("selected");
    } else if (awayName && pick === awayName) {
      highlight(card, "away");
      awayBtn && awayBtn.classList.add("selected");
    } else {
      // fallback: tenta por abreviação nos botões
      if (homeBtn && homeBtn.textContent.trim() === pick) {
        highlight(card, "home");
        homeBtn.classList.add("selected");
      } else if (awayBtn && awayBtn.textContent.trim() === pick) {
        highlight(card, "away");
        awayBtn.classList.add("selected");
      } else {
        console.warn("Pick não corresponde a nomes/abrev. deste card:", gameId, pick, {homeName, awayName});
      }
    }
  });
}



async function fetchSavedAndApply() {
  if (!currentUser) return;
  try {
    const url = `${API_BASE}?week=${encodeURIComponent(currentWeek)}&user=${encodeURIComponent(currentUser)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    await applySavedPicks(data);
    await evaluateAll();
  } catch (e) {
    console.error("Falha ao buscar/aplicar palpites salvos:", e);
  }
}

// Voltar para tela inicial
document.getElementById("backHome")?.addEventListener("click", () => {
  document.getElementById("mainApp").style.display = "none";
  document.getElementById("userSelect").style.display = "block";
  resetPendingAll();
  currentUser = null;
});

function evaluateCard(card) {
  if (!card || !card.classList.contains("finished")) return;

  const homeName = card.querySelector(".home .team-name")?.textContent?.trim();
  const awayName = card.querySelector(".away .team-name")?.textContent?.trim();
  const hs = parseInt(card.querySelector(".home .score")?.textContent || "-1", 10);
  const as = parseInt(card.querySelector(".away .score")?.textContent || "-1", 10);

  let actual = null;
  if (!Number.isNaN(hs) && !Number.isNaN(as)) {
    if (hs === as) actual = "Empate";
    else actual = (hs > as) ? homeName : awayName;
  }

  // qual pick o usuário escolheu?
  let picked = null;
  const homeBtn = card.querySelector(".choose-winner button:nth-child(1)");
  const drawBtn = card.querySelector(".choose-winner .draw-btn button");
  const awayBtn = card.querySelector(".choose-winner").children[2];

  if (drawBtn && drawBtn.classList.contains("selected")) picked = "Empate";
  else if (homeBtn && homeBtn.classList.contains("selected")) picked = homeName;
  else if (awayBtn && awayBtn.classList.contains("selected")) picked = awayName;

  // limpa classes
  card.classList.remove("correct", "wrong");

  // só colore se temos resultado e pick
  if (actual && picked) {
    if (picked === actual) card.classList.add("correct");
    else card.classList.add("wrong");
  }
}

async function evaluateAll() {
  document.querySelectorAll(".game-card").forEach(evaluateCard);
}

async function buildScoreboard() {
  try {
    document.getElementById("scoreWeek").textContent = String(currentWeek);

    // 1) Resultados finais (ESPN)
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${currentWeek}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const resultMap = new Map(); // gameId -> "Empate" | teamName
    (data.events || []).forEach(event => {
      const comp = event.competitions?.[0];
      if (!comp) return;
      const teams = (comp.competitors || []).sort((a,b)=> a.homeAway === "home" ? 1 : -1);
      const hs = parseInt(teams?.[0]?.score || "-1", 10);
      const as = parseInt(teams?.[1]?.score || "-1", 10);
      const st = comp?.status?.type || {};
      const isFinal = !!(st.completed || st.state === "post" || /final/i.test(st.description||"") || /final/i.test(st.detail||""));

      if (isFinal && !Number.isNaN(hs) && !Number.isNaN(as)) {
        let actual = null;
        if (hs === as) actual = "Empate";
        else actual = (hs > as) ? teams?.[0]?.team?.displayName : teams?.[1]?.team?.displayName;
        if (actual) resultMap.set(String(event.id), actual);
      }
    });

    // 2) Picks da semana (todos usuários)
    const res2 = await fetch(`${API_BASE}?week=${encodeURIComponent(currentWeek)}`);
    if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
    const rows = await res2.json(); // [{week, game_id, user, pick, ...}]

    // 3) Pontuação (1 ponto por acerto)
    const scores = new Map(); // user -> pts
    (rows || []).forEach(r => {
      const actual = resultMap.get(String(r.game_id));
      if (!scores.has(r.user)) scores.set(r.user, 0);
      if (actual && r.pick === actual) {
        scores.set(r.user, scores.get(r.user) + 1);
      }
    });

    const arr = Array.from(scores.entries()).map(([user, pts]) => ({ user, pts }));
    arr.sort((a,b)=> b.pts - a.pts || a.user.localeCompare(b.user));

    const parts = [];
    parts.push(`<table style="width:100%;border-collapse:collapse;">`);
    parts.push(`<thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #333;">Jogador</th><th style="text-align:right;padding:8px;border-bottom:1px solid #333;">Pontos</th></tr></thead><tbody>`);
    if (arr.length === 0) {
      parts.push('<tr><td colspan="2" style="padding:12px;text-align:center;opacity:.8;">Sem jogos finalizados ou palpites nesta semana.</td></tr>');
    } else {
      arr.forEach(({user, pts}) => {
        parts.push(`<tr><td style="padding:8px;border-bottom:1px solid #222;">${user}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #222;">${pts}</td></tr>`);
      });
    }
    parts.push(`</tbody></table>`);
    document.getElementById("scoreContent").innerHTML = parts.join("");

  } catch (e) {
    console.error("Falha ao montar placar:", e);
    document.getElementById("scoreContent").innerHTML = `<p style="text-align:center;color:#f66;">Erro ao carregar placar.</p>`;
  }
}

async function openScores() {
  await buildScoreboard();
  const sb = document.getElementById("scoreboard");
  const sv = document.getElementById("scoreView");
  if (sb && sv) { sb.style.display = "none"; sv.style.display = "block"; }
}
function closeScores() {
  const sb = document.getElementById("scoreboard");
  const sv = document.getElementById("scoreView");
  if (sb && sv) { sv.style.display = "none"; sb.style.display = "block"; }
}


document.getElementById("openScores")?.addEventListener("click", openScores);
document.getElementById("backToGames")?.addEventListener("click", closeScores);

async function fetchWeekResults(week) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
  const data = await res.json();
  const map = new Map(); // gameId -> "Empate" | teamName
  (data.events || []).forEach(event => {
    const comp = event.competitions?.[0];
    if (!comp) return;
    const teams = (comp.competitors || []).sort((a,b)=> a.homeAway === "home" ? 1 : -1);
    const hs = parseInt(teams?.[0]?.score || "-1", 10);
    const as = parseInt(teams?.[1]?.score || "-1", 10);
    const st = comp?.status?.type || {};
    const isFinal = !!(st.completed || st.state === "post" || /final/i.test(st.description||"") || /final/i.test(st.detail||""));
    if (isFinal && !Number.isNaN(hs) && !Number.isNaN(as)) {
      let actual = null;
      if (hs === as) actual = "Empate";
      else actual = (hs > as) ? teams?.[0]?.team?.displayName : teams?.[1]?.team?.displayName;
      if (actual) map.set(String(event.id), actual);
    }
  });
  return map;
}

async function fetchWeekPicks(week) {
  const res = await fetch(`${API_BASE}?week=${encodeURIComponent(week)}`);
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  return await res.json(); // [{week, game_id, user, pick,...}]
}

async function buildGlobalScoreboard() {
  try {
    // Range de semanas (regular + possivel pós-temporada). Ajuste se necessário.
    const WEEKS = Array.from({length: 22}, (_,i)=> i+1);
    const scores = new Map(); // user -> pts

    for (const w of WEEKS) {
      // Busca picks da semana w
      let rows = [];
      try {
        rows = await fetchWeekPicks(w);
      } catch (e) {
        // Se a API retornar 400 para semanas sem dados, apenas continue
        continue;
      }
      if (!rows || rows.length === 0) continue;

      // Mapa de resultados finais para a semana w
      const resultMap = await fetchWeekResults(w);

      // Acumula
      rows.forEach(r => {
        const actual = resultMap.get(String(r.game_id));
        if (!scores.has(r.user)) scores.set(r.user, 0);
        if (actual && r.pick === actual) {
          scores.set(r.user, scores.get(r.user) + 1);
        }
      });
    }

    // Render
    const arr = Array.from(scores.entries()).map(([user, pts]) => ({ user, pts }));
    arr.sort((a,b)=> b.pts - a.pts || a.user.localeCompare(b.user));

    const parts = [];
    parts.push(`<table style="width:100%;border-collapse:collapse;">`);
    parts.push(`<thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #333;">Jogador</th><th style="text-align:right;padding:8px;border-bottom:1px solid #333;">Total</th></tr></thead><tbody>`);
    if (arr.length === 0) {
      parts.push('<tr><td colspan="2" style="padding:12px;text-align:center;opacity:.8;">Sem dados para calcular o placar geral.</td></tr>');
    } else {
      arr.forEach(({user, pts}) => {
        parts.push(`<tr><td style="padding:8px;border-bottom:1px solid #222;">${user}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #222;">${pts}</td></tr>`);
      });
    }
    parts.push(`</tbody></table>`);
    document.getElementById("globalScoreContent").innerHTML = parts.join("");

  } catch (e) {
    console.error("Falha ao montar placar geral:", e);
    document.getElementById("globalScoreContent").innerHTML = `<p style="text-align:center;color:#f66;">Erro ao carregar placar geral.</p>`;
  }
}

async function openGlobalScores() {
  await buildGlobalScoreboard();
  // esconder telas
  document.getElementById("userSelect").style.display = "none";
  const sv = document.getElementById("globalScoreView");
  if (sv) sv.style.display = "block";
}
function backToHome() {
  const sv = document.getElementById("globalScoreView");
  if (sv) sv.style.display = "none";
  document.getElementById("userSelect").style.display = "block";
}


document.getElementById("openGlobalScores")?.addEventListener("click", openGlobalScores);
document.getElementById("backToHome")?.addEventListener("click", backToHome);

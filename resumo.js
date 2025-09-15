/* Resumo de Divergências por Jogo */
const API_BASE = "/api/picks";

function weeksRange(max=22){ return Array.from({length:max}, (_,i)=> i+1); }

async function fetchWeekPicks(week){
  const res = await fetch(`${API_BASE}?week=${encodeURIComponent(week)}`);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json(); // rows: [{week, game_id, user_name, pick, updated_at}]
}

async function fetchEspnWeek(week){
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error(`ESPN ${res.status}`);
  const data = await res.json();

  const map = new Map(); // gameId -> { status: "final"|"in_progress"|"scheduled", winner: "Empate"|teamName|null }
  (data.events || []).forEach(ev => {
    const comp = ev.competitions?.[0];
    const statusType = comp?.status?.type?.name || "";
    const isFinal = statusType.toLowerCase().includes("final");
    const home = comp?.competitors?.find(c=>c.homeAway==="home");
    const away = comp?.competitors?.find(c=>c.homeAway==="away");
    const sh = Number(home?.score ?? 0);
    const sa = Number(away?.score ?? 0);
    let winner = null;
    if (isFinal) {
      if (sh === sa) winner = "Empate";
      else winner = sh > sa ? home?.team?.displayName : away?.team?.displayName;
    }
    const gid = String(ev.id);
    map.set(gid, { status: isFinal ? "final" : statusType ? "in_progress" : "scheduled", winner });
  });
  return map;
}

function onlyDivergences(rows){
  // agrupar por game_id e manter apenas onde há picks diferentes entre os três
  const byGame = new Map();
  for(const r of rows){
    const gid = r.game_id || r.gameId || r.gameid;
    const uname = r.user_name || r.user || r.username;
    const pick = r.pick;
    if(!byGame.has(gid)) byGame.set(gid, { game_id: gid, picks: {} });
    byGame.get(gid).picks[uname] = pick;
  }
  return Array.from(byGame.values()).filter(g => {
    const vals = Object.values(g.picks);
    if (vals.length <= 1) return false;
    return new Set(vals).size >= 2; // divergência
  });
}

function winnersList(game, resultsMap){
  const r = resultsMap.get(String(game.game_id));
  if(!r || r.status !== "final" || !r.winner) return { status: r?.status ?? "scheduled", winner: null, list: [] };

  const list = [];
  for(const [name, pick] of Object.entries(game.picks)){
    if (pick && pick === r.winner) list.push(name);
  }
  return { status: "final", winner: r.winner, list };
}

function rowEl(game, resultsMap){
  const wrap = document.createElement("div");
  wrap.className = "game-row";
  const gid = document.createElement("div");
  gid.innerHTML = `<span class="pill">${game.game_id}</span>`;

  const leone = document.createElement("div");
  const rafael = document.createElement("div");
  const joao  = document.createElement("div");
  leone.textContent = game.picks["Leone"] ?? "—";
  rafael.textContent = game.picks["Rafael"] ?? "—";
  joao.textContent   = game.picks["João"] ?? "—";

  const status = document.createElement("div");
  const winner = document.createElement("div");
  const acertou = document.createElement("div");

  const info = winnersList(game, resultsMap);
  if (info.status === "final"){
    status.innerHTML = `<span class="final">Final</span>`;
    winner.textContent = info.winner ?? "—";
    if (info.list.length === 0){
      acertou.innerHTML = `<span class="warn">Ninguém</span>`;
    } else {
      acertou.innerHTML = info.list.map(n => `<span class="ok">${n}</span>`).join(" ");
    }
  } else if (info.status === "in_progress"){
    status.innerHTML = `<span class="pending">Em andamento</span>`;
    winner.textContent = "—";
    acertou.textContent = "—";
  } else {
    status.textContent = "Agendado";
    winner.textContent = "—";
    acertou.textContent = "—";
  }

  wrap.append(gid, leone, rafael, joao, status, winner, acertou);
  return wrap;
}

function weekBlockEl(week, games, resultsMap){
  const block = document.createElement("div");
  block.className = "week-block";
  const title = document.createElement("div");
  title.className = "week-title";
  title.textContent = `Semana ${week}`;
  block.appendChild(title);

  if(games.length === 0){
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Nenhuma divergência nesta semana.";
    block.appendChild(empty);
    return block;
  }

  const head = document.createElement("div");
  head.className = "game-head";
  head.innerHTML = `<div>Jogo (game_id)</div><div>Leone</div><div>Rafael</div><div>João</div><div>Status</div><div>Vencedor</div><div>Acertou</div>`;
  block.appendChild(head);

  const gamesBox = document.createElement("div");
  gamesBox.className = "games";
  games.forEach(g => gamesBox.appendChild(rowEl(g, resultsMap)));
  block.appendChild(gamesBox);
  return block;
}

async function render(){
  const content = document.getElementById("content");
  content.innerHTML = "";
  const sel = document.getElementById("weekSelect");
  const val = sel.value;

  if(val === "all"){
    for(const w of weeksRange(22)){
      try{
        const [rows, resultsMap] = await Promise.all([fetchWeekPicks(w), fetchEspnWeek(w)]);
        const games = onlyDivergences(rows);
        content.appendChild(weekBlockEl(w, games, resultsMap));
      }catch(e){
        const err = document.createElement("div");
        err.className = "week-block";
        err.innerHTML = `<div class="week-title">Semana ${w}</div><div class="game-row empty">Erro ao carregar: ${e.message}</div>`;
        content.appendChild(err);
      }
    }
  } else {
    const w = Number(val);
    try{
      const [rows, resultsMap] = await Promise.all([fetchWeekPicks(w), fetchEspnWeek(w)]);
      const games = onlyDivergences(rows);
      content.appendChild(weekBlockEl(w, games, resultsMap));
    }catch(e){
      const err = document.createElement("div");
      err.className = "week-block";
      err.innerHTML = `<div class="week-title">Semana ${w}</div><div class="game-row empty">Erro ao carregar: ${e.message}</div>`;
      content.appendChild(err);
    }
  }
}

function populateWeeks(){
  const sel = document.getElementById("weekSelect");
  weeksRange(22).forEach(w => {
    const opt = document.createElement("option");
    opt.value = String(w);
    opt.textContent = String(w);
    sel.appendChild(opt);
  });
}

document.getElementById("reload")?.addEventListener("click", render);
document.addEventListener("DOMContentLoaded", () => {
  populateWeeks();
  render();
});

/* Apostas por Jogo */
const API_BASE = "/api/picks";

function weeksRange(max=22){ return Array.from({length:max}, (_,i)=> i+1); }

async function fetchWeek(week){
  const res = await fetch(`${API_BASE}?week=${encodeURIComponent(week)}`);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json(); // rows: [{week, game_id, user_name, pick, updated_at}]
}

function groupByGame(rows){
  const map = new Map(); // game_id -> { game_id, picks: {Leone, Rafael, João} }
  for(const r of rows){
    const gid = r.game_id || r.gameId || r.gameid;
    if(!map.has(gid)) map.set(gid, { game_id: gid, picks: { "Leone": null, "Rafael": null, "João": null } });
    const entry = map.get(gid);
    const uname = r.user_name || r.user || r.username;
    if (uname in entry.picks){
      entry.picks[uname] = r.pick;
    } else {
      // Caso apareça outro usuário, guardamos genericamente
      entry.picks[uname] = r.pick;
    }
  }
  return Array.from(map.values());
}

function gameRowEl(game){
  const wrapper = document.createElement("div");
  wrapper.className = "game-row";
  const gid = document.createElement("div");
  gid.innerHTML = `<span class="pill">${game.game_id}</span>`;
  const leone = document.createElement("div");
  const rafael = document.createElement("div");
  const joao = document.createElement("div");

  const get = (n)=> game.picks[n] ?? null;
  leone.textContent = get("Leone") ?? "—";
  rafael.textContent = get("Rafael") ?? "—";
  joao.textContent  = get("João") ?? "—";

  wrapper.append(gid, leone, rafael, joao);
  return wrapper;
}

function weekBlockEl(week, grouped){
  const block = document.createElement("div");
  block.className = "week-block";

  const title = document.createElement("div");
  title.className = "week-title";
  title.textContent = `Semana ${week}`;
  block.appendChild(title);

  const head = document.createElement("div");
  head.className = "game-head";
  head.innerHTML = `<div>Jogo (game_id)</div><div>Leone</div><div>Rafael</div><div>João</div>`;
  block.appendChild(head);

  const games = document.createElement("div");
  games.className = "games";

  if(grouped.length === 0){
    const empty = document.createElement("div");
    empty.className = "game-row empty";
    empty.textContent = "Nenhuma aposta registrada nesta semana.";
    games.appendChild(empty);
  } else {
    grouped.forEach(g => games.appendChild(gameRowEl(g)));
  }

  block.appendChild(games);
  return block;
}

async function render(){
  const content = document.getElementById("content");
  content.innerHTML = "";
  const sel = document.getElementById("weekSelect");
  const val = sel.value;

  if(val === "all"){
    // Carregar todas
    for(const w of weeksRange(22)){
      try{
        const rows = await fetchWeek(w);
        const grouped = groupByGame(rows);
        content.appendChild(weekBlockEl(w, grouped));
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
      const rows = await fetchWeek(w);
      const grouped = groupByGame(rows);
      content.appendChild(weekBlockEl(w, grouped));
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

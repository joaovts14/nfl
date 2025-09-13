const userSelect = document.getElementById("userSelect");
const weekSelect = document.getElementById("weekSelect");
const gamesContainer = document.getElementById("gamesContainer");

(function fillWeeks(){
  for(let w=1; w<=18; w++){
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = "Semana " + w;
    weekSelect.appendChild(opt);
  }
  weekSelect.value = "1";
})();

function mockGames(week){
  return [
    { id: `2025-REG-${week}-ARI@BUF`, home:"Bills", away:"Cardinals" },
    { id: `2025-REG-${week}-MIA@NYJ`, home:"Jets", away:"Dolphins" }
  ];
}

function renderGames(games){
  gamesContainer.innerHTML = "";
  games.forEach(g=>{
    const card=document.createElement("div");
    card.className="game-card";
    card.setAttribute("data-match-id",g.id);
    const teams=document.createElement("div");
    teams.className="teams";
    const awayBtn=document.createElement("button");
    awayBtn.className="team-btn";awayBtn.textContent=g.away;awayBtn.dataset.teamId=g.away;
    const homeBtn=document.createElement("button");
    homeBtn.className="team-btn";homeBtn.textContent=g.home;homeBtn.dataset.teamId=g.home;
    teams.appendChild(awayBtn);teams.appendChild(homeBtn);
    card.appendChild(document.createTextNode(g.id));
    card.appendChild(teams);
    gamesContainer.appendChild(card);
  });
}

async function restorePicks(){
  const user_name=userSelect.value;
  const week=weekSelect.value;
  renderGames(mockGames(week));
  try{
    const res=await fetch(`/api/picks?user_name=${encodeURIComponent(user_name)}&week=${week}`);
    if(!res.ok) throw new Error("http "+res.status);
    const picks=await res.json();
    applyPicks(picks);
  }catch(e){console.error("restore fail",e)}
}

function applyPicks(picks){
  document.querySelectorAll(".team-btn.selected").forEach(b=>b.classList.remove("selected"));
  picks.forEach(p=>{
    const card=document.querySelector(`.game-card[data-match-id="${CSS.escape(p.game_id)}"]`);
    if(!card) return;
    const btn=card.querySelector(`.team-btn[data-team-id="${CSS.escape(p.pick)}"]`);
    if(btn) btn.classList.add("selected");
  });
}

document.addEventListener("click",async e=>{
  const btn=e.target.closest(".team-btn");
  if(!btn) return;
  const card=btn.closest(".game-card");
  const game_id=card.dataset.matchId;
  const pick=btn.dataset.teamId;
  const user_name=userSelect.value;
  const week=weekSelect.value;
  card.querySelectorAll(".team-btn").forEach(b=>b.classList.remove("selected"));
  btn.classList.add("selected");
  await fetch("/api/picks",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({user_name,week,game_id,pick})
  });
});

userSelect.addEventListener("change",restorePicks);
weekSelect.addEventListener("change",restorePicks);
document.addEventListener("DOMContentLoaded",restorePicks);

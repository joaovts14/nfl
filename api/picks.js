import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS") return res.status(204).end();

  if(req.method==="GET"){
    const { user_name, week } = req.query;
    if(!user_name || !week){
      return res.status(400).json({error:"Parâmetros 'user_name' e 'week' são obrigatórios"});
    }
    const client=await pool.connect();
    try{
      const sql=`SELECT week,game_id,user_name,pick,updated_at
                 FROM picks
                 WHERE user_name=$1 AND week=$2
                 ORDER BY game_id`;
      const {rows}=await client.query(sql,[user_name,Number(week)]);
      return res.status(200).json(rows);
    }catch(e){console.error(e);return res.status(500).json({error:"DB error"});}
    finally{client.release();}
  }

  if(req.method==="POST"){
    const { user_name, week, game_id, pick } = req.body||{};
    if(!user_name||!week||!game_id||!pick){
      return res.status(400).json({error:"Campos obrigatórios: user_name, week, game_id, pick"});
    }
    const client=await pool.connect();
    try{
      const sql=`INSERT INTO picks (week,game_id,user_name,pick)
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT (week,game_id,user_name)
                 DO UPDATE SET pick=EXCLUDED.pick,updated_at=now()
                 RETURNING week,game_id,user_name,pick,updated_at`;
      const {rows}=await client.query(sql,[Number(week),game_id,user_name,pick]);
      return res.status(200).json(rows[0]);
    }catch(e){console.error(e);return res.status(500).json({error:"DB error"});}
    finally{client.release();}
  }

  return res.status(405).json({error:"Method not allowed"});
}

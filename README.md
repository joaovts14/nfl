# NFL Picks App (anti-404)

## Deploy rápido na Vercel
1. Crie um novo projeto na Vercel apontando para este repositório.
2. **Root Directory** deve ser a raiz onde estão `index.html` e `api/` (não a pasta /api ou /public).
3. Adicione a env `DATABASE_URL`.
4. Deploy.

### Testes
- Front: `https://SEU-APP.vercel.app/`
- API OK: `https://SEU-APP.vercel.app/api/hello`
- API Picks: `https://SEU-APP.vercel.app/api/picks?week=1` (GET)
- POST:
  ```bash
  curl -X POST https://SEU-APP.vercel.app/api/picks     -H "content-type: application/json"     -d '{"week":1,"gameId":"demo","user":"Rafael","pick":"Empate"}'
  ```

### SQL
```sql
CREATE TABLE IF NOT EXISTS picks (
  id bigserial PRIMARY KEY,
  week int NOT NULL,
  game_id text NOT NULL,
  user_name text NOT NULL,
  pick text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week, game_id, user_name)
);
```

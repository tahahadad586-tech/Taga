import { createDb } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const db = createDb();
const { app, scheduler } = createApp(db);
scheduler.loadAll();

app.listen(port, () => {
  console.log(`Taga API listening on http://localhost:${port}`);
});

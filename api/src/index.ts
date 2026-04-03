import 'dotenv/config';
import { createApp } from './app';

const port = parseInt(process.env.PORT ?? '3001', 10);
const app = createApp();

app.listen(port, () => {
  console.log(`MarneHaus API running on http://localhost:${port}`);
});

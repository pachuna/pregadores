import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query('SELECT number, label, "imageUrl", "territoryType" FROM "Territory" ORDER BY number LIMIT 20');
rows.forEach(t => console.log(`T${t.number} ${t.label || ''} | type=${t.territoryType} | img=${t.imageUrl}`));
await client.end();

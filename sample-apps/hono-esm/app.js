import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';

const app = new Hono();

app.get('/', async (c) => {
    await readFile('app.js', 'utf8');
    return c.text('Hello, World!');
});

serve(app, (info) => {
    console.log(`Server is running on http://${info.address}:${info.port}`);
});

import { seed } from './db.js';
const result = seed();
if (!result.seeded) console.log('Database already contains users — nothing to seed.');

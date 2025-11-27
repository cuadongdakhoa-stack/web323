import { pool } from '../server/db.js';
import fs from 'fs';

const sql = fs.readFileSync('./migrations/0001_add_case_type.sql', 'utf-8');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration successful: Added case_type column');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });

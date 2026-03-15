#!/usr/bin/env node
/**
 * Database Migration Tool — SQLite → PostgreSQL
 * PROJECT-CLAW API Server
 *
 * Migrates ALL tables automatically. The PostgreSQL schema is created
 * by the PostgreSQLAdapter in database.js on first connect — this script
 * only copies data rows.
 *
 * Usage:
 *   DATABASE_URL=postgres://user:pass@host:5432/db npm run migrate:pg
 *   DATABASE_URL=... SQLITE_PATH=./data/project-claw.db node scripts/migrate-to-postgres.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { Client } = require('pg');

// ANSI colors
const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', blue: '\x1b[34m', cyan: '\x1b[36m', dim: '\x1b[2m',
};
const log = (msg, c = 'reset') => console.log(`${C[c]}${msg}${C.reset}`);

// Tables in dependency order (parents before children)
const TABLE_ORDER = [
  'users',
  'user_sessions',
  'auth_tokens',
  'projects',
  'agents',
  'manager_agents',
  'channels',
  'channel_members',
  'dm_channels',
  'messages',
  'tasks',
  'task_comments',
  'task_updates',
  'task_assignment_history',
  'costs',
  'cost_records',
  'budgets',
  'machines',
  'machine_agents',
  'agent_projects',
  'agent_notifications',
  'notifications',
  'activity_history',
  'typing_indicators',
  'presets',
  'openrouter_sync',
];

/**
 * Convert SQLite value to PostgreSQL-compatible value
 */
function convertValue(val, colName) {
  if (val === null || val === undefined) return null;

  // JSON columns — ensure they're valid JSON strings
  const jsonCols = ['config', 'metadata', 'payload', 'result', 'data', 'preferences', 'api_keys', 'skills', 'specialties', 'tags'];
  if (jsonCols.includes(colName)) {
    if (typeof val === 'string') {
      try { JSON.parse(val); return val; } catch { return '{}'; }
    }
    return JSON.stringify(val);
  }

  return val;
}

/**
 * Build INSERT ... ON CONFLICT DO NOTHING for a table
 */
function buildInsertSQL(tableName, columns) {
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
}

async function migrate() {
  log('\n🐘 PROJECT-CLAW: SQLite → PostgreSQL Migration', 'cyan');
  log('================================================\n', 'cyan');

  // Config
  const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, '../data/project-claw.db');
  const pgUrl = process.env.DATABASE_URL;

  if (!pgUrl) {
    log('❌ DATABASE_URL is not set.', 'red');
    log('   export DATABASE_URL="postgresql://user:pass@localhost:5432/project_claw"', 'yellow');
    process.exit(1);
  }

  if (!fs.existsSync(sqlitePath)) {
    log(`❌ SQLite database not found: ${sqlitePath}`, 'red');
    process.exit(1);
  }

  log(`📁 Source:  ${sqlitePath}`, 'blue');
  log(`🐘 Target:  ${pgUrl.replace(/:([^@]+)@/, ':****@')}\n`, 'blue');

  // Connect
  let sqlite, pg;
  try {
    sqlite = new Database(sqlitePath, { readonly: true });
    log('✅ Connected to SQLite', 'green');
  } catch (err) {
    log(`❌ SQLite connection failed: ${err.message}`, 'red');
    process.exit(1);
  }

  try {
    pg = new Client({
      connectionString: pgUrl,
      ssl: pgUrl.includes('localhost') || pgUrl.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    });
    await pg.connect();
    log('✅ Connected to PostgreSQL', 'green');
  } catch (err) {
    log(`❌ PostgreSQL connection failed: ${err.message}`, 'red');
    log('   Make sure PostgreSQL is running and DATABASE_URL is correct.', 'yellow');
    process.exit(1);
  }

  // Create schema — use the PostgreSQLAdapter from database.js
  log('\n🏗️  Creating PostgreSQL schema...', 'yellow');
  try {
    // Import and initialize the database module which creates all tables
    process.env.DB_TYPE = 'postgresql';
    const { initDatabase } = require('../src/database');
    await initDatabase();
    log('✅ Schema created via PostgreSQLAdapter\n', 'green');
  } catch (err) {
    log(`⚠️  Schema creation via adapter failed: ${err.message}`, 'yellow');
    log('   Attempting migration anyway (tables may already exist).\n', 'dim');
  }

  // Get all SQLite tables
  const sqliteTables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(t => t.name);

  log(`📊 Found ${sqliteTables.length} tables in SQLite\n`, 'blue');

  // Migrate in dependency order, then any remaining tables
  const orderedTables = [
    ...TABLE_ORDER.filter(t => sqliteTables.includes(t)),
    ...sqliteTables.filter(t => !TABLE_ORDER.includes(t)),
  ];

  const stats = {};
  let totalRows = 0;
  let totalErrors = 0;

  for (const table of orderedTables) {
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    if (rows.length === 0) {
      log(`   ${table}: ${C.dim}0 rows (skipped)${C.reset}`);
      stats[table] = 0;
      continue;
    }

    const columns = Object.keys(rows[0]);
    const insertSQL = buildInsertSQL(table, columns);

    let migrated = 0;
    let errors = 0;

    for (const row of rows) {
      const values = columns.map(col => convertValue(row[col], col));
      try {
        await pg.query(insertSQL, values);
        migrated++;
      } catch (err) {
        errors++;
        if (errors <= 3) {
          log(`     ⚠ ${table} row ${row.id || '?'}: ${err.message.substring(0, 80)}`, 'dim');
        }
      }
    }

    const errorNote = errors > 0 ? ` ${C.yellow}(${errors} skipped)${C.reset}` : '';
    log(`   ${table}: ${C.green}${migrated}${C.reset} rows migrated${errorNote}`);
    stats[table] = migrated;
    totalRows += migrated;
    totalErrors += errors;
  }

  // Close connections
  sqlite.close();
  await pg.end();

  // Summary
  log('\n================================================', 'cyan');
  log('🎉 Migration Complete!', 'cyan');
  log('================================================\n', 'cyan');

  const tablesWithData = Object.entries(stats).filter(([, v]) => v > 0);
  log(`📊 ${totalRows} total rows migrated across ${tablesWithData.length} tables`, 'green');
  if (totalErrors > 0) {
    log(`⚠️  ${totalErrors} rows skipped (duplicates or constraint violations)`, 'yellow');
  }

  log('\n📝 Next steps:', 'yellow');
  log('   1. Set in .env:  DB_TYPE=postgresql', 'yellow');
  log('   2. Set in .env:  DATABASE_URL=your_connection_string', 'yellow');
  log('   3. Restart the server:  npm run dev', 'yellow');
  log('   4. Verify at:  http://localhost:3001/health\n', 'yellow');
}

migrate().catch(err => {
  log(`\n❌ Fatal error: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});

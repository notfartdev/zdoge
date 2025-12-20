/**
 * Database Initialization Script
 * 
 * Run this to set up the PostgreSQL database schema.
 * Usage: npx tsx src/database/init.ts
 */

import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Get directory path (compatible with both CommonJS and ESM)
const getSchemaPath = () => {
  // Try to find schema.sql relative to current file
  const possiblePaths = [
    path.join(process.cwd(), 'src', 'database', 'schema.sql'),
    path.join(process.cwd(), 'backend', 'src', 'database', 'schema.sql'),
    path.join(__dirname || process.cwd(), 'schema.sql'),
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  throw new Error('Could not find schema.sql file');
};

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dogenado',
  user: process.env.DB_USER || 'dogenado',
  password: process.env.DB_PASSWORD || '',
};

async function initializeDatabase() {
  console.log('🔧 Dogenado Database Initialization\n');
  console.log(`Connecting to PostgreSQL at ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}...`);
  
  const pool = new pg.Pool(DB_CONFIG);
  
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to database\n');
    
    // Read schema file
    const schemaPath = getSchemaPath();
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    console.log('📄 Executing schema...\n');
    
    // Split by statement and execute
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      try {
        await pool.query(statement);
        successCount++;
        
        // Log table/index creation
        if (statement.toUpperCase().includes('CREATE TABLE')) {
          const match = statement.match(/CREATE TABLE.*?(\w+)/i);
          if (match) console.log(`   ✅ Table: ${match[1]}`);
        } else if (statement.toUpperCase().includes('CREATE INDEX')) {
          const match = statement.match(/CREATE INDEX.*?(\w+)/i);
          if (match) console.log(`   ✅ Index: ${match[1]}`);
        } else if (statement.toUpperCase().includes('CREATE.*VIEW')) {
          const match = statement.match(/CREATE.*VIEW.*?(\w+)/i);
          if (match) console.log(`   ✅ View: ${match[1]}`);
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes('already exists')) {
          skipCount++;
        } else {
          errorCount++;
          console.error(`   ❌ Error: ${errMsg.substring(0, 100)}`);
        }
      }
    }
    
    console.log(`\n📊 Results:`);
    console.log(`   Executed: ${successCount}`);
    console.log(`   Skipped (already exists): ${skipCount}`);
    console.log(`   Errors: ${errorCount}`);
    
    // Verify tables
    console.log('\n📋 Verifying tables...');
    
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('   Tables found:');
    for (const row of tablesResult.rows) {
      console.log(`   - ${row.table_name}`);
    }
    
    console.log('\n✅ Database initialization complete!\n');
    
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Database initialization failed:', errMsg);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
initializeDatabase().catch(console.error);

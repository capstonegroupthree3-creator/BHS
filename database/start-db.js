const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getMysqlCmd() {
  // Check if mysql is in PATH
  try {
    execSync('mysql --version', { stdio: 'ignore' });
    return 'mysql';
  } catch (e) {
    // Check known Windows paths
    const candidates = [
      'C:\\xampp\\mysql\\bin\\mysql.exe',
      'C:\\Program Files\\MySQL\\MySQL Workbench 8.0 CE\\mysql.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return `"${c}"`;
      }
    }
  }
  return 'mysql';
}

async function main() {
  const mysqlCmd = getMysqlCmd();
  const dbName = process.env.DB_NAME || 'barangay_health_db';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASS || '';
  const port = process.env.DB_PORT || '3306';

  const schemaPath = path.join(__dirname, 'schema.sql');
  const seedPath = path.join(__dirname, 'seed.sql');

  if (!fs.existsSync(schemaPath)) {
    console.error('Missing database/schema.sql');
    process.exit(1);
  }
  if (!fs.existsSync(seedPath)) {
    console.error('Missing database/seed.sql');
    process.exit(1);
  }

  const auth = password ? `-p${password}` : '';

  console.log(`Using MySQL client: ${mysqlCmd}`);

  // Recreate db cleanly
  execSync(
    `${mysqlCmd} -u${user} ${auth} -h 127.0.0.1 -P ${port} -e "DROP DATABASE IF EXISTS ${dbName}; CREATE DATABASE ${dbName};"`,
    { stdio: 'inherit' }
  );

  // Read and execute schema
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  execSync(`${mysqlCmd} -u${user} ${auth} -h 127.0.0.1 -P ${port} ${dbName}`, {
    input: schemaSql,
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  // Read and execute seed
  const seedSql = fs.readFileSync(seedPath, 'utf8');
  execSync(`${mysqlCmd} -u${user} ${auth} -h 127.0.0.1 -P ${port} ${dbName}`, {
    input: seedSql,
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  console.log('✔ DB schema and seed loaded successfully.');
}

main().catch((e) => {
  console.error('Database initialization error:', e.message);
  process.exit(1);
});

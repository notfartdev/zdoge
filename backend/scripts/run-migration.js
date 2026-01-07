import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/admin/migrate-shielded-transactions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

console.log('Running migration: shielded_transactions table...');
console.log(`POST http://localhost:3001/api/admin/migrate-shielded-transactions`);

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const json = JSON.parse(data);
      console.log('Response:', JSON.stringify(json, null, 2));
      if (res.statusCode === 200 && json.success) {
        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
      } else {
        console.error('\n❌ Migration failed');
        process.exit(1);
      }
    } catch (e) {
      console.log('Response:', data);
      if (res.statusCode === 200) {
        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
      } else {
        console.error('\n❌ Migration failed');
        process.exit(1);
      }
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  console.error('\nMake sure the backend is running on http://localhost:3001');
  process.exit(1);
});

req.end();


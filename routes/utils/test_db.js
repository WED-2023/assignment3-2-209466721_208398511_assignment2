require('dotenv').config();
const { pool } = require('./MySql');

console.log('host:', process.env.host);
console.log('user:', process.env.user);
console.log('DBpassword:', process.env.DBpassword);
console.log('database:', process.env.database);

pool.query('SELECT 1 + 1 AS result', (err, results) => {
    if (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    } else if (results && results[0] && results[0].result !== undefined) {
        console.log('Connection successful! Result:', results[0].result);
        process.exit(0);
    } else {
        console.error('Connection succeeded, but unexpected result:', results);
        process.exit(1);
    }
});

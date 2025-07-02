const mysql = require('mysql2/promise');
require("dotenv").config();

const config = {
  connectionLimit: 4,
  host: process.env.host,
  user: process.env.user,
  password: process.env.DBpassword,
  database: process.env.database
};

const pool = mysql.createPool(config);

const connection = async () => {
  return await pool.getConnection();
};

const query = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

module.exports = { pool, connection, query };

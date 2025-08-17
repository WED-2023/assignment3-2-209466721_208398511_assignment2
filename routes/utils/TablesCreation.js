const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTables() {
  const connection = await mysql.createConnection({
    host: process.env.host,
    user: process.env.user,
    password: process.env.DBpassword,
    database: process.env.database
  });

    await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        country VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL
        )
    `);
    await connection.query(`
        CREATE TABLE recipes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL, -- Creator
        title VARCHAR(100) NOT NULL,
        image VARCHAR(255),
        prep_time INT,      -- in minutes
        servings INT,
        instructions TEXT,
        is_vegan BOOLEAN DEFAULT FALSE,
        is_vegetarian BOOLEAN DEFAULT FALSE,
        is_gluten_free BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        `);

    await connection.query(`CREATE TABLE family_recipes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL, -- Who submitted
        title VARCHAR(100) NOT NULL,
        image VARCHAR(255),
        prep_time INT,
        servings INT,
        instructions TEXT,
        family_story TEXT,         -- Who/when/why, etc
        is_vegan BOOLEAN DEFAULT FALSE,
        is_vegetarian BOOLEAN DEFAULT FALSE,
        is_gluten_free BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await connection.query(`CREATE TABLE ingredients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipe_id INT NOT NULL,
        ingredient VARCHAR(100) NOT NULL,
        quantity VARCHAR(50),
        is_family_recipe BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
        )`);

    await connection.query(`CREATE TABLE favorites (
        user_id INT NOT NULL,
        recipe_id INT,
        family_recipe_id INT,
        external_recipe_id VARCHAR(100),  -- for API recipes
        PRIMARY KEY (user_id, recipe_id, family_recipe_id, external_recipe_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
        FOREIGN KEY (family_recipe_id) REFERENCES family_recipes(id) ON DELETE CASCADE
        )`);
    await connection.query(`CREATE TABLE views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        recipe_id INT,
        family_recipe_id INT,
        external_recipe_id VARCHAR(100),
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);
    await connection.query(`CREATE TABLE last_search (
        user_id INT PRIMARY KEY,
        search_query VARCHAR(255),
        searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
     )`);
  console.log('Tables created successfully.');
  await connection.end();
}

createTables().catch(console.error);
const { Client } = require('pg');
let client;

async function connectToMariaDB() {
    // Normally you'd use environment variables for this
    // These values were also referenced in the docker-compose.yml
    
    client = new Client({
        user: 'root',
        host: '127.0.0.1',
        database: 'main_db',
        password: 'password',
        port: 27016,
    });

    await client.connect();

    await initDb();
}

async function initDb() {
    // This creates the cats table
    await client.query(`
    CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
    );
    `);
}

async function insertCatIntoTable(petname) {
    // This makes your database vulnerable to SQL Injections! vvv
    await client.query(`INSERT INTO cats(petname) VALUES ('${petname}');`)
}

async function getAllCats() {
    // This function returns all cats in the db
    const cats = await client.query("SELECT petname FROM cats;")   
    return cats.rows.map((row) => row.petname);
}

module.exports = {connectToMariaDB, insertCatIntoTable, getAllCats};
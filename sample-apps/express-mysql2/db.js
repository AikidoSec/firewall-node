// Get the client
const mysql = require('mysql2');
let connection;

async function connectToMysqlDB() {
    // Normally you'd use environment variables for this
    // These values were also referenced in the docker-compose.yml
    
    connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'mypassword',
        database: 'catsdb',
        port: 27015
    })

    await initDb();
}

async function initDb() {
    // This creates the cats table
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
    );
    `);
}

async function insertCatIntoTable(petname) {
    // This makes your database vulnerable to SQL Injections! vvv
    await connection.execute(`INSERT INTO cats(petname) VALUES ('${petname}');`)
}

async function getAllCats() {
    // This function returns all cats in the db
    const cats = await connection.execute("SELECT petname FROM cats;")   
    return cats.rows.map((row) => row.petname);
}

module.exports = {connectToMysqlDB, insertCatIntoTable, getAllCats};
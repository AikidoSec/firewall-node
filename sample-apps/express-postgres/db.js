async function initDb(client) {
    // This creates the cats table
    await client.query(`
    CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
    );
    `);
}

async function insertCatIntoTable(petname, client) {
    // This makes your database vulnerable to SQL Injections! vvv
    await client.query(`INSERT INTO cats(petname) VALUES ('${petname}');`)
}

async function getAllCats(client) {
    // This function returns all cats in the db
    const cats = await client.query("SELECT petname FROM cats;")   
}
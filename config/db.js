const mysql = require("mysql2");

const connection = mysql
  .createPool({
    host: "localhost",
    user: "root",
    password: "root",
  })
  .promise();

async function createDb() {
  try {
    await connection.execute("CREATE DATABASE yelp;");
  } catch (error) {
    console.log(error);
  }
}
createDb();

module.exports = connection;

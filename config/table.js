const mysql = require("mysql2");

const connection = mysql
  .createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "yelp",
  })
  .promise();

async function createTable() {
  try {
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS businesses  (
    id varchar(255),
    alias varchar(255),
    name varchar(255),
    image_url varchar(255),
    review_count int,
    rating float,
    price varchar(5),
    phone varchar(255),
    distance float,
    display_phone varchar(255),
    PRIMARY KEY (id)
    );
    `);
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS categories  (
    id varchar(255),
    alias varchar(255),
    title varchar(255),
    PRIMARY KEY (id)
    )`);
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS bussinesses_categories  (
    id varchar(255),
    business_id varchar(255),
    category_id varchar(255),
    PRIMARY KEY (id),
    FOREIGN KEY (business_id) REFERENCES businesses (id)
    ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE CASCADE
    )
    `);
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS transactions  (
    id varchar(255),
    name varchar(255),
    PRIMARY KEY (id)
    )`);
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS bussinesses_transactions  (
    id varchar(255),
    business_id varchar(255),
    transaction_id varchar(255),
    PRIMARY KEY (id),
    FOREIGN KEY (business_id) REFERENCES businesses (id)
    ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions (id)
    ON DELETE CASCADE
    )
    `);
  } catch (err) {
    console.log(err);
  }
}

createTable();
module.exports = connection;

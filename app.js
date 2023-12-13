require("dotenv").config();
const express = require("express");
const app = express();
var bodyParser = require("body-parser");
var jsonParser = bodyParser.json();

const port = 3000;
const controller = require("./controller");
var cors = require("cors");

app
  .use(express.json())
  .use(cors())
  .use(bodyParser.urlencoded({ extended: false }))
  .get("/test", controller.test)
  .post("/business", controller.postBusiness);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

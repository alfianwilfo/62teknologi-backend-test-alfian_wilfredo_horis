require('dotenv').config()
const express = require('express')
const app = express()
const port = 3000
const controller = require('./controller')
var cors = require('cors')

app.use(cors())
app.get('/test', controller.test)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
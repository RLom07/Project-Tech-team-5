require('dotenv').config()

const express = require('express')
const path = require('path')
const { MongoClient, ServerApiVersion } = require('mongodb')

const app = express()
const port = process.env.PORT || 3000

// 🔐 encode credentials
const username = encodeURIComponent(process.env.DB_USERNAME)
const password = encodeURIComponent(process.env.DB_PASSWORD)

const uri = `mongodb+srv://${username}:${password}@${process.env.DB_HOST}/?appName=${process.env.APP_NAME}`

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
})

let db // we bewaren database hier

async function startServer() {
  try {
    await client.connect()
    console.log("✅ Connected to MongoDB")

    // kies database naam
    db = client.db("myapp")

    // Express config pas starten NA DB connectie
    app.set('view engine', 'ejs')
    app.set('views', path.join(__dirname, 'views'))
    app.use(express.static('public'))
    app.use(express.urlencoded({ extended: true }))

    app.get('/', async (req, res) => {
      res.render('index')
    })

    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`)
    })

  } catch (err) {
    console.error("❌ MongoDB connection failed:", err)
    process.exit(1)
  }
}

startServer()
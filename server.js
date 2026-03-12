require('dotenv').config()
 
const express = require('express')
const path = require('path')
const { MongoClient, ServerApiVersion } = require('mongodb')
const app = express()
const port = process.env.PORT || 3000
 
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/?appName=${process.env.APP_NAME}`;
 
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 5000, // na 5 sec een duidelijke error
  connectTimeoutMS: 5000,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
 
async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);


//API//////////////////////////////
async function fetchData(url) {
    const response = await fetch(url);
    const data = await response.json();
    console.log(data)
}

fetchData(`${process.env.BASE_URL}/movie/popular?api_key=${process.env.API_KEY}`);

console.log(`${process.env.BASE_URL}/movie/popular?api_key=${process.env.API_KEY}`)
//Starter endpoints that can be used
// /movie/popular?

// /trending/movie/day?

// /search/movie?

// /movie/top_rated?
//////////////////////////////////// 
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static("static"));
app.use(express.urlencoded({ extended: true }))
 


//Routes
 
app.get('/', (req, res) => { res.render('index') })
 
app.get('/profile', (req, res) => { res.render(`profile`) })

app.get('/register', (req, res) => { res.render(`register`) })
 
 
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
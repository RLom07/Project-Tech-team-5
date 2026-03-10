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
 
 
//API
async function fetchData() {
  const url = 'https://imdb232.p.rapidapi.com/api' ;
 
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'imdb232.p.rapidapi.com',
        'x-rapidapi-key': '6cbe0e049amsh5b14f29e50608aap12c417jsn221b084fae67'
      }
    });
 
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
 
    const data = await response.json();
    console.log(data); // your result here
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}
 
// Call the function
fetchData();
 
 
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
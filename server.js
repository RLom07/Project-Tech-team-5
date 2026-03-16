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


//API index populair movies//////////////////////////////
async function getPopularMovies() {

  const url = `${process.env.BASE_URL}/trending/movie/week?api_key=${process.env.API_KEY}`

  const response = await fetch(url)
  const data = await response.json()

  return data.results.slice(0,5) // eerste 5 films

}



app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static("static"));
app.use(express.urlencoded({ extended: true }))
 


//Profile /////////////////////////////





//Routes
 
app.get('/', async (req, res) => {

  const movies = await getPopularMovies()

  res.render('index', { movies })

})

app.get('/movie/:id', async (req, res) => {

  const movieId = req.params.id

  const response = await fetch(
    `${process.env.BASE_URL}/movie/${movieId}?api_key=${process.env.API_KEY}`
  )

  const movie = await response.json()

  res.render('detail', { movie })

})
 
app.get('/profile', (req, res) => { res.render(`profile`) })




app.get('/register', (req, res) => { res.render(`register`) })

app.get('/login', (req, res) => { res.render(`login`) })
app.get('/vragenlijst', (req, res) => { res.render(`vragenlijst`) })
 
app.get('/vragenlijst-vraag1', (req, res) => { res.render(`vragenlijst-vraag1`) })

app.get('/vragenlijst-vraag2', (req, res) => { res.render(`vragenlijst-vraag2`) })
 
app.get('/vragenlijst-vraag3', (req, res) => { res.render(`vragenlijst-vraag3`) })

app.get('/vragenlijst-vraag4', (req, res) => { res.render(`vragenlijst-vraag4`)})

app.get('/vragenlijst-vraag5', (req, res) => { res.render(`vragenlijst-vraag5`)})

app.get('/vragenlijst-vraag6', (req, res) => { res.render(`vragenlijst-vraag6`)})


app.get('/matching', (req, res) => { res.render(`matching`)})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
 
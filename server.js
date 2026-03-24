  require('dotenv').config()
 
const express = require('express')
const path = require('path')
const { MongoClient, ServerApiVersion } = require('mongodb')
const app = express()
const port = process.env.PORT || 3000

const bcrypt = require('bcrypt');
 
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

const SALT_ROUNDS = 12;
const USERS_COLLECTION = 'users';
let db;

async function connectToMongo() {
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  db = client.db(process.env.DB_NAME);

  // Zorg dat email uniek is
  await db.collection(USERS_COLLECTION).createIndex({ email: 1 }, { unique: true });

  console.log(`Connected to MongoDB database: ${process.env.DB_NAME}`);
}

//API//////////////////////////////
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    //console.log(data);
  } catch (error) {
    console.error('TMDB fetch error:', error.message);
  }
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
app.use('/static', express.static(path.join(__dirname, 'static')))
app.use(express.static("static"));
app.use(express.static("public"));
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

app.get('/profielaanpassen', (req, res) => { res.render(`profielaanpassen`) })

app.get('/register', (req, res) => { res.render(`register`) })

app.get('/login', (req, res) => { res.render(`login`) })

app.get('/vragenlijst', (req, res) => { res.render(`vragenlijst`) })
 
app.get('/vragenlijst-vraag1', (req, res) => { res.render(`vragenlijst-vraag1`) })

app.get('/vragenlijst-vraag2', (req, res) => { res.render(`vragenlijst-vraag2`) })
 
app.get('/vragenlijst-vraag3', (req, res) => { res.render(`vragenlijst-vraag3`) })

app.get('/vragenlijst-vraag4', (req, res) => { res.render(`vragenlijst-vraag4`)})

app.get('/vragenlijst-vraag5', (req, res) => { res.render(`vragenlijst-vraag5`)})

app.get('/vragenlijst-vraag6', (req, res) => { res.render(`vragenlijst-vraag6`)})

app.get('/matching', (req, res) => {
  res.render('matching')
})
 

// Posts
app.post('/matching', async (req, res) => {
  const antwoorden = JSON.parse(req.body.antwoorden || '{}')
  const response = await fetch(`${process.env.BASE_URL}/movie/${movieId}?api_key=${process.env.API_KEY}`);
  const movies = await response.json()
  console.log(movies)   
  res.render('matching', { antwoorden })
})

app.post('/register', async (req, res) => {
  try {
    const { vnaam, anaam, email, wwoord } = req.body;

    if (!vnaam || !anaam || !email || !wwoord) {
      return res.status(400).send('Vul alle velden in.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(wwoord, SALT_ROUNDS);

    const user = {
      voornaam: vnaam.trim(),
      achternaam: anaam.trim(),
      email: normalizedEmail,
      wachtwoord: hashedPassword,
      watchlist: [],
      recentlyWatched: [],
      createdAt: new Date()
    };

    await db.collection(USERS_COLLECTION).insertOne(user);

    return res.redirect('/login');
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).send('Dit e-mailadres is al geregistreerd.');
    }

    console.error('Register error:', error);
    return res.status(500).send('Er ging iets mis bij registreren.');
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, wwoord } = req.body;

    if (!email || !wwoord) {
      return res.status(400).send('Vul email en wachtwoord in.');
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await db.collection(USERS_COLLECTION).findOne({
      email: normalizedEmail
    });

    if (!user) {
      return res.status(401).send('Ongeldige inloggegevens.');
    }

    const isPasswordValid = await bcrypt.compare(wwoord, user.wachtwoord);

    if (!isPasswordValid) {
      return res.status(401).send('Ongeldige inloggegevens.');
    }

    // Zonder session/JWT: alleen redirect bij succesvolle login
    return res.redirect('/profile');
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).send('Er ging iets mis bij inloggen.');
  }
});

//Mongo Connection
connectToMongo()
  .then(() => {
    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
 

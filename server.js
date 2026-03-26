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

function parseAntwoorden(rawAntwoorden) {
  try {
    return JSON.parse(rawAntwoorden || '{}')
  } catch (error) {
    console.error('Kon antwoorden niet parsen:', error.message)
    return {}
  }
}

function buildDiscoverUrl(antwoorden = {}) {
  const url = new URL(`${process.env.BASE_URL}/discover/movie`)

  url.searchParams.set('api_key', process.env.API_KEY)
  url.searchParams.set('sort_by', 'popularity.desc')
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('include_video', 'false')
  url.searchParams.set('language', 'nl-NL')
  url.searchParams.set('page', '1')
  url.searchParams.set('vote_count.gte', '50')

  const genreMap = {
    'Actie': '28',
    'Comedy': '35',
    'Horror': '27',
    'Drama': '18',
    'Romantiek': '10749',
    'Sci-fi': '878',
    'Animatie': '16',
    'Misdaad': '80',
    'Fantasy': '14'
  }

  const taalMap = {
    'Engels': 'en',
    'Nederlands': 'nl',
    'Japans': 'ja'
  }

  const periodeMap = {
    'Nieuwste films': ['2024-01-01', '2026-12-31'],
    'Vanaf 2020': ['2020-01-01', '2026-12-31'],
    '2010-2019': ['2010-01-01', '2019-12-31'],
    '2000-2009': ['2000-01-01', '2009-12-31'],
    'Klassiekers': ['1900-01-01', '1999-12-31']
  }

  if (genreMap[antwoorden.genre]) {
    url.searchParams.set('with_genres', genreMap[antwoorden.genre])
  }

  if (taalMap[antwoorden.taal]) {
    url.searchParams.set('with_original_language', taalMap[antwoorden.taal])
  }

  if (periodeMap[antwoorden.periode]) {
    const [releaseStart, releaseEnd] = periodeMap[antwoorden.periode]
    url.searchParams.set('primary_release_date.gte', releaseStart)
    url.searchParams.set('primary_release_date.lte', releaseEnd)
  }

  if (antwoorden.doelgroep === 'Voor volwassenen') {
    url.searchParams.set('certification_country', 'US')
    url.searchParams.set('certification.lte', 'R')
  }

  if (antwoorden.belangrijk === 'Hoog beoordeeld') {
    url.searchParams.set('sort_by', 'vote_average.desc')
    url.searchParams.set('vote_count.gte', '300')
  }

  return url.toString()
}

function formatRuntime(runtimeInMinutes) {
  if (!runtimeInMinutes) {
    return 'Speelduur onbekend'
  }

  const hours = Math.floor(runtimeInMinutes / 60)
  const minutes = runtimeInMinutes % 60

  if (!hours) {
    return `${minutes} min`
  }

  if (!minutes) {
    return `${hours} uur`
  }

  return `${hours} uur ${minutes} min`
}

async function getMatchingMovies(antwoorden = {}) {
  const discoverResponse = await fetch(buildDiscoverUrl(antwoorden))
  const discoverData = await discoverResponse.json()
  const results = Array.isArray(discoverData.results) ? discoverData.results.slice(0, 5) : []

  const detailedMovies = await Promise.all(
    results.map(async (movie) => {
      try {
        const detailResponse = await fetch(
          `${process.env.BASE_URL}/movie/${movie.id}?api_key=${process.env.API_KEY}&language=nl-NL`
        )
        const detail = await detailResponse.json()

        return {
          ...movie,
          overview: detail.overview || movie.overview || 'Geen beschrijving beschikbaar.',
          runtimeLabel: formatRuntime(detail.runtime),
          matchPercentage: Math.max(60, Math.min(98, Math.round(movie.vote_average * 10)))
        }
      } catch (error) {
        console.error(`Kon details niet ophalen voor film ${movie.id}:`, error.message)
        return {
          ...movie,
          overview: movie.overview || 'Geen beschrijving beschikbaar.',
          runtimeLabel: 'Speelduur onbekend',
          matchPercentage: Math.max(60, Math.min(98, Math.round(movie.vote_average * 10)))
        }
      }
    })
  )

  return detailedMovies
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
  try {
    const movieId = req.params.id

    const [movieResponse, providersResponse] = await Promise.all([
      fetch(`${process.env.BASE_URL}/movie/${movieId}?api_key=${process.env.API_KEY}&language=nl-NL`),
      fetch(`${process.env.BASE_URL}/movie/${movieId}/watch/providers?api_key=${process.env.API_KEY}`)
    ])

    const movie = await movieResponse.json()
    const providersData = await providersResponse.json()
    const nlProviders = providersData?.results?.NL?.flatrate || []

    res.render('detail', {
      movie,
      providers: nlProviders
    })
  } catch (error) {
    console.error('Detail error:', error)
    res.status(500).send('Er ging iets mis bij het laden van de detailpagina.')
  }

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

app.get('/matching', (req, res) => {
  res.render('matching', { antwoorden: {}, bestMatch: null, otherMatches: [] })
})
 

// Posts
app.post('/matching', async (req, res) => {
  try {
    const antwoorden = parseAntwoorden(req.body.antwoorden)
    const matches = await getMatchingMovies(antwoorden)

    res.render('matching', {
      antwoorden,
      bestMatch: matches[0] || null,
      otherMatches: matches.slice(1)
    })
  } catch (error) {
    console.error('Matching error:', error)
    res.status(500).render('matching', {
      antwoorden: parseAntwoorden(req.body.antwoorden),
      bestMatch: null,
      otherMatches: [],
      error: 'Er ging iets mis bij het ophalen van matches.'
    })
  }
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
 

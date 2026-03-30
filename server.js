require("dotenv").config()
 
const express = require("express")
const path = require("path")
const { MongoClient, ServerApiVersion } = require("mongodb")
const xss = require("xss")
const app = express()
const port = process.env.PORT || 3000
const validator = require("validator")
const dns = require("node:dns/promises")
const session = require("express-session")

const bcrypt = require("bcrypt")
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/?appName=${process.env.APP_NAME}`
 
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 5000, // na 5 sec een duidelijke error
  connectTimeoutMS: 5000,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
})

const SALT_ROUNDS = 12
const USERS_COLLECTION = "users"
const ALLOWED_EMAIL_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "proton.me",
  "passmail.net",
  "passmail.com",
  "passinbox.com",
  "passfwd.com",
  "protonmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "yahoo.com",
  "hva.nl"
])
let db

function sanitizeTextInput(value) {
  if (typeof value !== "string") return ""

  return xss(value, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script"]
  }).trim()
}

async function connectToMongo() {
  await client.connect()
  await client.db("admin").command({ ping: 1 })
  db = client.db(process.env.DB_NAME)

  // Zorg dat email uniek is
  await db.collection(USERS_COLLECTION).createIndex({ email: 1 }, { unique: true })

  console.log(`Connected to MongoDB database: ${process.env.DB_NAME}`)
}

async function hasValidMailProvider(email) {
  if (!validator.isEmail(email)) return false

  const domain = email.split("@")[1].toLowerCase()

  try {
    const mx = await dns.resolveMx(domain)
    return mx.length > 0
  } catch {
    return false
  }
}

//API//////////////////////////////
async function fetchData(url) {
  try {
    const response = await fetch(url)
    const data = await response.json()
    //console.log(data);
  } catch (error) {
    console.error("TMDB fetch error:", error.message)
  }
}

fetchData(`${process.env.BASE_URL}/movie/popular?api_key=${process.env.API_KEY}`)

//Starter endpoints that can be used
// /movie/popular?

// /trending/movie/day?

// /search/movie?

// /movie/top_rated?
//////////////////////////////////// 


app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))
app.use("/static", express.static(path.join(__dirname, "static")))
app.use(express.static("static"))
app.use(express.static("public"))
app.use(express.urlencoded({ extended: true }))
 
app.use(session({
  secret: "ditistest",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60000 * 60
  }
}))

//Routes
app.get("/", async (req, res) => {

  if (req.session && req.session.userId) {
    return res.redirect('/indexingelogd');
  }

  const movies = await getPopularMovies();
  res.render('index', { movies, reviews});
});

// API index populair movies /////////////////////////////////
async function getPopularMovies() {

  const url = `${process.env.BASE_URL}/trending/movie/week?api_key=${process.env.API_KEY}`

  const response = await fetch(url)
  const data = await response.json()

  return data.results.slice(0, 5) // eerste 5 films
}

//oefenen review pagina

let reviews = [
  {
    id: 1,
    name: "Anna",
    text: "Hele goede website",
    rating: "5",
  },
];

let currentId = 2;

//read- haalt de reviews op
app.get("/reviews", (req, res) => {
  res.json(reviews);
});

//Create- nieuwe review toevoegen
app.post("/reviews", (req, res) => {

    if (!req.session.userId) {
    return res.redirect('/login?next=/review');
  }
  
  const { name, text, rating } = req.body;
  const nummerRating = Number(rating);

  if (!name || !text || !rating) {
    return res.status(400).json({error:"vul alle velden in."});
  }

  if (isNaN(nummerRating) || nummerRating < 1 || nummerRating > 5) {
  return res.status(400).json({ error: "vul een getal tussen 1 en 5 in." });
  }
  
  const newReview = {
    id: currentId++,
    userId: req.session.userId,
    name,
    text,
    rating: nummerRating,
  };

  reviews.push(newReview);
  res.redirect('/');
});

//delete van een review

app.post('/reviews/:id/delete', (req, res) =>{
  const id = Number(req.params.id) 
  reviews = reviews.filter((review) => review.id !== id)
  res.redirect('/')
})

//gegenereerde code voor de matching functie//
function parseAntwoorden(rawAntwoorden) {
  try {
    return JSON.parse(rawAntwoorden || "{}")
  } catch (error) {
    console.error("Kon antwoorden niet parsen:", error.message)
    return {}
  }
}

function buildDiscoverUrl(antwoorden = {}) {
  const url = new URL(`${process.env.BASE_URL}/discover/movie`)

  url.searchParams.set("api_key", process.env.API_KEY)
  url.searchParams.set("sort_by", "popularity.desc")
  url.searchParams.set("include_adult", "false")
  url.searchParams.set("include_video", "false")
  url.searchParams.set("language", "nl-NL")
  url.searchParams.set("page", "1")
  url.searchParams.set("vote_count.gte", "50")

  const genreMap = {
    "Actie": "28",
    "Comedy": "35",
    "Horror": "27",
    "Drama": "18",
    "Romantiek": "10749",
    "Sci-fi": "878",
    "Animatie": "16",
    "Misdaad": "80",
    "Fantasy": "14"
  }

  const taalMap = {
    "Engels": "en",
    "Nederlands": "nl",
    "Japans": "ja"
  }

  const periodeMap = {
    "Nieuwste films": ["2024-01-01", "2026-12-31"],
    "Vanaf 2020": ["2020-01-01", "2026-12-31"],
    "2010-2019": ["2010-01-01", "2019-12-31"],
    "2000-2009": ["2000-01-01", "2009-12-31"],
    "Klassiekers": ["1900-01-01", "1999-12-31"]
  }

  if (genreMap[antwoorden.genre]) {
    url.searchParams.set("with_genres", genreMap[antwoorden.genre])
  }

  if (taalMap[antwoorden.taal]) {
    url.searchParams.set("with_original_language", taalMap[antwoorden.taal])
  }

  if (periodeMap[antwoorden.periode]) {
    const [releaseStart, releaseEnd] = periodeMap[antwoorden.periode]
    url.searchParams.set("primary_release_date.gte", releaseStart)
    url.searchParams.set("primary_release_date.lte", releaseEnd)
  }

  if (antwoorden.doelgroep === "Voor volwassenen") {
    url.searchParams.set("certification_country", "US")
    url.searchParams.set("certification.lte", "R")
  }

  if (antwoorden.belangrijk === "Hoog beoordeeld") {
    url.searchParams.set("sort_by", "vote_average.desc")
    url.searchParams.set("vote_count.gte", "300")
  }

  return url.toString()
}

function formatRuntime(runtimeInMinutes) {
  if (!runtimeInMinutes) {
    return "Speelduur onbekend"
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
          overview: detail.overview || movie.overview || "Geen beschrijving beschikbaar.",
          runtimeLabel: formatRuntime(detail.runtime),
          matchPercentage: Math.max(60, Math.min(98, Math.round(movie.vote_average * 10)))
        }
      } catch (error) {
        console.error(`Kon details niet ophalen voor film ${movie.id}:`, error.message)
        return {
          ...movie,
          overview: movie.overview || "Geen beschrijving beschikbaar.",
          runtimeLabel: "Speelduur onbekend",
          matchPercentage: Math.max(60, Math.min(98, Math.round(movie.vote_average * 10)))
        }
      }
    })
  )

  return detailedMovies
}





// API detail info movies /////////////////////////////////

//met behulp van ChatGPT
app.get('/movie/:id', async (req, res) => {
  
  const movieId = req.params.id;
  const added = req.query.added;

  const { ObjectId } = require('mongodb');

    const gebruiker = await db.collection(USERS_COLLECTION).findOne({
      _id: new ObjectId(req.session.userId)
    }); 


  //film ophalen /////
  const response = await fetch(
    `${process.env.BASE_URL}/movie/${movieId}?api_key=${process.env.API_KEY}`
  )
  const movie = await response.json()

  //credits film ophalen /////
  const creditsResponse = await fetch(
    `${process.env.BASE_URL}/movie/${movieId}/credits?api_key=${process.env.API_KEY}`
  )

  const creditsData = await creditsResponse.json()

  // Director
  const director = creditsData.crew.find(person =>
    person.job === "Director"
  )

  // Writers
  const writers = creditsData.crew
    .filter(person =>
      person.job === "Writer" ||
      person.job === "Screenplay" ||
      person.job === "Story"
    )
    .map(person => person.name)
 
  //Top 3 acteurs
  const actors = creditsData.cast
    .slice(0, 6)
    .map(actor => actor.name)


  //trailer ophalen /////
  const videoResponse = await fetch(
    `${process.env.BASE_URL}/movie/${movieId}/videos?api_key=${process.env.API_KEY}`
  )
 
  const videoData = await videoResponse.json()
 
  const trailer = videoData.results.find(video =>
    video.type === "Trailer" && video.site === "YouTube"
  )
 
 
  
  //Providers ophalen /////
    const providerResponse = await fetch(
      `${process.env.BASE_URL}/movie/${movieId}/watch/providers?api_key=${process.env.API_KEY}`
    )
    const providerData = await providerResponse.json()

    const providers = [
      ...(providerData.results?.NL?.flatrate || []),
      ...(providerData.results?.NL?.rent || []),
      ...(providerData.results?.NL?.buy || [])
    ]

    // Priority providers
    const priorityProviders = [
      "Netflix",
      "Disney Plus",
      "Amazon Prime Video",
      "HBO Max",
      "Pathé Thuis"
    ]

    // lege array om code beneden erin te pushen
    const sorted = []

    // eerst priority providers
    priorityProviders.forEach(name => {
      const found = providers.find(p => p.provider_name === name)
      if (found) {
        sorted.push(found)
      }
    })

    const topProviders = sorted.slice(0, 3)

  //reccomendation lijst ophalen /////
  const recommendationsResponse = await fetch(
    `${process.env.BASE_URL}/movie/${movieId}/recommendations?api_key=${process.env.API_KEY}`
  )
 
  const recommendationsData = await recommendationsResponse.json()
 
  const recommendations = recommendationsData.results.slice(0, 6)
  
  // renderen
  res.render("detail", {
    movie,
    providers: topProviders,
    director: director?.name || "Onbekend",
    writers,
    actors,
    trailer,
    recommendations,
    added,
    gebruiker
  });

})


 
app.get("/profile", async (req, res) => { 
  try {
    
    const { ObjectId } = require("mongodb")

    const gebruiker = await db.collection(USERS_COLLECTION).findOne({
      _id: new ObjectId(req.session.userId)
    }) 
                
    const hour = new Date().getHours()
    let greeting

    if (hour < 12) {
        greeting = "Goedemorgen"
    } else if (hour < 18) {
        greeting = "Goedemiddag"
    } else {
        greeting = "Goedenavond"
    }

    const watchlist = []
    const recentlyWatched = []

    for (const movieId of gebruiker.recentlyWatched) {
      const url = `${process.env.BASE_URL}/movie/${movieId}?api_key=${process.env.API_KEY}`
      const response = await fetch(url)
      const movie = await response.json()
      recentlyWatched.push(movie)
    }


    for (const movieId of gebruiker.watchlist) {
      const url = `${process.env.BASE_URL}/movie/${movieId}?api_key=${process.env.API_KEY}`
      const response = await fetch(url)
      const movie = await response.json()
      watchlist.push(movie)
    }

    const movies = await getPopularMovies()

    req.session.visited = true
    // 3. Pass the data object as the second argument to res.render
    res.render("profile",  { gebruiker, greeting, movies, recentlyWatched, watchlist}) 

  } catch (error) {  
    console.error("Error fetching profile:", error)

    res.status(500).send("Internal Server Error")
  }
})

app.delete("/recently-watched/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const userId = req.session.userId;
    const movieId = parseInt(req.params.id);

    console.log("DELETE hit", { userId, movieId });

    if (!userId) return res.sendStatus(401);

    const result = await db.collection(USERS_COLLECTION).updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { recentlyWatched: movieId } }
    );

    console.log("MongoDB result:", result);

    if (result.modifiedCount > 0) {
      res.sendStatus(200);
    } else {
      res.status(404).send("Movie not found in recentlyWatched");
    }
  } catch (err) {
    console.error("Error removing movie:", err);
    res.sendStatus(500);
  }
});

app.get("/profielaanpassen", (req, res) => { res.render("profielaanpassen") })

app.get("/register", (req, res) => {
  res.render("register", { error: null, formData: {} })
})

app.get('/login', (req, res) => {
  res.render('login', { error: null, formData: {}, next: req.query.next || '' });
})

app.get("/uitloggen", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid")
    res.redirect("/")
  })
})

app.get('/review', (req, res) => { 
    if (!req.session.userId) {
      return res.redirect('/login?next=/review');
  }

  res.render(`review`)
});

app.get('/indexingelogd', async (req, res) => {

  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }

  const movies = await getPopularMovies();
  res.render('indexingelogd', { movies, reviews });
});

app.get('/vragenlijst', (req, res) => { res.render(`vragenlijst`) })
 
app.get("/vragenlijst-vraag1", (req, res) => { res.render("vragenlijst-vraag1") })

app.get("/vragenlijst-vraag2", (req, res) => { res.render("vragenlijst-vraag2") })
 
app.get("/vragenlijst-vraag3", (req, res) => { res.render("vragenlijst-vraag3") })

app.get("/vragenlijst-vraag4", (req, res) => { res.render("vragenlijst-vraag4")})

app.get("/vragenlijst-vraag5", (req, res) => { res.render("vragenlijst-vraag5")})

app.get("/vragenlijst-vraag6", (req, res) => { res.render("vragenlijst-vraag6")})

app.get("/matching", (req, res) => {
  res.render("matching", { antwoorden: {}, bestMatch: null, otherMatches: [] })
})
 

// Posts
app.post("/matching", async (req, res) => {
  try {
    const antwoorden = parseAntwoorden(req.body.antwoorden)
    const matches = await getMatchingMovies(antwoorden)

    res.render("matching", {
      antwoorden,
      bestMatch: matches[0] || null,
      otherMatches: matches.slice(1)
    })
  } catch (error) {
    console.error("Matching error:", error)
    res.status(500).render("matching", {
      antwoorden: parseAntwoorden(req.body.antwoorden),
      bestMatch: null,
      otherMatches: [],
      error: "Er ging iets mis bij het ophalen van matches."
    })
  }
})

app.post("/register", async (req, res) => {
  try {
    const { vnaam, anaam, email, wwoord } = req.body
    const sanitizedVnaam = sanitizeTextInput(vnaam)
    const sanitizedAnaam = sanitizeTextInput(anaam)
    const sanitizedEmail = sanitizeTextInput(email).toLowerCase()

    const formData = {
      vnaam: sanitizedVnaam,
      anaam: sanitizedAnaam,
      email: sanitizedEmail
    }

    if (!sanitizedVnaam || !sanitizedAnaam || !sanitizedEmail || !wwoord) {
      return res.status(400).render("register", {
        error: "Vul alle velden in.",
        formData
      })
    }

    if (!validator.isEmail(sanitizedEmail)) {
      return res.status(400).render("register", {
        error: "Voer een geldig e-mailadres in.",
        formData
      })
    }

    const emailDomain = sanitizedEmail.split("@")[1].toLowerCase()
    if (!ALLOWED_EMAIL_PROVIDERS.has(emailDomain)) {
      return res.status(400).render("register", {
        error: "Gebruik een ondersteunde mailprovider bijvoorbeeld Gmail of ProtonMail",
        formData
      })
    }

    const providerOk = await hasValidMailProvider(sanitizedEmail)
    if (!providerOk) {
      return res.status(400).render("register", {
        error: "Deze mailprovider heeft geen geldige MX-records.",
        formData
      })
    }

    const hashedPassword = await bcrypt.hash(wwoord, SALT_ROUNDS)

    const user = {
      voornaam: sanitizedVnaam,
      achternaam: sanitizedAnaam,
      email: sanitizedEmail,
      wachtwoord: hashedPassword,
      watchlist: [],
      recentlyWatched: [],
      createdAt: new Date()
    }

    await db.collection(USERS_COLLECTION).insertOne(user)

    return res.redirect("/login")
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).render("register", {
        error: "Dit e-mailadres is al geregistreerd.",
        formData: {
          vnaam: sanitizeTextInput(req.body.vnaam),
          anaam: sanitizeTextInput(req.body.anaam),
          email: sanitizeTextInput(req.body.email).toLowerCase()
        }
      })
    }

    console.error("Register error:", error)
    return res.status(500).render("register", {
      error: "Er ging iets mis bij registreren.",
      formData: {
        vnaam: sanitizeTextInput(req.body.vnaam),
        anaam: sanitizeTextInput(req.body.anaam),
        email: sanitizeTextInput(req.body.email).toLowerCase()
      }
    })
  }
})

app.post("/login", async (req, res) => {

  try {
    const { email, wwoord, next } = req.body;
    const sanitizedEmail = sanitizeTextInput(email).toLowerCase();
    const formData = { email: sanitizedEmail };

    if (!sanitizedEmail || !wwoord) {
      return res.status(400).render("login", {
        error: "Vul email en wachtwoord in.",
        formData
      })
    }

    const user = await db.collection(USERS_COLLECTION).findOne({
      email: sanitizedEmail
    })

    if (!user) {
      return res.status(401).render("login", {
        error: "Ongeldige inloggegevens.",
        formData: { email: sanitizedEmail }
      })
    }

    const isPasswordValid = await bcrypt.compare(wwoord, user.wachtwoord)

    if (!isPasswordValid) {
      return res.status(401).render("login", {
        error: "Ongeldige inloggegevens.",
        formData: { email: sanitizedEmail }
      })
    }

    // Zonder session/JWT: alleen redirect bij succesvolle login
    req.session.userId = user._id.toString()

    req.session.save(() => res.redirect(next || '/indexingelogd'));
  } catch (error) {
    console.error("Login error:", error)
    return res.status(500).render("login", {
      error: "Er ging iets mis bij inloggen.",
      formData: { email: sanitizeTextInput(req.body.email).toLowerCase() }
    })
  }
})


// make sure your route is protected (user logged in)
app.post("/watchlist/add", async (req, res) => {
  try {
    const userId = req.session.userId
    const { movieId } = req.body

    // niet ingelogd
    if (!userId) {
      return res.status(401).json({ notLoggedIn: true })
    }

    const { ObjectId } = require("mongodb")

    await db.collection(USERS_COLLECTION).updateOne(
      { _id: new ObjectId(userId) },
      {
        $addToSet: { watchlist: movieId } // voorkomt duplicates
      }
    )

   // blijf op zelfde pagina
    res.redirect(`/movie/${movieId}?added=true`);

  } catch (error) {
    console.error(error);
    res.redirect('back');
  }
});

//Mongo Connection
connectToMongo()
  .then(() => {
    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`)
    })
  })
  .catch((error) => {
    console.error("Failed to start server:", error)
    process.exit(1)
  })

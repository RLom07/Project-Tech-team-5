require("dotenv").config()
 
const express = require("express")
const path = require("path")
const fs = require("node:fs")
const { MongoClient, ServerApiVersion } = require("mongodb")
const xss = require("xss")
const multer = require("multer")
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

const DEFAULT_PROFILE_PHOTO = "/images/defaultpf.jpg"
const PROFILE_PHOTO_UPLOAD_DIR = path.join(__dirname, "public", "uploads", "profielen")
fs.mkdirSync(PROFILE_PHOTO_UPLOAD_DIR, { recursive: true })
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
])


const profilePhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PROFILE_PHOTO_UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg"
    cb(null, `user-${req.session.userId}-${Date.now()}${safeExt}`)
  }
})

const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Alleen JPG, PNG, WEBP of GIF zijn toegestaan."))
    }
    cb(null, true)
  }
})


const REVIEWS_COLLECTION = "reviews"
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
    return res.redirect("/indexingelogd")
  }

  const movies = await getPopularMovies();
  const reviews = await db.collection(REVIEWS_COLLECTION).find().toArray();
  res.render('index', { movies, reviews, currentUserId: null });
});

// API index populair movies /////////////////////////////////
async function getPopularMovies() {

  const url = `${process.env.BASE_URL}/trending/movie/week?api_key=${process.env.API_KEY}`

  const response = await fetch(url)
  const data = await response.json()

  return data.results.slice(0, 5) // eerste 5 films
}

//oefenen review pagina
//read- haalt de reviews op

//Create- nieuwe review toevoegen
app.post("/reviews", async (req, res) => {

    if (!req.session.userId) {
    return res.redirect("/login?next=/review")
  }
  
  const { voornaam, name, text, rating } = req.body

  const sanitizedVoornaam = sanitizeTextInput(voornaam)
  const sanitizedname = sanitizeTextInput(name)
  const sanitizedtext = sanitizeTextInput(text)
  const nummerRating = Number(rating)

  if (!sanitizedVoornaam || !sanitizedname || !sanitizedtext || !rating) {
    return res.status(400).json({error:"vul alle velden in."})
  }

  if (isNaN(nummerRating) || nummerRating < 1 || nummerRating > 5) {
  return res.status(400).json({ error: "vul een getal tussen 1 en 5 in." })
  }
  
  const newReview = {
    userId: req.session.userId,
    voornaam: sanitizedVoornaam,
    name: sanitizedname,
    text: sanitizedtext,
    rating: nummerRating,
  }

  await db.collection(REVIEWS_COLLECTION).insertOne(newReview)
  res.redirect('/');
}); 

//delete van een review

app.post('/reviews/:id/delete', async (req, res) => {
  const { ObjectId } = require("mongodb")

  if (!req.session || !req.session.userId) {
    return res.redirect('/login')
  }

  const review = await db.collection(REVIEWS_COLLECTION).findOne({
    _id: new ObjectId(req.params.id)
  })

  if (!review) {
    return res.redirect('/indexingelogd')
  }

  if (review.userId !== req.session.userId) {
    return res.status(403).send("Niet toegestaan")
  }

  await db.collection(REVIEWS_COLLECTION).deleteOne({
    _id: new ObjectId(req.params.id)
  })

  res.redirect('/indexingelogd')
})

app.get('/indexingelogd', async (req, res) => {
  const { ObjectId } = require("mongodb")

  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }

  const gebruiker = await db.collection(USERS_COLLECTION).findOne({
    _id: new ObjectId(req.session.userId)
  })

  const movies = await getPopularMovies();
  const reviews = await db.collection(REVIEWS_COLLECTION).find().toArray();
  res.render('indexingelogd', { movies, reviews, gebruiker, currentUserId: req.session.userId });
});

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
app.get("/movie/:id", async (req, res) => {
  
  const movieId = parseInt(req.params.id);

  let gebruiker = null;
  let isInWatchlist = false;
  let isInFavorites = false;
  let isInWatched = false;

  if (req.session.userId) {
    const { ObjectId } = require('mongodb');

    gebruiker = await db.collection(USERS_COLLECTION).findOne({
      _id: new ObjectId(req.session.userId)
    });

    if (gebruiker) {
      isInWatchlist = gebruiker.watchlist?.includes(movieId);
      isInFavorites = gebruiker.favorites?.includes(movieId);
      isInWatched = gebruiker.recentlyWatched?.includes(movieId);
    }
  }


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
    gebruiker,
    isInFavorites,
    isInWatchlist,
    isInWatched
  });

})

app.post('/favorites/toggle', async (req, res) => {
  try {
    const userId = req.session.userId;
    const movieId = parseInt(req.body.movieId);

  if (!userId) {
    req.session.redirectTo = `/movie/${movieId}`;
    return res.redirect('/login');
  }

    const { ObjectId } = require('mongodb');

    const gebruiker = await db.collection(USERS_COLLECTION).findOne({
      _id: new ObjectId(userId)
    });

    const zitErin = gebruiker.favorites?.includes(movieId);

    if (zitErin) {
      await db.collection(USERS_COLLECTION).updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { favorites: movieId } }
      );
    } else {
      await db.collection(USERS_COLLECTION).updateOne(
        { _id: new ObjectId(userId) },
        { $addToSet: { favorites: movieId } }
      );
    }

    res.redirect(`/movie/${movieId}`);

  } catch (error) {
    console.error(error);
    res.redirect('back');
  }
});

app.post('/watchlist/toggle', async (req, res) => {
  try {
    const userId = req.session.userId;
    const movieId = parseInt(req.body.movieId);

  if (!userId) {
    req.session.redirectTo = `/movie/${movieId}`;
    return res.redirect('/login');
  }

    const { ObjectId } = require('mongodb');

    const gebruiker = await db.collection(USERS_COLLECTION).findOne({
      _id: new ObjectId(userId)
    });

    const zitErin = gebruiker.watchlist?.includes(movieId);

    if (zitErin) {
      // verwijderen
      await db.collection(USERS_COLLECTION).updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { watchlist: movieId } }
      );
    } else {
      // toevoegen
      await db.collection(USERS_COLLECTION).updateOne(
        { _id: new ObjectId(userId) },
        { $addToSet: { watchlist: movieId } }
      );
    }

    res.redirect(`/movie/${movieId}`);

  } catch (error) {
    console.error(error);
    res.redirect('back');
  }
});

app.post('/recentlyWatched/toggle', async (req, res) => {
  try {
    const userId = req.session.userId;
    const movieId = parseInt(req.body.movieId);

  if (!userId) {
    req.session.redirectTo = `/movie/${movieId}`;
    return res.redirect('/login');
  }

    const { ObjectId } = require('mongodb');

    const gebruiker = await db.collection(USERS_COLLECTION).findOne({
      _id: new ObjectId(userId)
    });

    const zitErin = gebruiker.recentlyWatched?.includes(movieId);

    if (zitErin) {
      // verwijderen
      await db.collection(USERS_COLLECTION).updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { recentlyWatched: movieId } }
      );
    } else {
      // toevoegen
      await db.collection(USERS_COLLECTION).updateOne(
        { _id: new ObjectId(userId) },
        { $addToSet: { recentlyWatched: movieId } }
      );
    }

    res.redirect(`/movie/${movieId}`);

  } catch (error) {
    console.error(error);
    res.redirect('back');
  }
});

 
app.get("/profile", async (req, res) => { 
  try {
    // Check if user is logged in
    if (!req.session.userId) {
      return res.redirect("/login")
    }

    const { ObjectId } = require("mongodb")

    if (!req.session.userId) {
      return res.redirect('/login');
    }

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

    const favorites = []
    const watchlist = []
    const recentlyWatched = []

    for (const movieId of gebruiker.favorites) {
      const url = `${process.env.BASE_URL}/movie/${movieId}?api_key=${process.env.API_KEY}`
      const response = await fetch(url)
      const movie = await response.json()
      favorites.push(movie)
    }

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
    res.render("profile", { 
      gebruiker, 
      greeting, 
      movies, 
      recentlyWatched, 
      watchlist,
      favorites
    })

  } catch (error) {  
    console.error("Error fetching profile:", error)

    res.status(500).send("Internal Server Error")
  }
})

app.delete("/favorites/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb")
    const userId = req.session.userId
    const movieId = parseInt(req.params.id)

    console.log("DELETE hit", { userId, movieId })

    if (!userId) return res.sendStatus(401)

    const result = await db.collection(USERS_COLLECTION).updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { favorites: movieId } }
    )

    console.log("MongoDB result:", result)

    if (result.modifiedCount > 0) {
      res.sendStatus(200)
    } else {
      res.status(404).send("Movie not found in favorites")
    }
  } catch (err) {
    console.error("Error removing movie:", err)
    res.sendStatus(500)
  }
})

app.delete("/watchlist/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb")
    const userId = req.session.userId
    const movieId = parseInt(req.params.id)

    if (!userId) return res.sendStatus(401)

    const result = await db.collection(USERS_COLLECTION).updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { watchlist: movieId } }
    )

    if (result.modifiedCount > 0) {
      res.sendStatus(200)
    } else {
      res.status(404).send("Movie not found in watchlist")
    }
  } catch (err) {
    console.error("Error removing movie:", err)
    res.sendStatus(500)
  }
})

app.get("/profielaanpassen", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login?next=/profielaanpassen")
  }

  try {
    const { ObjectId } = require("mongodb")

    const gebruiker = await db.collection(USERS_COLLECTION).findOne(
      { _id: new ObjectId(req.session.userId) },
      { projection: { voornaam: 1, achternaam: 1, email: 1, profielfoto: 1 } }
    )

    if (!gebruiker) {
      return res.redirect("/login")
    }

    const profielFotoSrc =
      typeof gebruiker.profielfoto === "string" && gebruiker.profielfoto.trim()
        ? gebruiker.profielfoto.trim()
        : DEFAULT_PROFILE_PHOTO

      const errorMessages = {
      invalid_email: "Voer een geldig e-mailadres in.",
      unsupported_provider: "Gebruik een ondersteunde mailprovider.",
      invalid_mx: "Deze mailprovider heeft geen geldige MX-records.",
      email_taken: "Dit e-mailadres is al in gebruik."
    }

    const updateError = errorMessages[req.query.error] || null
    const updateSuccess = req.query.updated === "1"

    res.render("profielaanpassen", { gebruiker, profielFotoSrc, updateError, updateSuccess })
  } catch (error) {
    console.error("Error fetching profielaanpassen data:", error)
    res.status(500).send("Internal Server Error")
  }
})


app.post("/profielaanpassen/profielfoto", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Niet ingelogd." })
  }

  uploadProfilePhoto.single("profielfoto")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Bestand is te groot (max 5MB)." })
      }
      return res.status(400).json({ error: "Upload mislukt." })
    }

    if (err) {
      return res.status(400).json({ error: err.message || "Upload mislukt." })
    }

    if (!req.file) {
      return res.status(400).json({ error: "Geen bestand ontvangen." })
    }

    try {
      const { ObjectId } = require("mongodb")
      const profielFotoSrc = `/uploads/profielen/${req.file.filename}`

      await db.collection(USERS_COLLECTION).updateOne(
        { _id: new ObjectId(req.session.userId) },
        { $set: { profielfoto: profielFotoSrc } }
      )

      return res.status(200).json({ success: true, profielFotoSrc })
    } catch (error) {
      console.error("Error uploading profielfoto:", error)
      return res.status(500).json({ error: "Interne serverfout." })
    }
  })
})


app.post("/profielaanpassen/update", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login?next=/profielaanpassen")
  }

  try {
    const { ObjectId } = require("mongodb")
    const { vnaam, anaam, email, wwoord } = req.body

    const updates = {}

    const sanitizedVnaam = sanitizeTextInput(vnaam)
    if (sanitizedVnaam) {
      updates.voornaam = sanitizedVnaam
    }

    const sanitizedAnaam = sanitizeTextInput(anaam)
    if (sanitizedAnaam) {
      updates.achternaam = sanitizedAnaam
    }

    const sanitizedEmail = sanitizeTextInput(email).toLowerCase()
    if (sanitizedEmail) {
      if (!validator.isEmail(sanitizedEmail)) {
        return res.redirect("/profielaanpassen?error=invalid_email")
      }

      const emailDomain = sanitizedEmail.split("@")[1].toLowerCase()
      if (!ALLOWED_EMAIL_PROVIDERS.has(emailDomain)) {
        return res.redirect("/profielaanpassen?error=unsupported_provider")
      }

      const providerOk = await hasValidMailProvider(sanitizedEmail)
      if (!providerOk) {
        return res.redirect("/profielaanpassen?error=invalid_mx")
      }

      updates.email = sanitizedEmail
    }

    if (typeof wwoord === "string" && wwoord.trim()) {
      updates.wachtwoord = await bcrypt.hash(wwoord, SALT_ROUNDS)
    }

    if (Object.keys(updates).length === 0) {
      return res.redirect("/profielaanpassen")
    }

    await db.collection(USERS_COLLECTION).updateOne(
      { _id: new ObjectId(req.session.userId) },
      { $set: updates }
    )

    return res.redirect("/profielaanpassen?updated=1")
  } catch (error) {
    if (error.code === 11000) {
      return res.redirect("/profielaanpassen?error=email_taken")
    }

    console.error("Error updating profiel:", error)
    return res.status(500).send("Internal Server Error")
  }
})


app.post("/profielaanpassen/verwijder-account", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login")
  }

  try {
    const { ObjectId } = require("mongodb")
    const userId = req.session.userId

    const gebruiker = await db.collection(USERS_COLLECTION).findOne(
      { _id: new ObjectId(userId) },
      { projection: { profielfoto: 1 } }
    )

    await db.collection(USERS_COLLECTION).deleteOne({ _id: new ObjectId(userId) })

    if (
      gebruiker &&
      typeof gebruiker.profielfoto === "string" &&
      gebruiker.profielfoto.startsWith("/uploads/profielen/")
    ) {
      const relativePath = gebruiker.profielfoto.replace(/^\/+/, "")
      const absolutePath = path.resolve(__dirname, "public", relativePath)
      const uploadRoot = path.resolve(PROFILE_PHOTO_UPLOAD_DIR)

      if (absolutePath.startsWith(uploadRoot + path.sep)) {
        await fs.promises.unlink(absolutePath).catch(() => {})
      }
    }

    req.session.destroy(() => {
      res.clearCookie("connect.sid")
      return res.redirect("/")
    })
  } catch (error) {
    console.error("Error deleting account:", error)
    return res.status(500).send("Internal Server Error")
  }
})


app.get("/register", (req, res) => {
  res.render("register", { error: null, formData: {} })
})

app.get("/login", (req, res) => {
  res.render("login", { error: null, formData: {}, next: req.query.next || "" })
})

app.get("/uitloggen", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid")
    res.redirect("/")
  })
})

app.get("/review", (req, res) => { 
    if (!req.session.userId) {
      return res.redirect("/login?next=/review")
  }

  res.render("review")
})


app.get("/vragenlijst", (req, res) => { res.render("vragenlijst") })
 
app.get("/vragenlijst-vraag1", (req, res) => { res.render("vragenlijst-vraag1") })

app.get("/vragenlijst-vraag2", (req, res) => { res.render("vragenlijst-vraag2") })
 
app.get("/vragenlijst-vraag3", (req, res) => { res.render("vragenlijst-vraag3") })

app.get("/vragenlijst-vraag4", (req, res) => { res.render("vragenlijst-vraag4")})

app.get("/vragenlijst-vraag5", (req, res) => { res.render("vragenlijst-vraag5")})

app.get("/vragenlijst-vraag6", (req, res) => { res.render("vragenlijst-vraag6")})

app.get("/matching", (req, res) => {
  res.render("matching", { bestMatch: null, otherMatches: [] })
})
 

// Posts
app.post("/matching", async (req, res) => {
  try {
    const antwoorden = parseAntwoorden(req.body.antwoorden)
    const matches = await getMatchingMovies(antwoorden)

    res.render("matching", {
      bestMatch: matches[0] || null,
      otherMatches: matches.slice(1)
    })
  } catch (error) {
    console.error("Matching error:", error)
    res.status(500).render("matching", {
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
      profielfoto: DEFAULT_PROFILE_PHOTO,
      watchlist: [],
      recentlyWatched: [],
      favorites: [],
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
    const safeNext = typeof next === "string" ? next : ""
    const sanitizedEmail = sanitizeTextInput(email).toLowerCase();
    const formData = { email: sanitizedEmail };

    if (!sanitizedEmail || !wwoord) {
      return res.status(400).render("login", {
        error: "Vul email en wachtwoord in.",
        formData,
        next: safeNext
      })
    }

    const user = await db.collection(USERS_COLLECTION).findOne({
      email: sanitizedEmail
    })

    if (!user) {
      return res.status(401).render("login", {
        error: "Ongeldige inloggegevens.",
        formData: { email: sanitizedEmail },
        next: safeNext
      })
    }

    const isPasswordValid = await bcrypt.compare(wwoord, user.wachtwoord)

    if (!isPasswordValid) {
      return res.status(401).render("login", {
        error: "Ongeldige inloggegevens.",
        formData: { email: sanitizedEmail },
        next: safeNext
      })
    }

    // Zonder session/JWT: alleen redirect bij succesvolle login
    req.session.userId = user._id.toString()

    req.session.save(() => res.redirect(safeNext || '/indexingelogd'));
  } catch (error) {
    console.error("Login error:", error)
    return res.status(500).render("login", {
      error: "Er ging iets mis bij inloggen.",
      formData: { email: sanitizeTextInput(req.body.email).toLowerCase() },
      next: typeof req.body?.next === "string" ? req.body.next : ""
    })
  }
})



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

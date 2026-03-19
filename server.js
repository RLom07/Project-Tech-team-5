require('dotenv').config()
 
const express = require('express')
const path = require('path')
const { MongoClient, ServerApiVersion } = require('mongodb')
const xss = require('xss')
const app = express()
const port = process.env.PORT || 3000
const validator = require('validator');
const dns = require('node:dns/promises');
const session = require('express-session')

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
const ALLOWED_EMAIL_PROVIDERS = new Set([
  'gmail.com',
  'googlemail.com',
  'proton.me',
  'passmail.net',
  'passmail.com',
  'passinbox.com',
  'passfwd.com',
  'protonmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'yahoo.com',
  'hva.nl'
]);
let db;

function sanitizeTextInput(value) {
  if (typeof value !== 'string') return '';

  return xss(value, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
  }).trim();
}

async function connectToMongo() {
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  db = client.db(process.env.DB_NAME);

  // Zorg dat email uniek is
  await db.collection(USERS_COLLECTION).createIndex({ email: 1 }, { unique: true });

  console.log(`Connected to MongoDB database: ${process.env.DB_NAME}`);
}

async function hasValidMailProvider(email) {
  if (!validator.isEmail(email)) return false;

  const domain = email.split('@')[1].toLowerCase();

  try {
    const mx = await dns.resolveMx(domain);
    return mx.length > 0;
  } catch {
    return false;
  }
}

//API//////////////////////////////
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();

  } catch (error) {
    console.error('TMDB fetch error:', error.message);
  }
}

fetchData(`${process.env.BASE_URL}/movie/popular?api_key=${process.env.API_KEY}`);
// console.log(`${process.env.BASE_URL}/movie/popular?api_key=${process.env.API_KEY}`)
//Starter endpoints that can be used
// /movie/popular?

// /trending/movie/day?

// /search/movie?

// /movie/top_rated?
//////////////////////////////////// 
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use('/static', express.static(path.join(__dirname, 'static')))
app.use(express.static("static"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }))

app.use(session({
  secret: 'ditistest',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60000 * 60
  }
}))
 


//Routes
 
app.get('/', (req, res) => { res.render('index') })
 

app.get('/profielaanpassen', (req, res) => { res.render(`profielaanpassen`) })
app.get('/profile', async (req, res) => { 
  try {
    
    const { ObjectId } = require('mongodb');

    const gebruiker = await db.collection(USERS_COLLECTION).findOne({
      _id: new ObjectId(req.session.userId)
    }); 
                
    const hour = new Date().getHours();
    let greeting;

    if (hour < 12) {
        greeting = "Goedemorgen";
    } else if (hour < 18) {
        greeting = "Goedemiddag";
    } else {
        greeting = "Goedenavond";
    }

    const movies = await getPopularMovies()

    req.session.visited = true;
    // 3. Pass the data object as the second argument to res.render
    res.render('profile',  { gebruiker, greeting, movies }) 

  } catch (error) {  
    console.error("Error fetching profile:", error);

    res.status(500).send("Internal Server Error");
  }
});

app.get('/register', (req, res) => {
  res.render('register', { error: null, formData: {} });
})

app.get('/login', (req, res) => {
  res.render('login', { error: null, formData: {} });
})

app.get('/uitloggen', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

app.get('/vragenlijst', (req, res) => { res.render(`vragenlijst`) })
 
app.get('/vragenlijst-vraag1', (req, res) => { res.render(`vragenlijst-vraag1`) })

app.get('/vragenlijst-vraag2', (req, res) => { res.render(`vragenlijst-vraag2`) })
 
app.get('/vragenlijst-vraag3', (req, res) => { res.render(`vragenlijst-vraag3`) })

app.get('/vragenlijst-vraag4', (req, res) => { res.render(`vragenlijst-vraag4`)})

app.get('/vragenlijst-vraag5', (req, res) => { res.render(`vragenlijst-vraag5`)})

app.get('/vragenlijst-vraag6', (req, res) => { res.render(`vragenlijst-vraag6`)})
 

// Posts
app.post('/register', async (req, res) => {
  try {
    const { vnaam, anaam, email, wwoord } = req.body;
    const sanitizedVnaam = sanitizeTextInput(vnaam);
    const sanitizedAnaam = sanitizeTextInput(anaam);
    const sanitizedEmail = sanitizeTextInput(email).toLowerCase();

    const formData = {
      vnaam: sanitizedVnaam,
      anaam: sanitizedAnaam,
      email: sanitizedEmail
    };

    if (!sanitizedVnaam || !sanitizedAnaam || !sanitizedEmail || !wwoord) {
      return res.status(400).render('register', {
        error: 'Vul alle velden in.',
        formData
      });
    }

    if (!validator.isEmail(sanitizedEmail)) {
      return res.status(400).render('register', {
        error: 'Voer een geldig e-mailadres in.',
        formData
      });
    }

    const emailDomain = sanitizedEmail.split('@')[1].toLowerCase();
    if (!ALLOWED_EMAIL_PROVIDERS.has(emailDomain)) {
      return res.status(400).render('register', {
        error: 'Gebruik een ondersteunde mailprovider bijvoorbeeld Gmail of ProtonMail',
        formData
      });
    }

    const providerOk = await hasValidMailProvider(sanitizedEmail);
    if (!providerOk) {
      return res.status(400).render('register', {
        error: 'Deze mailprovider heeft geen geldige MX-records.',
        formData
      });
    }

    const hashedPassword = await bcrypt.hash(wwoord, SALT_ROUNDS);

    const user = {
      voornaam: sanitizedVnaam,
      achternaam: sanitizedAnaam,
      email: sanitizedEmail,
      wachtwoord: hashedPassword,
      watchlist: [],
      recentlyWatched: [],
      profielFoto: "/images/defaultpf.jpg",
      createdAt: new Date()
    };

    await db.collection(USERS_COLLECTION).insertOne(user);

    return res.redirect('/login');
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).render('register', {
        error: 'Dit e-mailadres is al geregistreerd.',
        formData: {
          vnaam: sanitizeTextInput(req.body.vnaam),
          anaam: sanitizeTextInput(req.body.anaam),
          email: sanitizeTextInput(req.body.email).toLowerCase()
        }
      });
    }

    console.error('Register error:', error);
    return res.status(500).render('register', {
      error: 'Er ging iets mis bij registreren.',
      formData: {
        vnaam: sanitizeTextInput(req.body.vnaam),
        anaam: sanitizeTextInput(req.body.anaam),
        email: sanitizeTextInput(req.body.email).toLowerCase()
      }
    });
  }
});

app.post('/login', async (req, res) => {

  try {
    const { email, wwoord } = req.body;
    const sanitizedEmail = sanitizeTextInput(email).toLowerCase();
    const formData = { email: sanitizedEmail };

    if (!sanitizedEmail || !wwoord) {
      return res.status(400).render('login', {
        error: 'Vul email en wachtwoord in.',
        formData
      });
    }

    const user = await db.collection(USERS_COLLECTION).findOne({
      email: sanitizedEmail
    });

    if (!user) {
      return res.status(401).render('login', {
        error: 'Ongeldige inloggegevens.',
        formData: { email: sanitizedEmail }
      });
    }

    const isPasswordValid = await bcrypt.compare(wwoord, user.wachtwoord);

    if (!isPasswordValid) {
      return res.status(401).render('login', {
        error: 'Ongeldige inloggegevens.',
        formData: { email: sanitizedEmail }
      });
    }

    // Zonder session/JWT: alleen redirect bij succesvolle login
    req.session.userId = user._id.toString();

    req.session.save(() => res.redirect('/profile'));
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).render('login', {
      error: 'Er ging iets mis bij inloggen.',
      formData: { email: sanitizeTextInput(req.body.email).toLowerCase() }
    });
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

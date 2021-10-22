// server.js
// where your node app starts

// init project
require('dotenv').config();
var express = require('express');
var app = express();
const dns = require('dns').promises
const bodyParser = require('body-parser')
const url = require('url')
const uuid = require('uuid')

// enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
// so that your API is remotely testable by FCC 
var cors = require('cors');
app.use(cors({optionsSuccessStatus: 200}));  // some legacy browsers choke on 204

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

app.use((req, res, next) => {
  console.log(req.method, ':', req.originalUrl);
  next()
})

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (req, res) {
  res.sendFile(__dirname + '/views/index.html');
});


// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});

// Request Header Parser Microservice

app.get('/api/whoami', (req, res) => {
  // A request to /api/whoami should return a JSON object with your IP address in the ipaddress key.
  // A request to /api/whoami should return a JSON object with your preferred language in the language key.
  // A request to /api/whoami should return a JSON object with your software in the software key.
  res.json({
    ipaddress: req.ip,
    language: req.headers['accept-language'] || '',
    software: req.headers['user-agent'] || '',
  })
})

// URL Shortener Microservice

const SHORT_URLS = { counter: 0 };
function shortenURL(url) {
  if (!(url in SHORT_URLS)) {
    SHORT_URLS.counter += 1
    let id = SHORT_URLS.counter.toString(16);
    SHORT_URLS[id] = url
    SHORT_URLS[url] = id
  }

  return SHORT_URLS[url]
}
app.post('/api/shorturl', bodyParser.urlencoded({ extended: false}), async (req, res) => {

  const { url: urlToShort } = req.body
  
  try {
    if(!/^https?:\/\/.+/.test(urlToShort))
      throw 'Invalid URL'

    if (!/^https?:\/\/localhost.*/.test(urlToShort)) {
      const hostName = new url.URL(urlToShort).hostname
      await dns.lookup(hostName)
    }

    res.send({
      original_url : urlToShort, 
      short_url : shortenURL(urlToShort)
    })
  } catch (err) {
    console.log(err);
    res.json({ error: 'Invalid URL'})
  }
})

app.get('/api/shorturl/:short', (req, res) => {
  const {short: shortURL} = req.params
  if (!shortURL)
    res.json({ error: 'Invalid short URL' })
  else {
    const decodedURL = SHORT_URLS[shortURL]
    if (!decodedURL)
      res.json({ error: 'Invalid short URL' })
    else 
      res.redirect(decodedURL)
  }
})

// Timestamp Microservice

const INVALID_DATE_RESPONSE = { error: 'Invalid Date' };

function parseDate(date) {
  if (!date)
    return new Date()
  else if (/^\d+$/.test(date))
    return new Date(+date)
  else 
    return new Date(date)
}

app.get('/api/time/:date?', (req, res) => {
  console.log(req.params);
  const { date } = req.params
  // NOTE JS date is in MILIseconds while UNIX time is in seconds

  const parsedDate = parseDate(date)

  if (parsedDate.toString() !== "Invalid Date") {
    // looks like a valid date
    res.json({
      unix: parsedDate.getTime(),
      utc: parsedDate.toUTCString()
    })
  } else {
    res.json(INVALID_DATE_RESPONSE)
  }
})

// Exercise Tracker

const users = {}
const exercises = {}

const usersRouter = express.Router()

// register form data parser fot this router
usersRouter.use(bodyParser.urlencoded({ extended: false }))

// create user
usersRouter.post('/', (req, res) => {
  const { username } = req.body

  const _id = uuid.v4();
  const newUser = { username, _id }
  users[_id] = newUser

  res.json(newUser)
})

// get all users
usersRouter.get('/', (_,res) => {
  res.json(Object.values(users))
})

// post an exercise
usersRouter.post('/:_id/exercises', (req, res) => {
  const { _id } = req.params
  const user = users[_id]

  if (user) {

    const {
      duration, description,
      date = new Date().getTime()
    } = req.body

    const exerc = { ...user, 
      description: String(description),
      duration: Number(duration),
      date: new Date(date).getTime()
    }

    if (!(_id in exercises))
      exercises[_id] = []

    exercises[_id].push(exerc)

    res.json({
      ...exerc,
      date: new Date(exerc.date).toDateString()
    })
  }
})

function parseDateParam(date) {
  if (!date)  return;

  date = new Date(date)
  if (date.toString().toLowerCase() !== 'invalid date') {
    return date.getTime()
  }
  else
    return
}

function parseLimitParam(limit) {
  if (!limit) return;
  limit = Number(limit)
  if (isNaN(limit))
    limit = Infinity

  return limit
}

function formatExerc(x) {
  return ({ 
    description: x.description, 
    date: new Date(x.date).toDateString(), 
    duration: x.duration 
  })
}

// process request to a filtered logs
usersRouter.get('/:id/logsss', (req, res, next) => {
  console.log('query', req.query);
  if (Object.keys(req.query).length === 0) {
    // passing control to the next middleware in this stack
    console.log('next middleware');
    next()
  }
  else {
    const { id } = req.params

    let log = exercises[id]

    const from = parseDateParam(req.query.from),
      to = parseDateParam(req.query.to),
      limit = parseLimitParam(req.query.limit);

    console.log(from, to, limit);

    if (from) log = log.filter(x => x.date >= from )
    if (to)   log = log.filter(x => x.date <= to)
    if (limit)log = log.slice(0, limit)

    res.json(log.map(formatExerc))
    // passing control to the next route
    console.log('next route');
    next('route')
  }
}, 
// next middleware in stack returns all logs
// for a give user
(req, res, next) => {
  const { id } = req.params

  const user = users[id]
  const execs = exercises[id]

  log = execs.map(formatExerc)
  console.log('get all logs');
  res.json({ 
    ...user,
    count: execs.length,
    log
  })
})

usersRouter.get('/:id/logs', (req, res) => {
  const { id } = req.params

  let log = exercises[id]

  const from = parseDateParam(req.query.from),
    to = parseDateParam(req.query.to),
    limit = parseLimitParam(req.query.limit);

  if (from || to || limit) {
    console.log('get filtered log');
    if (from) log = log.filter(x => x.date >= from )
    if (to)   log = log.filter(x => x.date <= to)
    if (limit)log = log.slice(0, limit)
  } 

  res.json({ 
    ...users[id],
    count: log.length,
    log: log.map(formatExerc)
  })
})

app.use('/api/users', usersRouter)

// listen for requests :)
var listener = app.listen(process.env.PORT || 3000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

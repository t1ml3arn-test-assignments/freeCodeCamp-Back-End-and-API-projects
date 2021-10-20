// server.js
// where your node app starts

// init project
require('dotenv').config();
var express = require('express');
var app = express();
const dns = require('dns').promises
const bodyParser = require('body-parser')
const url = require('url')

// enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
// so that your API is remotely testable by FCC 
var cors = require('cors');
app.use(cors({optionsSuccessStatus: 200}));  // some legacy browsers choke on 204

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

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

// listen for requests :)
var listener = app.listen(process.env.PORT || 3000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

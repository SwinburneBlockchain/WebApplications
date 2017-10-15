var express = require('express');
var app = express();
var MongoClient = require('mongodb').MongoClient
var request = require("request");
var NodeRSA = require('node-rsa');
var router = express.Router();
var bodyParser = require('body-parser');

var locationServers = [
  ['-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA06xM2/v5p8y2ll83Fo1p6lCUl7yMxWMLBleXdOOCpbVykXGfANaJd8rM/ZFQRTN13nxkXOC20BQwzCSYIU0GvpFzTNHF9oPVsGKu3u/7LdoqvMqRkF0Cl14OVizJRy+ORS9ZsKfZt48O7ndsBiy79WUkr9Wpp8JDmeEPLNItOpsGolwyszq5XaKZIMTHQsHdNWaL0CzB+1lCP7LnpdOKyHaKgKV686I5ijE/5FpSoEOEhJCV0v2PgXUv/QtdtnHg9WNGnGH4cK3lRmYTJiqAS3YbzqDS5tsMAfU5JnXFd3Hu0CaOC79gdYqf1jYAIBd6jz11q0OBxFYG68aMgk/aUQIDAQAB-----END PUBLIC KEY-----', 'Croydon Hills, Victoria']
];

var url = 'mongodb://localhost:27017';
var db;

MongoClient.connect(url, function (err, database) {
  if (err)
    throw err
    else {
      db = database;
      console.log('VerificationServer - Connected to MongoDB');
    }

  db.createCollection('locationServers', function(error, otherThing) {
   if (error) throw error;
   console.log("VerificationServer - Location Servers Collection Created!");
  });

 locationServers.forEach(function(locationServer) {
   insert = {
     'publicKey': locationServer[0],
     'location': locationServer[1]
   }

   db.collection('locationServers').insert(insert, function(err, doc) {
   });
 });

/*
 var port = process.env.PORT || 3000;
   app.listen(port, function () {
     console.log('VerificationServer - Listening on port 3000...')
   });
*/
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:true}));

router.post('/verifyLocation', function(req, res) {
    console.log("VerificationServer - Location Verify Request" );
    var publicKey = req.body.publicKey;
    var locationProof = req.body.locationProof;

    var collection = db.collection('locationServers');

    collection.findOne({publicKey: publicKey}, function(err, doc) {
      if(doc == null) {
        console.log("VerificationServer - Public Key not found");
      } else {
        var key = new NodeRSA();
        key.importKey(publicKey);

        var validResult = key.verify("VALID_LOCATION", locationProof, "utf8", "hex");

        if(validResult) {
          res.send(validResult + " | " + doc.location);
          console.log("VerificationServer - Verified Location. Results Sent");
        } else {
          res.send(validResult);
          console.log("VerificationServer - Location not verified");
        }
      }
    });
});

module.exports = router;

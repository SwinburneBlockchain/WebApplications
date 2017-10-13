var express = require('express');
var app = express();
var MongoClient = require('mongodb').MongoClient
var request = require("request");
var NodeRSA = require('node-rsa');
var bodyParser = require('body-parser');

var locationServers = [
  ['publicKey', 'location'],
  ['publicKey', 'location']
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

 var port = process.env.PORT || 3000;
   app.listen(port, function () {
     console.log('VerificationServer - Listening on port 3000...')
   });
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:true}));

app.post('/testEncryption', function(req, res) {
  console.log(req.body);
  var privateKey = req.body.privateKey;
  var locationProofMessage = req.body.locationProof;

  var key = new NodeRSA(privateKey);

  var encrypted = key.encrypt(locationProofMessage, 'utf8');
  res.send(encrypted);
});

app.post('/testDecryption', function(req, res) {
  var collection = db.collection('locationServers');
  collection.findOne({publicKey: 'publicKey'}, function(err, doc) {
    if( doc == null ) {
        console.log("Not found in Collection");
    } else {
        console.log("Found in Collection");
    }
  });
  var publicKey = req.body.publicKey;
  var locationProof = req.body.locationProof;
  var key = new NodeRSA(publicKey, 'pkcs8-public');


  var decrypted = key.verify("message", locationProof);

  res.send(decrypted);
});

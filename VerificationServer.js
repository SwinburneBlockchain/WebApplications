/*
  Swinburne Capstone Project - ICT90004
  Aidan Beale & John Humphrys
  https://github.com/SwinburneBlockchain
*/

var express = require('express');
var app = express();
var MongoClient = require('mongodb').MongoClient
var request = require("request");
var NodeRSA = require('node-rsa');
var router = express.Router();
var bodyParser = require('body-parser');
var hash = require('hash.js')

/*
  List of valid bluetooth beacons (location servers)
  Includes RSA public key of each beacon, as well as their location (second item in each array)
  Replace these if new beacon keypairs have been generated
*/
var locationServers = [
  ['-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0EBoDNRYykuSNpqOjyftFGPJ1ZkteoTXLe7QUCiFR7+yx0VwDXJPXXK44hI4vMR2sma05dL+DkrwGlEn5XMoDk2sTZpiNUwK6WD/gjDNHo+TNT8W3vx1taci0sw9ZWTZ0XMwD7xEV35xNOMSd20HeMfP1USITIi/YjsJDgC88IzTm+L+ZQC9ze30w7IqK3aBDpPPOlV1sNUudjpxuyt1eVx21JjaMFFkiO4zbJwra316vjtqvJyrhBGdN7LjSfr8BnqTDUduFIqHJdNhiso8JFnNUIEnWuTg2/c1fC+/7FoHhpW6e4B71g7tHFuOp7r7oFOhoHJl54SGfdj5jQcXKQIDAQAB-----END PUBLIC KEY-----', 'Croydon Hills, Victoria'],
  ['-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzgq25FihX6eaQwCcUZtRHcxQzegRyufiVW70UGV5+sVQy9Vx68ukP/S8beo3M99vrJfkJnObHP7HAFffqn4OBpYYaOPU3xbO021GhSwRxkXLPEtb0/GSa9US89NrG0UnxrYqkQ9aZKTA70mTrhGC1MZPcG2ZcahCUdiZvS1vgIeva6+DjfCjpBqST92LuphW4FMJAqK5rKeiS0y5LNuPHjFNDxBl8w3ARmmuL1QH3Hk/OdIN9iRYvzX+7gepxfXy8jGjrjIZm9cU6AqkhqWEMcPkLbQaBHYh+0lYFdbthCz92bOpY/YIbyI8/WrYXA3dNupc1kpYjiypZVxX0GxWywIDAQAB-----END PUBLIC KEY-----', 'Gold Coast Shops, Queensland'],
  ['-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAopMctwYWwKRB+jY5Lt29BX4LFr5ztGijgMd8ww0PwOkLD6+scirL6U3Grgwaeo6yEO9EhflQJKGUpVNr5hySDBJNrH9Ri2or23dXQcuWWJwOvm2D71Y4RRFmBwKz8y449EzNO/LR9aSMs+TiHF1WyQFA3EaVXdIlKo4bYzR+EcO3dJNw2xTOR0+IpXXN1OM7y4ppbUVYcz+9WmxbsFkO4Lbm/QeQF0FUXfWdlmhCWuWRb6EoRZtnvZR9svwSDxcPMFtncTxd7/DFCgnQB5gtRoWB2imFwa0gG9SBE1i49G0KkWDoUIYD5UgFq/qUUe+bWETOzUV8Ey9woPA14AcBTwIDAQAB-----END PUBLIC KEY-----', 'Pacific Hwy, Sydney']
];

/*
  Default URL of MongoDB.
  Don't change this.
*/
var url = 'mongodb://localhost:27017';
var db;

/*
  Initialises Mongodb database, adds Collection for list of location servers
  Sets port 3000 as API port.
*/
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

// Comment this out if not running on separate servers

 var port = process.env.PORT || 3000;
   app.listen(port, function () {
     console.log('VerificationServer - Listening on port 3000...')
   });

});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:true}));

/*
  Verifies that the location proof associated with a MOVE action is valid.
  Takes in generated hash, the RSA public key, the 'location proof' (signature)
*/
app.post('/verifyLocation', function(req, res) {
    var fullHash = req.body.hash;
    var publicKey = req.body.publicKey;
    var locationProof = req.body.locationProof;
    var timestamp = req.body.timestamp;

    var collection = db.collection('locationServers');
    collection.findOne({publicKey: publicKey}, function(err, doc) {
      if(doc == null) {
        res.send("Public key not found in database");
      } else {
        var calculatedHash = hash.sha256().update(locationProof + ',' + publicKey + ',' + timestamp).digest('hex');

        // Checks if the calculated hash equals the hash given by Producer
        if(calculatedHash == fullHash) {
          var key = new NodeRSA();
          key.importKey(publicKey);

          var validResult = key.verify(timestamp, locationProof, "utf8", "hex");
          if(validResult) {
            res.send(validResult + " | " + doc.location);
          } else {
            res.send(validResult);
          }
        } else {
          res.send("Invalid Hash");
        }
      }
    });
});

module.exports = router;

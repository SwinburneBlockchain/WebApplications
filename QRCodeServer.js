var express = require('express');
var app = express();
var cors = require('cors');
var bodyParser = require('body-parser');
var MongoClient = require('mongodb').MongoClient
var request = require("request");
var randomstring = require("randomstring");
var qr = require('qr-image');
var mongoose = require('mongoose');

// URL of MongoDB
var url = 'mongodb://localhost:27017';

/*
  URL for your Nxt node.
  Change this if neccessary.
*/
var nxtUrl = 'http://ec2-52-64-224-239.ap-southeast-2.compute.amazonaws.com:6876/nxt?';

/*
  URL for Caching Server
  Change this if neccessary.
*/
var cacheServerUrl = 'http://ec2-54-153-202-123.ap-southeast-2.compute.amazonaws.com:3000/';

// Nxt secret phrase of main ProductChain server
var mainSecretPhrase = "curve excuse kid content gun horse leap poison girlfriend gaze poison comfort";

/*
  List of valid producers. Inludes Nxt address, name of Producer, and Producer's location
*/
var validProducers = [
  ['NXT-HP3G-T95S-6W2D-AEPHE', 'ProductChain Server', 'Swinburne Hawthorn, Victoria'],
  ['NXT-QBU9-KSX6-6TH4-H47LR', 'John Egg Farm',       'Croydon Hills, Victoria'],
  ['NXT-MNDK-R2CB-TX4W-AKH4U', 'Aidan Grocery Store', 'Gold Coast Shops, Queensland']
];

/*
  Initialises Mongodb database, and
*/
var db;
MongoClient.connect(url, function (err, database) {
   if (err) {
     throw err
   } else {
     db = database;

     /*
      Loops through validProducers array, and creates a collection for each Producer.
      This is used to ensure only the valid producers (the ones created here)
      can request and update QR codes.
    */
    validProducers.forEach(function(producerArray) {
      db.createCollection("PRODUCER - " + producerArray[0], function(error, otherThing) {
        if (error) throw error;
      });

      insert = {
        '_id': '0',
        'name': producerArray[1],
        'location': producerArray[2]
      }

      db.collection("PRODUCER - " + producerArray[0]).insert(insert, function(err, doc) {
      });

    });
    /*
    // Nxt information on the ProductChain server
    db.createCollection("PRODUCER - NXT-HP3G-T95S-6W2D-AEPHE", function(error, otherThing) {
      if (error) throw error;
    });
    insert = {
      '_id': '0',
      'name': 'ProductChain Server',
      'location': 'Swinburne Hawthorn, Victoria'
    }
    db.collection("PRODUCER - NXT-HP3G-T95S-6W2D-AEPHE").insert(insert, function(err, doc) {
      //if (err) throw err;
    });

    // Create a collection for each of the valid 'Producers'
    db.createCollection("PRODUCER - NXT-QBU9-KSX6-6TH4-H47LR", function(error, otherThing) {
      if (error) throw error;
    });
    insert = {
      '_id': '0',
      'name': 'John Egg Farm',
      'location': 'Croydon Hills, Victoria'
    }
    db.collection("PRODUCER - NXT-QBU9-KSX6-6TH4-H47LR").insert(insert, function(err, doc) {
      //if (err) throw err;
    });

    db.createCollection("PRODUCER - NXT-MNDK-R2CB-TX4W-AKH4U", function(error, otherThing) {
      if (error) throw error;
    });
    insert = {
      '_id': '0',
      'name': 'Aidan Grocery Store',
      'location': 'Gold Coast Shops, Queensland'
    }
    db.collection("PRODUCER - NXT-MNDK-R2CB-TX4W-AKH4U").insert(insert, function(err, doc) {
      //if (err) throw err;
    });
*/

    /*
      Creates port and server starts listening for requests.
    */
    var port = process.env.PORT || 3000;
      app.listen(port, function () {
        console.log('QRCodeServer - Listening on port 3000...')
      });
   }
});

//Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:true}));

//API commands from additional .js files
//app.use(require('./CachingServer'));

//GETTING QR CODE DETAILS
function getQRDetailsFromNxt(cb) {
  var randSecretKey = randomstring.generate(16);

  console.log("Received QR Code request");
  //API Says POST Only??
  const options = {
    method: 'GET',
    uri: nxtUrl,
    json: true,
    qs: {
      requestType: "getAccountId",
      secretPhrase: randSecretKey
    }
  };
  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      cb(body.accountRS, body.publicKey, randSecretKey);
    }
  }
  request(options, callback);
}

function findQRFromNxt(cb, prodAddr) {
  //API Says POST Only??
  const options = {
    method: 'GET',
    uri: nxtUrl,
    json: true,
    qs: {
      requestType: "getBlockchainTransactions",
      account: prodAddr
    }
  };
  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      cb(body.transactions);
    }
  }
  request(options, callback);
}

function validateQR(accAddr, pubKey, privKey, producerAddr) {
  request.post({url:nxtUrl, form: {requestType: 'sendMessage', secretPhrase: mainSecretPhrase, recipient: accAddr, message: 'VALIDATE - ' + producerAddr, deadline: '60', feeNQT: '0'}},
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        // NO NEED TO CREATE COLLECTION OF QR HERE. DONE ON CACHINGSERVER INSTEAD
        // WILL REMOVE LATER
        /*
        db.createCollection(accAddr, function(error, otherThing) {
          if (!error) {
            insert = {
              'action': 'VALIDATE',
              'acc': accAddr,
              'pubKey': pubKey,
              'privKey': privKey
            }
            db.collection(accAddr).insert(insert, function(err, doc) {
              if (err) throw err;
            });
            console.log("New QR Code Collection Created!");

          } else {
            console.log("Error occurred creating QR Code collection...");
            console.log(error);
          }

        });
        */
      } else {
        console.log("Error sending tx...");
        console.log(error);
      }
    }
  );
}

//MOVE QR
function sendToBlockchain(productAddr, prodDestination, producerPubKey, ivKey, productPubKey) {
  console.log("ADVANCED SENDING");
  request.post({url:nxtUrl, form: {requestType: 'sendMessage', secretPhrase: ivKey, recipient: productAddr, recipientPublicKey: productPubKey, message: 'MOVE - ' + prodDestination, deadline: '60', feeNQT: '0'}},
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log("Message sent successfully")
        /*
        insert = {
          'action': 'SEND',
          'sourceAddr': producerPubKey,
          'destAddr': prodDestination
        }
        db.collection(productAddr).insert(insert, function(err, doc) {
          if (err) throw err;
        });
        */
        return true;
      } else {
        console.log("Error sending tx...");
        console.log(error);
        return false;
      }
    }
  );
}

function cacheQRInfo(accAddr, pubKey, privKey, producerAddr, producerPubKey, productName, productId, batchId) {
  console.log('PRODUCER ADDR: ' + producerPubKey);

  db.collection('PRODUCER - ' + producerAddr).find({}).toArray(function(err, result) {
     if (err) throw err;
     result.forEach(function(value) {
       request.post({url:cacheServerUrl + 'cacheQR', form: {qrAddress: accAddr, qrPubKey: pubKey,
               qrPrivKey: privKey, producerAddr: producerAddr, productName: productName,
               productId: productId, batchId: batchId, producerName: value.name, producerLocation: value.location}},
         function (error, response, body) {
           if (!error) {
             console.log("QRCodeServer - QR Code Cached")
           } else {
             console.log("QRCodeServer - Error Caching QR Code");
             console.log(error);
           }
         }
       );
     });
  });
}

//
app.post('/findqr', function (req, res) {
  var prodAddr = req.body.prodAddr;

  findQRFromNxt(function(transactions) {
    console.log("TRANSACTIONS");
    console.log(transactions);
  }, prodAddr);

  console.log("Finding QR Code...");
});

app.post('/moveqr', function (req, res) {
  console.log('QRCodeServer - Product Being Moved');
  var producerPubKey = req.body.pubKey;
  var ivKey = req.body.privKey;
  var productAddr = req.body.prodAddr;
  var productPubKey = req.body.prodPubKey;
  var prodDestination = req.body.destination;

  //prodDestination is set as 'message' in this transaction.
  sendToBlockchain(productAddr, prodDestination, producerPubKey, ivKey, productPubKey)
  res.send("QR code updated successfully.");
});

/*
  Handles the Producer requests for new QR Codes.
  Ensures only valid Producers can request QR codes
*/
app.post('/getqr', function (req, res) {
  console.log("Requesting QR Code...");

  var producerAddr = req.body.accAddr;
  var producerPubKey = req.body.pubKey;
  var productName = req.body.productName;
  var productId = req.body.productID;
  var batchId = req.body.batchID;

  var data = req.body.data;
  var nonce = req.body.nonce;

  request.post({url:nxtUrl, form: {
                requestType: 'decryptFrom',
                secretPhrase: mainSecretPhrase,
                account: producerAddr,
                data: data,
                nonce: nonce
              }},
    function (error, response, body) {
      var bodyJSON = JSON.parse(body);
      if (!error && bodyJSON.decryptedMessage == "requestQR") {
        console.log("QRCodeServer - Valid QR Code Request")

        db.listCollections().toArray(function(err, collInfos) {
          collInfos.forEach(function(value) {
            if(String(value.name) == ('PRODUCER - ' + producerAddr)) {


              getQRDetailsFromNxt(function(accAddr, pubKey, privKey) {
                console.log("QRCodeServer - ------------------");
                console.log("QRCodeServer - Address: " + accAddr);
                console.log("QRCodeServer - Pub Key: " + pubKey);
                console.log("QRCodeServer - Priv Key: " + privKey);
                console.log("QRCodeServer - ------------------");

                validateQR(accAddr, pubKey, privKey, producerAddr);
                cacheQRInfo(accAddr, pubKey, privKey, producerAddr, producerPubKey, productName, productId, batchId);

                qrString = "{\"accAddr\":" + "\"" + accAddr + "\"" + ",\"pubKey\":" + "\"" + pubKey + "\"" + ",\"privKey\":" + "\"" + privKey + "\"" + "}";
                var qrSvgString = qr.imageSync(qrString, {type: 'svg'});

                res.send(qrSvgString);
              });
            }
          });
        });
      } else {
        console.log("QRCodeServer - Invalid Producer Requesting QR Code, or Error with Request.");
        console.log(error);
      }
    }
  );
});

// Remove all Collections from MongoDB
/*
app.get('/removeAll', (req, res) => {
  db.dropDatabase();
})
*/

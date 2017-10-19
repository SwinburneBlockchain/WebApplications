/*
  Swinburne Capstone Project - ICT90004
  Aidan Beale & John Humphrys
  https://github.com/SwinburneBlockchain
*/

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var MongoClient = require('mongodb').MongoClient
var request = require("request");
var randomstring = require("randomstring");
var qr = require('qr-image');

// URL of MongoDB. Only change if MongoDB is in different location to server.
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

/*
  Nxt secret phrase and address of main ProductChain server.
  Change these if required.
*/
var productChainSecretPhrase = "curve excuse kid content gun horse leap poison girlfriend gaze poison comfort";
var productChainAddress = "NXT-HP3G-T95S-6W2D-AEPHE";

/*
  List of valid producers. Inludes Nxt address, name of Producer, and Producer's location(?)
  Change these if required.
*/
var validProducers = [
  ['NXT-HP3G-T95S-6W2D-AEPHE', 'ProductChain Server', 'Swinburne Hawthorn, Victoria'],
  ['NXT-QBU9-KSX6-6TH4-H47LR', 'John Egg Farm',       'Croydon Hills, Victoria'],
  ['NXT-MNDK-R2CB-TX4W-AKH4U', 'Aidan Grocery Store', 'Gold Coast Shops, Queensland'],
  ['NXT-6UBL-T6JL-J35C-2ZV43', 'Freds Sorting Facility', 'Pacific Hwy, Sydney']
];

/*
  Initialises Mongodb database, and adds valid producer Collections
  Sets port 3000 as API port.
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

    db.createCollection('QRCodeRequestTimestamps', function(error, otherThing) {
      if (error) throw error;
    });

    //Creates port and server starts listening for requests.
    var port = process.env.PORT || 3000;
      app.listen(port, function () {
        console.log('QRCodeServer - Listening on port 3000...')
      });
   }
});

//Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:true}));

/*
  API commands from additional .js files.
  Comment this out if running on individual servers.
*/

app.use(require('./CachingServer'));
app.use(require('./VerificationServer'));

/*
  Generates a random string to be used as new QR code's private key.
  Contacts Nxt blockchain and retrieves public key and address associated with private key.
*/
function getQRDetailsFromNxt(cb) {
  var randSecretKey = randomstring.generate(16);

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

/*
  Sends a transaction to generated QR code address, with 'VALIDATE' in the message
  field. This validates the QR code.
*/
function validateQR(accAddr, pubKey, privKey, producerAddr) {
  request.post({url:nxtUrl, form: {requestType: 'sendMessage', secretPhrase: productChainSecretPhrase, recipient: accAddr, message: 'VALIDATE - ' + producerAddr, deadline: '60', feeNQT: '0'}},
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
      } else {
        console.log("QRCodeServer - Error sending tx...");
        console.log(error);
      }
    }
  );
}

/*
  Once QR code has been generated and validated, it is sent to the caching server.
*/
function cacheQRInfo(accAddr, pubKey, privKey, producerAddr, producerPubKey, productName, productId, batchId) {
  console.log('QRCodeServer - Sending QR Code to Caching erver');

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

/*
  Check to see if a timestamp has been linked to a Producer previously.
  Takes in a timestamp and a producer address (Nxt address)
*/
function verifyTimestamp(timestamp, producerAddress) {
  console.log("QRCodeServer - VERIFYING TIMESTAMP");
  var collection = db.collection('QRCodeRequestTimestamps');

  var returnBoolean = "";

  /*
    If it cannot find a timestamp that has been used previously by the given producer, then
    this is a new
  */
  collection.findOne({producerAddress: producerAddress, timestamp: timestamp}, function(err, doc) {
    if(!doc) {
      insert = {
        'producerAddress': producerAddress,
        'timestamp': timestamp
      }

      db.collection('QRCodeRequestTimestamps').insert(insert, function(err, doc) {
      });

      returnBoolean = true;
    } else {
      returnBoolean = false;
    }
  });
  while(returnBoolean === "") {
    require('deasync').runLoopOnce();
  }
  return returnBoolean;
}

/*
  Handles the Producer requests for new QR Codes.
  Ensures only valid Producers can request QR codes by decrypting the message
  sent by the producer.
*/
app.post('/getqr', function (req, res) {
  console.log("QRCodeServer - Producer Requesting QR Code...");

  var producerAddr = req.body.accAddr;
  var producerPubKey = req.body.pubKey;
  var productName = req.body.productName;
  var productId = req.body.productID;
  var batchId = req.body.batchID;

  /*
    Included in the getqr request from a producer is encrypted data and a nonce.
    This is encrypted on the Producer's side, and is used to verify that the request
    came from a valid producer. Data encrypted is a timestamp of the time the Producer
    requested the QR code.
  */
  var timestamp = req.body.timestamp;
  var data = req.body.data;
  var nonce = req.body.nonce;

  /*
    Contacts Nxt node to decrypt message from producer.
    If message can be successfully decrypted using the provided information, then
    QR code is generated and sent back to Producer.
  */
  request.post({url:nxtUrl, form: {
                requestType: 'decryptFrom',
                secretPhrase: productChainSecretPhrase,
                account: producerAddr,
                data: data,
                nonce: nonce
              }},
    function (error, response, body) {
      var bodyJSON = JSON.parse(body);

      /*
        Checks to see if the hash in the message equals the hash of the data sent
        in the message. If so, then checks to see if the encrypted timestamp has
        been previously requested by this producer. If not, then it is a valid request.
      */
      if (!error && bodyJSON.decryptedMessage == timestamp) {
        if(verifyTimestamp(timestamp, producerAddr)) {
            console.log("QRCodeServer - Valid QR Code Request")

            db.listCollections().toArray(function(err, collInfos) {
              collInfos.forEach(function(value) {
                if(String(value.name) == ('PRODUCER - ' + producerAddr)) {
                  getQRDetailsFromNxt(function(accAddr, pubKey, privKey) {
                    console.log("QRCodeServer - ------ QR CODE ------");
                    console.log("QRCodeServer - Address: " + accAddr);
                    console.log("QRCodeServer - Pub Key: " + pubKey);
                    console.log("QRCodeServer - Priv Key: " + privKey);
                    console.log("QRCodeServer - ---------------------");

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
            console.log("QRCodeServer - Could Not Validate Timestamp");
          }
      } else {
        console.log("QRCodeServer - Invalid Producer Requesting QR Code, or Error with Request.");
        console.log(error);
      }
    });
});

/*
  Returns information about valid producers.
  Accessed by the Caching Server.
*/
app.post('/producerInfo', function(req, res) {
  var producerAddr = req.body.producerAddr;
  db.collection('PRODUCER - ' + producerAddr).find({}).toArray(function(err, result) {
    result.forEach(function(value) {
      res.send(value);
    });
  });
});

/*
Remove all Collections from MongoDB.
Comment out this when not required. Only use for administrative purpose (start with fresh Mongodb)
*/
/*
app.get('/removeAll', (req, res) => {
  console.log("QRCodeServer - Dropping Tables");
  db.dropDatabase();
})
*/

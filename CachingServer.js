/*
  Swinburne Capstone Project - ICT90004
  Aidan Beale & John Humphrys
  https://github.com/SwinburneBlockchain
*/

var express = require('express');
var app = express();
var MongoClient = require('mongodb').MongoClient
var request = require("request");
var ObjectId = require('mongodb').ObjectID;
var router = express.Router();
var bodyParser = require('body-parser');

/*
  URL for your Nxt node
  Change this if necessary
*/
var nxtUrl = 'http://ec2-52-64-224-239.ap-southeast-2.compute.amazonaws.com:6876/nxt?';

/*
  URL of your QRCode server and Verification server
  Change these if necessary
*/
var QRCodeServerURL = 'http://ec2-54-153-202-123.ap-southeast-2.compute.amazonaws.com:3000/';
var VerificationServerURL = 'http://ec2-54-153-202-123.ap-southeast-2.compute.amazonaws.com:3000/';

/*
  Nxt address of the ProductChain server. Used to validate new QR codes
  Change if necessary
*/
var productChainAddress = "NXT-HP3G-T95S-6W2D-AEPHE";

/*
  Default URL of MongoDB.
  Don't change this.
*/
var url = 'mongodb://localhost:27017';
var db;

/*
  Initialises Mongodb database. Adds collections for products and hash info
  Sets port 3000 as API port.
*/
MongoClient.connect(url, function (err, database) {
if (err)
  throw err
 else {
   db = database;
   console.log('CachingServer - Connected to MongoDB');
 }

 /*
    This Collection stores the publicly available information regarding
    all product movements. This includes
 */
 db.createCollection('hashInfo', function(error, otherThing) {
   if (error) throw error;
   console.log("CachingServer - Hash Info Collection Created!");
 });

 db.createCollection('products', function(error, otherThing) {
   if (error) throw error;
     console.log("CachingServer - Products Collection Created!");
 });

  // Comment this out if not running on separate servers

  var port = process.env.PORT || 3000;
    app.listen(port, function () {
      console.log('CachingServer - Listening on port 3000...')
    });

});

/*
  Loops through all cached products to find information from Blockchain.
  New information is then placed into the related product Collection.
*/
function updateProducts() {
  db.listCollections().toArray(function(err, collInfos) {
    collInfos.forEach(function(value) {
      var collectionName = value.name;
      var nameArr = collectionName.split(" - ");
      /*
        Contacts the Nxt blockchain node (nxtUrl) and finds all transactions
        related to a specific product ID (Nxt address).
      */
      if(nameArr[0] == 'PRODUCT') {
        const options = {
          method: 'GET',
          uri: nxtUrl,
          json: true,
          qs: {
            requestType: "getBlockchainTransactions",
            account: nameArr[1]
          }
        };
        function callback(error, response, body) {
          if (!error && response.statusCode == 200) {
            var intCount = 1;
            var nextProducer;

            /*
              Goes through list of transactions to a product.
            */
            body.transactions.reverse().forEach(function(value) {
              var arr = value.attachment.message.split(" - ");
              //var txVerified = false;

              /*
                Checks to see if the transaction is a VALIDATE message from the ProductChain
                server. If it is, then it caches the transaction.
              */
              if(arr[0] == "VALIDATE") {
                if(value.senderRS == productChainAddress) {
                  nextProducer = arr[1];

                  /*
                    POST to QRCodeServer to retrieve information related to Producer
                  */
                  request.post({url:QRCodeServerURL + 'producerInfo', form: {producerAddr: arr[1]}},
                  function (error, response, body) {
                    var jsonObj = JSON.parse(body);
                    if (!error && response.statusCode == 200) {
                      insert = {
                        '_id': intCount,
                        'action': arr[0],
                        'actionAddress': value.senderRS,
                        'timestamp': ((value.timestamp * 1000) + (1385294583 * 1000)),
                        'nextProducer': arr[1],
                        'producerName': jsonObj.name,
                        'producerLocation': jsonObj.location
                      }
                      db.collection(collectionName, function(err, collection) {
                        collection.deleteOne({_id: new ObjectId(intCount)});
                      });
                      intCount++;
                      db.collection(collectionName).insert(insert, function(err, doc) {
                      });

                    } else {
                      console.log(error);
                    }
                  });
                } else {
                  // Invalid VALIDATE Transaction to Product
                }
              } else if(arr[0] == "MOVE") {
                if(value.senderRS == nextProducer) {
                  nextProducer = arr[1];
                  /*
                    If the transaction is not a VALIDATE action, then it checks to ensure the
                    hash in the message is correct (sha-256 hash of RSA public key, the location proof, timestamp)
                  */
                  var collection = db.collection('hashInfo');
                  // Third item in array (arr[2]) is the hash of the location information
                  collection.findOne({fullHash: arr[2]}, function(err, doc) {
                    request.post({url:VerificationServerURL + 'verifyLocation', form: {
                          hash: arr[2],
                          publicKey: doc.RSApublicKey,
                          locationProof: doc.locationProof,
                          timestamp: doc.timestamp
                      }},
                      function (error, response, body) {
                        var arrResponse = body.split(" | ");

                        if(body != null) {
                          request.post({url:QRCodeServerURL + 'producerInfo', form: {producerAddr: arr[1]}},
                            function (error, response, body) {
                              var jsonObj = JSON.parse(body);
                              if (!error && response.statusCode == 200) {
                                insert = {
                                  '_id': intCount,
                                  'action': arr[0],
                                  'actionAddress': value.senderRS,
                                  // To get the proper timestamp from the block, we need to add on the time from genesis block too
                                  'timestamp': ((value.timestamp * 1000) + (1385294583 * 1000)),
                                  'nextProducer': arr[1],
                                  'producerName': jsonObj.name,
                                  'producerLocation': jsonObj.location
                                }
                                db.collection(collectionName, function(err, collection) {
                                  collection.deleteOne({_id: new ObjectId(intCount)});
                                });
                                intCount++;
                                db.collection(collectionName).insert(insert, function(err, doc) {
                                });

                              } else {
                                console.log(error);
                              }
                            }
                          );
                        }
                      }
                    );
                  });
                } else {
                  // Invalid MOVE Transaction to Product
                }
            } else {
              // Invalid Transaction to Product
            }
            });
          }
        }
        request(options, callback);
      }
    });
  });
}

/*
  Function is continuously run (every 20 seconds) to update product info.
  Nxt blocks are mined roughly every minute, so needs to continuously update.
*/
setInterval(function() {
  console.log("CachingServer - Scheduled Update");
  updateProducts();
}, 30000);

/*
  API request to cache a newly generated QR code
  Called from the QRCodeServer when a new QR code is generated.
  CachingServer makes a new Collection for the QR code, and updates info.
*/
app.post('/cacheQR', function(req, res) {
  console.log("CachingServer - Caching new QR Code");
  var qrAddress = req.body.qrAddress;
  var qrPubKey = req.body.qrPubKey;
  var qrPrivKey = req.body.qrPrivKey;
  var producerAddr = req.body.producerAddr;
  var productName = req.body.productName;
  var productId = req.body.productId;
  var batchId = req.body.batchId;
  var producerName = req.body.producerName;
  var producerLocation = req.body.producerLocation;
  var timestamp = (new Date).getTime();

  insert = {
    '_id': 0,
    'qrAddress': qrAddress,
    'qrPubKey': qrPubKey,
    'qrPrivKey': qrPrivKey,
    'poducerAddr': producerAddr,
    'productName': productName,
    'productId': productId,
    'batchId': batchId,
    'producerName': producerName,
    'producerLocation': producerLocation,
    'timestamp': timestamp,
  }

  db.collection('PRODUCT - ' + qrAddress).insert(insert, function(err, doc) {
    if (err) throw err;
  });
  res.send("cached");
});

/*
  When product has been moved, the hash, public key, location proof, and timestamp
  are stored in 'hashInfo' Collection.
*/
app.post('/updateHashInfo', function(req, res) {
  console.log("CachingServer - Product Location Data Updated by Producer")
  var fullHash = req.body.hash;
  var RSAPublicKey = req.body.publicKey;
  var locationProof = req.body.locationProof;
  var timestamp = req.body.timestamp;

  insert = {
    'fullHash': fullHash,
    'RSApublicKey': RSAPublicKey,
    'locationProof': locationProof,
    'timestamp': timestamp
  }

  db.collection('hashInfo').insert(insert, function(err, doc) {
    if (err) throw err;
  });

  res.send("true");
});

/*
  Checks if a product has been validated.
  Takes in a product address, and the address which made the validation.
*/
app.post('/checkIfValid', function(req, res) {
  console.log("CachingServer - Checking if Product has been Validated");
  var productAddr = req.body.accAddr;
  var checkAddr = req.body.checkAddr;
  db.collection('PRODUCT - ' + productAddr).find({}).toArray(function(err, result) {
    var sendString = "false";

    result.forEach(function(value) {
      if(value.action == "VALIDATE" && value.actionAddress == checkAddr) {
        console.log("CachingServer - Product has been Validated");
        sendString = "true";
      }
    });

    res.send(sendString);
  });
});

/*
  Returns all info related to a particular product ID
  Used by the consumer application.
*/
app.get('/productInfo/:accAddr', function(req, res) {
  console.log("CachingServer - Cosumer Requesting Info");
  var productAddr = req.params.accAddr;
  db.collection('PRODUCT - ' + productAddr).find({}).toArray(function(err, result) {
    //pipe items
    var completeString = "";
    result.forEach(function(value) {
      completeString += JSON.stringify(value);
      completeString += "|";
    });
    res.send(completeString);
  });
});

module.exports = router;

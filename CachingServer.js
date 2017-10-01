var express = require('express');
var MongoClient = require('mongodb').MongoClient
var request = require("request");

var router = express.Router();

// URL for your Nxt node
var nxtUrl = 'http://ec2-52-64-224-239.ap-southeast-2.compute.amazonaws.com:6876/nxt?';

var url = 'mongodb://localhost:27017';
var db;
// Connect to MongoDB
MongoClient.connect(url, function (err, database) {
if (err)
  throw err
 else {
   db = database;
   console.log('CachingServer - Connected to MongoDB');
 }

 db.createCollection('products', function(error, otherThing) {
   if (error) throw error;
     console.log("CachingServer - Products Collection Created!");
 });
});

function updateProducts() {
  db.listCollections().toArray(function(err, collInfos) {
    collInfos.forEach(function(value) {
      var collectionName = value.name;
      if(collectionName.length == 24) {
        const options = {
          method: 'GET',
          uri: nxtUrl,
          json: true,
          qs: {
            requestType: "getBlockchainTransactions",
            account: collectionName
          }
        };
        function callback(error, response, body) {
          if (!error && response.statusCode == 200) {
            var intCount = 1;
            body.transactions.forEach(function(value) {
              //console.log('CachingServer - ' + value.attachment.message);
              var arr = value.attachment.message.split

              insert = {
                '_id': intCount,
                'action': arr[0],
                'address': arr[1]
              }

              db.collection(collectionName).insert(insert, function(err, doc) {
                if (err) throw err;
              });
              intCount++;
            });
          }
        }
        request(options, callback);
      }
    });
  });
}

//var minutes = 1, the_interval = minutes * 60 * 1000;
setInterval(function() {
  console.log("CachingServer - I am doing my 1 minute check");
  //updateProducts();
  // do your stuff here
}, 60000);

router.post('/cacheQR', function(req, res) {
  console.log('TIMESTAMP: ' + (new Date).getTime());
  console.log("CachingServer - CACHING QR CODE");
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
  console.log('------');
  console.log(qrAddress);
  console.log(producerName);
  console.log(producerLocation);
  console.log('------');
  /*
  db.createCollection(qrAddress, function(error, otherThing) {
    if (error) throw error;
  });
  */
  db.collection(qrAddress).insert(insert, function(err, doc) {
    if (err) throw err;
  });
});

router.post('/productInfo', function(req, res) {
  console.log("CachingServer - Cosumer Requesting Info");
  var productAddr = req.body.accAddr;

  db.collection(productAddr).find({}).toArray(function(err, result) {
    console.log(result);
    res.send(result);
  });

  //res.send('sample data');
});

// Define the about route
router.get('/about', function(req, res) {
  res.send('About us');
});

// Define the test1 route
router.get('/test1', function(req, res) {
  db.collection("products").find({}).toArray(function(err, result) {
    console.log('PRINTING PROUCTS');
     if (err) throw err;
     res.send(result)
  });
});

module.exports = router;

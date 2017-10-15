var express = require('express');
var app = express();
var MongoClient = require('mongodb').MongoClient
var request = require("request");
var ObjectId = require('mongodb').ObjectID;
var router = express.Router();
var bodyParser = require('body-parser');

// URL for your Nxt node
var nxtUrl = 'http://ec2-52-64-224-239.ap-southeast-2.compute.amazonaws.com:6876/nxt?';

var QRCodeServerURL = 'http://ec2-54-153-202-123.ap-southeast-2.compute.amazonaws.com:3000/';

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
/*
 var port = process.env.PORT || 3000;
   app.listen(port, function () {
     console.log('CachingServer - Listening on port 3000...')
   });
   */
});
/*
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:true}));
*/
function updateProducts() {
  db.listCollections().toArray(function(err, collInfos) {
    collInfos.forEach(function(value) {
      var collectionName = value.name;
      var nameArr = collectionName.split(" - ");
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

            body.transactions.forEach(function(value) {
              //console.log(collectionName + ": " + JSON.stringify(value));
              var arr = value.attachment.message.split(" - ");

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
                }
              );
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
  console.log("CachingServer - Scheduled Update...");
  updateProducts();
}, 10000);

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

  db.collection('PRODUCT - ' + qrAddress).insert(insert, function(err, doc) {
    if (err) throw err;
  });
});

/*
  Checks if a product has been validated.
  Takes in a product address, and the address which made the validation.
*/
router.post('/checkIfValid', function(req, res) {
  console.log("CachingServer - Checking if Product is Valid");
  var productAddr = req.body.accAddr;
  var checkAddr = req.body.checkAddr;

  db.collection('PRODUCT - ' + productAddr).find({}).toArray(function(err, result) {
    var sendString = "false";

    result.forEach(function(value) {
      console.log("ACTION: " + value.action);
      if(value.action == "VALIDATE" && value.actionAddress == checkAddr) {
        console.log("Product has been VALIDATED");
        sendString = "true";
      }
    });

    res.send(sendString);
  });
});

router.post('/productInfo', function(req, res) {
  console.log("CachingServer - Cosumer Requesting Info");
  var productAddr = req.body.accAddr;

  db.collection('PRODUCT - ' + productAddr).find({}).toArray(function(err, result) {
    //pipe items
    var completeString = "";
    result.forEach(function(value) {
      completeString += JSON.stringify(value);
      completeString += "|";
    });

    console.log(completeString);
    res.send(completeString);
  });
});

router.get('/productInfo/:accAddr', function(req, res) {
  console.log("CachingServer - Cosumer Requesting Info");
  var productAddr = req.params.accAddr;
  //console.log(req.params.accAddr);
  db.collection('PRODUCT - ' + productAddr).find({}).toArray(function(err, result) {
    //pipe items
    var completeString = "";
    result.forEach(function(value) {
      completeString += JSON.stringify(value);
      completeString += "|";
    });

    console.log(completeString);
    res.send(completeString);
  });
});

router.get('/gettables', (req, res) => {
db.listCollections().toArray(function(err, collInfos) {
  collInfos.forEach(function(value) {
    console.log(value);
  });
});
})

module.exports = router;

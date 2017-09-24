var express = require('express')
var app = express()
var cors = require('cors')
var bodyParser = require('body-parser');
var MongoClient = require('mongodb').MongoClient
var request = require("request");
var randomstring = require("randomstring");
var qr = require('qr-image');

// Connection URL
var url = 'mongodb://localhost:27017';
var nxtUrl = 'http://ec2-52-64-224-239.ap-southeast-2.compute.amazonaws.com:6876/nxt?';
var mainSecretPhrase = "curve excuse kid content gun horse leap poison girlfriend gaze poison comfort";

var db;
MongoClient.connect(url, function (err, database) {
   if (err)
   	throw err
   else
   {
	db = database;
	console.log('Connected to MongoDB');
	//Start app only after connection is ready

  db.createCollection("qrcodes", function(error, otherThing) {
    if (error) throw error;
      console.log("Collection created!");
  });

/*
  db.createCollection("6f1d7a6cf2675206c7f756649721fa9db15c26ff8ea53173704a8c6949910458", function(error, otherThing) {
    if (error) throw error;
      console.log("Collection created!");
  });
*/

  db.createCollection("e3463b3c51e85b064e3ac02eaf9ad9f5287f10ba27c92e4870d52db75644ca44", function(error, otherThing) {
    if (error) throw error;
      console.log("Collection created!");
  });

  db.createCollection("30f88475cb442e63cb3ab854d4c03d7c3a4a55634f85c690212ca443ead9eb6c", function(error, otherThing) {
    if (error) throw error;
      console.log("Collection created!");
  });

   var port = process.env.PORT || 3000;
    app.listen(port, function (){
        console.log('Listening on port 3000...')
    });
   }
 });

//middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:true}));

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
      console.log("Created Nxt Account: " + body.accountRS);
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
  request.post({url:nxtUrl, form: {requestType: 'sendMessage', secretPhrase: mainSecretPhrase, recipient: accAddr, message: 'VALID - ' + producerAddr, deadline: '60', feeNQT: '0'}},
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        //Update internetal db with qr code
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
      } else {
        console.log("Error sending tx...");
        console.log(error);
      }
    }
  );
}

function sendToBlockchain(productAddr, prodDestination, producerPubKey, producerPrivKey, productPubKey) {
  console.log("ADVANCED SENDING");
  request.post({url:nxtUrl, form: {requestType: 'sendMessage', secretPhrase: producerPrivKey, recipient: productAddr, recipientPublicKey: productPubKey, message: 'MOVE - ' + prodDestination, deadline: '60', feeNQT: '0'}},
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log("Message sent successfully")

        insert = {
          'action': 'SEND',
          'sourceAddr': producerPubKey,
          'destAddr': prodDestination
        }
        db.collection(productAddr).insert(insert, function(err, doc) {
          if (err) throw err;
        });

        return true;
      } else {
        console.log("Error sending tx...");
        console.log(error);
        return false;
      }
    }
  );
}

app.post('/findqr', function (req, res) {
  var prodAddr = req.body.prodAddr;

  findQRFromNxt(function(transactions) {
    console.log("TRANSACTIONS");
    console.log(transactions);
  }, prodAddr);

  console.log("Finding QR Code...");
});

app.post('/moveqr', function (req, res) {
  var producerPubKey = req.body.pubKey;
  var producerPrivKey = req.body.privKey;
  var productAddr = req.body.prodAddr;
  var productPubKey = req.body.prodPubKey;
  var prodDestination = req.body.destination;

  //prodDestination is set as 'message' in this transaction.
  sendToBlockchain(productAddr, prodDestination, producerPubKey, producerPrivKey, productPubKey)
  res.send("QR code updated successfully.");
});

//Producer Requests New QR Code
app.post('/getqr', function (req, res) {
  console.log("Requesting QR Code...");

  var producerAddr = req.body.accAddr;
  var producerPubKey = req.body.pubKey;
  var productName = req.body.productName;
  var productId = req.body.productID;
  var batchId = req.body.batchID;

  db.listCollections().toArray(function(err, collInfos) {
    collInfos.forEach(function(value) {
      if(String(value.name) == (producerPubKey)) {
        getQRDetailsFromNxt(function(accAddr, pubKey, privKey) {
          console.log("-----------");
          console.log("Address: " + accAddr);
          console.log("Pub Key: " + pubKey);
          console.log("Priv Key: " + privKey);
          console.log("-----------");

          validateQR(accAddr, pubKey, privKey, producerAddr);

          qrString = "{\"accAddr\":" + "\"" + accAddr + "\"" + ",\"pubKey\":" + "\"" + pubKey + "\"" + ",\"privKey\":" + "\"" + privKey + "\"" + "}";
          var qrSvgString = qr.imageSync(qrString, {type: 'svg'});

          res.send(qrSvgString);
        });
        console.log("Existing Table");
      } else {
        //Something here?
      }
    });
  });
});

app.post('/getqrtest', function (req, res) {
  console.log("Requesting QR Code Test");

  var producerAddr = req.body.accAddr;
  var producerPubKey = req.body.pubKey;
  var productName = req.body.productName;
  var productId = req.body.productID;
  var batchId = req.body.batchID;

  db.listCollections().toArray(function(err, collInfos) {
    collInfos.forEach(function(value) {
      if(String(value.name) == (producerPubKey)) {
        console.log("Found table name with same public key");
        getQRDetailsFromNxt(function(accAddr, pubKey, privKey) {
          qrString = "{\"accAddr\":" + "\"" + accAddr + "\"" + ",\"pubKey\":" + "\"" + pubKey + "\"" + ",\"privKey\":" + "\"" + privKey + "\"" + "}";
          var qrSvgString = qr.imageSync(qrString, {type: 'svg'});

          insert = {
            'acc': accAddr,
            'pubKey': pubKey,
            'privKey': privKey
          }
          db.collection(producerPubKey).insert(insert, function(err, doc) {
            if (err) throw err;
            console.log("QR Code inserted");

          });
          res.send(qrSvgString);
        });
        console.log("Existing Table");
      } else {
        //Something here
      }
    });
  });
});

//Remove the QRCodes Collection. Only temporary
app.get('/removeqr', (req, res) => {
  res.send(db.collection("e3463b3c51e85b064e3ac02eaf9ad9f5287f10ba27c92e4870d52db75644ca44").drop())
})

app.get('/getqr', (req, res) => {
	console.log('Getting Query!');

  db.collection("NXT-RUF4-5GGQ-FPGJ-DRP75").find({}).toArray(function(err, result) {
     if (err) throw err;
	   res.send(result)
     console.log(result);
  });
})

app.get('/gettables', (req, res) => {
db.listCollections().toArray(function(err, collInfos) {
  collInfos.forEach(function(value) {
    console.log(value);
  });
});
})

app.post('/test', function (req, res) {
  console.log("Requesting QR Code");
  console.log(req.body);
})

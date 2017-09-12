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
var nxtUrl = 'http://ec2-52-63-253-206.ap-southeast-2.compute.amazonaws.com:6876/nxt?';

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

  db.createCollection("6f1d7a6cf2675206c7f756649721fa9db15c26ff8ea53173704a8c6949910458", function(error, otherThing) {
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

//THING
app.post('/getqr', function (req, res) {
  console.log("Requesting QR Code");

  var producerAddr = req.body.accAddr;
  var producerPubKey = req.body.pubKey;
  var productName = req.body.productName;
  var productId = req.body.productID;
  var batchId = req.body.batchID;

  db.listCollections().toArray(function(err, collInfos) {
    collInfos.forEach(function(value) {
      if(String(value.name) == (producerPubKey)) {
        getQRDetailsFromNxt(function(accAddr, pubKey, privKey) {
          qrString = "{\"accAddr\":" + "\"" + accAddr + "\"" + ",\"pubKey\":" + "\"" + pubKey + "\"" + ",\"privKey\":" + "\"" + privKey + "\"" + "}";

          var qrSvgString = qr.imageSync(qrString, {type: 'svg'});

          insert = {
            'acc': accAddr,
            'pubKey': pubKey,
            'privKey': privKey
            //'QRSvg': qrSvgString
          }
          db.collection("qrcodes").insert(insert, function(err, doc) {
            if (err) {
              //DO STUFF
            } else {
              //DO STUFF
            }

          });
          res.send(qrSvgString);
          //res.send("Account Address: " + accAddr + " Public Key: " + pubKey + "Secret Phrase: " + privKey)
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
  res.send(db.collection("qrcodes").drop())
})

app.get('/getqr', (req, res) => {
	console.log('Getting Query!');

  db.collection("qrcodes").find({}).toArray(function(err, result) {
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

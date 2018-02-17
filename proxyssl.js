var https = require('https');
var fs = require('fs');
//const util = require('util');

var options = 
{
  cert: fs.readFileSync('/etc/ssl-glowforge/glowforge.com.crt'),
  key: fs.readFileSync('/etc/ssl-glowforge/glowforge.com.key')
};


https.createServer(options, onRequestS).listen(3024);

var cluster1Address =  "app.glowforge.com"; //  "130.211.155.236" ; // GFCORE prod LB // "35.197.31.30";
var cluster2Address = "manufacturing.glowforge.com";  // "146.148.41.230" ; // GFCORE manufacturing LB // "35.184.176.29";

if(process.env.cluster1Address != null)
{
    cluster1Address = process.env.cluster1Address;
}

if(process.env.cluster2Address != null)
{
    cluster2Address = process.env.cluster2Address;
}



function onRequestS(client_req, client_res) {
   console.log('https serving: ' + client_req.url);


  client_req.uniqueLogId = (new Date()).getTime();
  // console.log(client_req.uniqueLogId);

  var uniqueId = (new Date()).getTime();

  var options1 = {
    hostname: cluster1Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method // 'GET' // change to client_req method
  };

  var options2 = {
    hostname: cluster2Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method  // 'GET' // change to client_req method
  };


  var proxy1 = https.request(options1, function (res) {

    console.log(uniqueId);
    //console.log(util.inspect(res, false, null))

    res.pipe(client_res, {
      end: true
    });
  });

  client_req.pipe(proxy1, {
    end: true
  });




  var proxy2 = https.request(options2, function (res2) {
    
    console.log(uniqueId);
    //console.log(util.inspect(res2, false, null))
    /*
    res2.pipe(client_res, {
      end: true
    });
    */
  });

  client_req.pipe(proxy2, {
    end: true
  });


}
var http = require('http');
var https = require('https');
var fs = require('fs');
//var sslca = require('ssl-root-cas');
const util = require('util');

// sslca.inject();

console.log("Welcome" );

var options = 
{
  key: fs.readFileSync('/etc/ssl-glowforge/glowforge.com.crt'),
  cert: fs.readFileSync('/etc/ssl-glowforge/glowforge.com.key')
};

http.createServer(onRequest).listen(3023);

https.createServer(options, onRequestS).listen(3024);

var cluster1Address =  "google.com" ; // "app.glowforge.com"; //  "130.211.155.236" ; // GFCORE prod LB // "35.197.31.30";
var cluster2Address =  "manufacturing.glowforge.com";  // "146.148.41.230" ; // GFCORE manufacturing LB // "35.184.176.29";

if(process.env.cluster1Address != null)
{
    cluster1Address = process.env.cluster1Address;
}

if(process.env.cluster2Address != null)
{
    cluster2Address = process.env.cluster2Address;
}



function onRequest(client_req, client_res) {
   console.log('serving http: ' + client_req.url);


  client_req.uniqueLogId = (new Date()).getTime();
  // console.log(client_req.uniqueLogId);

  var uniqueId = (new Date()).getTime();

  var options1 = {
    hostname: cluster1Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method, // 'GET' // change to client_req method
    rejectUnauthorized: false 
  };

  var options2 = {
    hostname: cluster2Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method,  // 'GET' // change to client_req method
    rejectUnauthorized: false
  };



  var proxy1 = https.request(options1, function (res) {

    console.log("req 1 " + uniqueId);

    console.log(res.statusCode);
    console.log(JSON.stringify(res.headers));

    //console.log(util.inspect(res, false, null));

    if(res.statusCode == 301 || res.statusCode == 302)
    {

        client_res.writeHead(res.statusCode, {
          location: res.headers.location
          //add other headers here...
        });
        client_res.end();
      /*
      var strArr1 = res.headers.location.split("//");
      var strArr2 =  strArr1[1].split("/");
      var hostName = strArr2[0];
      var path = strArr1[1].replace(hostName + "/", "");

      console.log("hostName " + hostName);
      console.log("path " + path);

      var optionsRedirect1 = {
        hostname: hostName, // 'www.google.com',
        port: 443,
        method: client_req.method, // 'GET' // change to client_req method
        rejectUnauthorized: false 
      };

      var proxyRedirect1 = https.request(optionsRedirect1, function (resRedirect) {

        console.log(resRedirect.statusCode);
        console.log(JSON.stringify(resRedirect.headers));
        if(resRedirect.statusCode == 301 || resRedirect.statusCode == 302)
        {
          console.log("AGAIN " );
        }


        resRedirect.pipe(client_res, {
          end: true
        });
      });

    */

    }
    else
    {
      res.pipe(client_res, {
        end: true
      });
    }
  });



  client_req.pipe(proxy1, {
    end: true
  });




  var proxy2 = https.request(options2, function (res2) {
    
    console.log("req 2 " + uniqueId);
    //console.log(util.inspect(res2, false, null))
    
  });


  client_req.pipe(proxy2, {
    end: true
  });



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
    method: client_req.method, // 'GET' // change to client_req method
    rejectUnauthorized: false
  };

  var options2 = {
    hostname: cluster2Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method,  // 'GET' // change to client_req method
    rejectUnauthorized: false
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
   
  });

  client_req.pipe(proxy2, {
    end: true
  });


}
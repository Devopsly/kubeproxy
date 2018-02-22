var http = require('http');
var https = require('https');
var fs = require('fs');
//var sslca = require('ssl-root-cas');
const util = require('util');

// sslca.inject();

console.log("Welcome" );

var options = 
{
  // cert: fs.readFileSync('../ssl/windocks.com.crt'),
  // key: fs.readFileSync('../ssl/windocks.com.key')
  cert: fs.readFileSync('/etc/ssl-glowforge/glowforge.com.crt'),
  key: fs.readFileSync('/etc/ssl-glowforge/glowforge.com.key')
};

http.createServer(onRequest).listen(3023);

https.createServer(options, onRequestS).listen(3024);

var cluster1Address =  "app.glowforge.com"; //  "130.211.155.236" ; // GFCORE prod LB // "35.197.31.30";
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
  // console.log('serving http: ' + client_req.url);


  client_req.uniqueLogId = (new Date()).getTime();
  // console.log(client_req.uniqueLogId);

  // console.log(JSON.stringify(client_req.headers));

  console.log(client_req.headers);

  var sourceIp = client_req.headers['x-forwarded-for'] || client_req.connection.remoteAddress; 

  console.log(sourceIp);

  var uniqueId = sourceIp + (new Date()).getTime() ;

  //  client_req.headers['x-forwarded-for'] + "-" + (new Date()).getTime()  ;

  // client_req.headers['x-forwarded-for'] ;

  var headers = {};
  headers["accept"] = client_req.headers["accept"];
  if(client_req.headers["Authorization"])
  {
    headers["Authorization"] = client_req.headers["Authorization"];
  }
  if(client_req.headers["Cookie"])
  {
    headers["Cookie"] = client_req.headers["Cookie"];
  }


  if(client_req.headers["Content-Type"])
  {
    headers["Content-Type"] = client_req.headers["Content-Type"];
  }
  if(client_req.headers["Content-Length"])
  {
    headers["Content-Length"] = client_req.headers["Content-Length"];
  }

  var options1 = {
    hostname: cluster1Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method, // 'GET' // change to client_req method
    rejectUnauthorized: false,
    headers: headers
  };

  var options2 = {
    hostname: cluster2Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method,  // 'GET' // change to client_req method
    rejectUnauthorized: false,
    headers: headers
  };


  var requestResponseData = {
    timeRequest1Made : (new Date()).getTime(),
    timeRequest2Made : (new Date()).getTime(),
    response1LatencyMilliseconds : 0,
    response2LatencyMilliseconds : 0,
    responseData1 : "",
    responseData2 : ""
  }

  var proxy1 = https.request(options1, function (res) {

    // console.log("Request unique Id is " + uniqueId);
    // console.log(res.statusCode);
    // console.log(JSON.stringify(res.headers));

    var obj = 
    {
      id: uniqueId,
      source: sourceIp,
      request_url: client_req.url,
      response_code: res.statusCode,
      response_header: res.headers

    };



    
    console.log("Response 1: " + JSON.stringify(obj) );

    //console.log(util.inspect(res, false, null));

    if(res.statusCode == 301 || res.statusCode == 302 || res.statusCode == 404)
    {
        console.log("Redirect to " = res.headers.location);
        client_res.writeHead(res.statusCode, {
          location: res.headers.location
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
      
      var responseData = '';
      res.on('data', function (chunk) {
        //res.setEncoding('utf8');
        responseData += chunk;
      });
      res.on('end', function () {
        var contentType = res.headers["content-type"].toLowerCase();
        if (contentType.indexOf("image") == -1 )
        //if (contentType.indexOf("json") != -1 )
        {
          var timeNow = (new Date()).getTime();
          requestResponseData.response1LatencyMilliseconds = timeNow - requestResponseData.timeRequest1Made;

          // console.log(JSON.stringify(obj) );
          // console.log("==================Response data from production is: " + JSON.stringify(obj));
          requestResponseData.responseData1 = obj;

          if(requestResponseData.responseData2 != "")
          {
            console.log(requestResponseData);
          }
        }
      });      

      // console.log(res);
      res.pipe(client_res, {
        end: true
      });
    }




  });



  client_req.pipe(proxy1, {
    end: true
  });


requestResponseData.timeRequest2Made = (new Date()).getTime();

    var proxy2 = https.request(options2, function (res2) {

    var obj2 = 
    {
      id: uniqueId,
      source: sourceIp,
      request_url: client_req.url,
      response_code: res2.statusCode,
      response_header: res2.headers
    };

    console.log("Response 2: " + JSON.stringify(obj2) );

    if(res2.statusCode == 301 || res2.statusCode == 302 || res2.statusCode == 404)
    {
      console.log("Redirect to " = res2.headers.location);
        client_res.writeHead(res2.statusCode, {
          location: res2.headers.location
        });
        client_res.end();
    }
    else
    {
      var responseData = '';
      res2.on('data', function (chunk) {
        //res.setEncoding('utf8');
        responseData += chunk;
      });
      res2.on('end', function () {
        var contentType = res2.headers["content-type"].toLowerCase();
        if (contentType.indexOf("image") == -1 )
        //if (contentType.indexOf("json") != -1 )
        {
          var timeNow = (new Date()).getTime();
          requestResponseData.response2LatencyMilliseconds = timeNow - requestResponseData.timeRequest2Made;

          // console.log(JSON.stringify(obj2) );
          //console.log("===============Response data from manufacturing is: " + JSON.stringify(obj2));

          requestResponseData.responseData2 = obj2;

          if(requestResponseData.responseData1 != "")
          {
            console.log(requestResponseData);
          }

        }
      });      

      // dont pipe second response

    }

    
  });


  client_req.pipe(proxy2, {
    end: true
  });



}











function onRequestS(client_req, client_res) {
   console.log('https serving: ' + client_req.url);


  client_req.uniqueLogId = (new Date()).getTime();
  // console.log(client_req.uniqueLogId);

  console.log(client_req.headers);

  var sourceIp = client_req.headers['x-forwarded-for'] || client_req.connection.remoteAddress; 

  console.log(sourceIp);

  var uniqueId = sourceIp + (new Date()).getTime() ;


  var headers = {};
  headers["accept"] = client_req.headers["accept"];
  if(client_req.headers["Authorization"])
  {
    headers["Authorization"] = client_req.headers["Authorization"];
  }
  if(client_req.headers["Cookie"])
  {
    headers["Cookie"] = client_req.headers["Cookie"];
  }


  if(client_req.headers["Content-Type"])
  {
    headers["Content-Type"] = client_req.headers["Content-Type"];
  }
  if(client_req.headers["Content-Length"])
  {
    headers["Content-Length"] = client_req.headers["Content-Length"];
  }


  var requestResponseData = {
    timeRequest1Made : (new Date()).getTime(),
    timeRequest2Made : (new Date()).getTime(),
    response1LatencyMilliseconds : 0,
    response2LatencyMilliseconds : 0,
    responseData1 : "",
    responseData2 : ""
  }



  var options1 = {
    hostname: cluster1Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method, // 'GET' // change to client_req method
    rejectUnauthorized: false,
    headers: headers
  };

  var options2 = {
    hostname: cluster2Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method,  // 'GET' // change to client_req method
    rejectUnauthorized: false,
    headers: headers
  };


  var proxy1 = https.request(options1, function (res) {

     var obj = 
    {
      id: uniqueId,
      source: sourceIp,
      request_url: client_req.url,
      response_code: res.statusCode,
      response_header: res.headers

    };

    if(res.statusCode == 301 || res.statusCode == 302 || res.statusCode == 404)
    {
        client_res.writeHead(res.statusCode, {
          location: res.headers.location
        });
        client_res.end();
    }
    else
    {
      var responseData = '';
      res.on('data', function (chunk) {
        //res.setEncoding('utf8');
        responseData += chunk;
      });
      res.on('end', function () {
        var contentType = res.headers["content-type"].toLowerCase();
        if (contentType.indexOf("image") == -1 )
        //if (contentType.indexOf("json") != -1 )
        {
          var timeNow = (new Date()).getTime();
          requestResponseData.response1LatencyMilliseconds = timeNow - requestResponseData.timeRequest1Made;
          requestResponseData.responseData1 = obj;
          if(requestResponseData.responseData2 != "")
          {
            console.log(requestResponseData);
          }
        }
      });
    }   

    res.pipe(client_res, {
      end: true
    });
  });

  client_req.pipe(proxy1, {
    end: true
  });



  requestResponseData.timeRequest2Made = (new Date()).getTime();

  var proxy2 = https.request(options2, function (res2) {
    var obj2 = 
    {
      id: uniqueId,
      source: sourceIp,
      request_url: client_req.url,
      response_code: res2.statusCode,
      response_header: res2.headers
    };
    
   if(res2.statusCode == 301 || res2.statusCode == 302 || res2.statusCode == 404)
    {
        client_res.writeHead(res2.statusCode, {
          location: res2.headers.location
        });
        client_res.end();
    }
    else
    {
      var responseData = '';
      res2.on('data', function (chunk) {
        //res.setEncoding('utf8');
        responseData += chunk;
      });
      res2.on('end', function () {
        var contentType = res2.headers["content-type"].toLowerCase();
        if (contentType.indexOf("image") == -1 )
        //if (contentType.indexOf("json") != -1 )
        {
          var timeNow = (new Date()).getTime();
          requestResponseData.response2LatencyMilliseconds = timeNow - requestResponseData.timeRequest2Made;

          // console.log(JSON.stringify(obj2) );
          //console.log("===============Response data from manufacturing is: " + JSON.stringify(obj2));

          requestResponseData.responseData2 = obj2;

          if(requestResponseData.responseData1 != "")
          {
            console.log(requestResponseData);
          }

        }
      });      

      // dont pipe second response

    }
   
  });

  client_req.pipe(proxy2, {
    end: true
  });


}
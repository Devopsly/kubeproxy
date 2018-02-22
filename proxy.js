var http = require('http');
var https = require('https');
var fs = require('fs');
//var sslca = require('ssl-root-cas');
const util = require('util');
var uuidV4 = require('uuid/v4');


const winston = require('winston');
const Logger = winston.Logger;
const Console = winston.transports.Console;

// Imports the Google Cloud client library for Winston
const LoggingWinston = require('@google-cloud/logging-winston').LoggingWinston;

// Creates a Winston Stackdriver Logging client
const loggingWinston = new LoggingWinston();

// Create a Winston logger that streams to Stackdriver Logging
// Logs will be written to: "projects/YOUR_PROJECT_ID/logs/winston_log"
const logger = new Logger({
  level: 'info', // log at 'info' and above
  transports: [
    // Log to the console
    new Console(),
    // And log to Stackdriver Logging
    loggingWinston,
  ],
});







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

//var cluster1Address =  "windocks.com"; 
//var cluster2Address =  "windocks.com"; 


if(process.env.cluster1Address != null)
{
    cluster1Address = process.env.cluster1Address;
}

if(process.env.cluster2Address != null)
{
    cluster2Address = process.env.cluster2Address;
}


var tokenMap = {};
var cookieMap = {};


function onRequest(client_req, client_res) {
  


  client_req.uniqueLogId = (new Date()).getTime();
  // console.log(client_req.uniqueLogId);

  // console.log(JSON.stringify(client_req.headers));

  console.log('Http request to ' + client_req.url);
  console.log(client_req.headers);

  var sourceIp = client_req.headers['x-forwarded-for'] || client_req.connection.remoteAddress; 

  var uniqueId = uuidV4(); // sourceIp + (new Date()).getTime() ;

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




  // TODO

  // headers["Authorization"]  and headers["Cookie"] got options2 request have to be different
  // in the response callback for 1 if the req url was ...login , store the token in array 
  // in response callback for 2 if the req url was ...login , store the token in array
  // create new hash table, key = token 1 and val = token 2
  // Similarly for cookie in response code
  // Future requests from 1, if they have toekn or cookie in client_req,
  // Use the hash table to get the corresponding token or cookie for #2
  // Set headers["Authorization"]  and headers["Cookie"] to the values 
  // That way manufacturing mirror requests have correct auth info

  var headers2 = {};
  headers2["accept"] = client_req.headers["accept"];
  if(client_req.headers["Authorization"])
  {
    var tok1 = client_req.headers["Authorization"].replace("Bearer", "").trim();
    if(tokenMap.hasOwnProperty(tok1))
    {
      headers2["Authorization"] = client_req.headers["Authorization"].replace(tok1, tokenMap[tok1]);
    }
    else
    {
      headers2["Authorization"] =  client_req.headers["Authorization"];
    }
  }
  if(client_req.headers["Cookie"])
  {
    if(cookieMap.hasOwnProperty(client_req.headers["Cookie"]) )
    {
      headers2["Cookie"] = cookieMap[client_req.headers["Cookie"]];
    }
    else
    {
      headers2["Cookie"] = client_req.headers["Cookie"] ;
    }
  }


  var options2 = {
    hostname: cluster2Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method,  // 'GET' // change to client_req method
    rejectUnauthorized: false,
    headers: headers2
  };


  var requestResponseData = {
    id: uniqueId,
    timeRequest1Made : (new Date()).getTime(),
    timeRequest2Made : (new Date()).getTime(),
    response1LatencyMilliseconds : 0,
    response2LatencyMilliseconds : 0,
    responseData1 : null,
    responseData2 : null
  }

  var tokenData = 
  {
    token1: "",
    token2: ""
  }
   var cookieData = 
  {
    cookie1: "",
    cookie2: ""
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
      response_header: res.headers,
      data: null
    };
    
    // console.log("Response 1: " + JSON.stringify(obj) );

    //console.log(util.inspect(res, false, null));

    if(res.statusCode == 301 || res.statusCode == 302 || res.statusCode == 404)
    {
        console.log("Redirect 1 to " + res.headers.location);
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
          if(contentType.toLowerCase().indexOf("json") != -1 )
          {
            obj.data = JSON.parse(responseData);
            if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
            {
              // Grab the token 
              tokenData.token1 = obj.data.auth_token;
              if(tokenData.token2 != null)
              {
                tokenMap[tokenData.token1] = tokenData.token2;
              }
            }
          }
          else
          {
            obj.data = responseData;
            if(client_req.url.indexOf("login") != -1 && client_req.method.toLowerCase() == "post")
            {
              // Grab the cookie
              cookieData.cookie1 = res.headers["Cookie"];
              if(cookieData.cookie2 != null)
              {
                cookieMap[cookieData.cookie1] = cookieData.cookie2;
              }
            }
          }

          var timeNow = (new Date()).getTime();
          requestResponseData.response1LatencyMilliseconds = timeNow - requestResponseData.timeRequest1Made;

          // console.log(JSON.stringify(obj) );
          // console.log("==================Response data from production is: " + JSON.stringify(obj));
          requestResponseData.responseData1 = obj;

          if(requestResponseData.responseData2 != null)
          {
            console.log(requestResponseData);
            logger.info(requestResponseData);
          }
        }
      });      




      if(res.headers.hasOwnProperty("Cookie"))
      {
        client_res.headers["Cookie"] = res.headers["Cookie"];
      }

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
      response_header: res2.headers,
      data: null
    };

    if(res2.statusCode == 301 || res2.statusCode == 302 || res2.statusCode == 404)
    {
      console.log("Redirect 2 to " + res2.headers.location);
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
          if(contentType.toLowerCase().indexOf("json") != -1 )
          {
            obj2.data = JSON.parse(responseData);
            if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
            {
              // Grab the token 
              tokenData.token2 = obj2.data.auth_token;
              if(tokenData.token1 != null)
              {
                tokenMap[tokenData.token1] = tokenData.token2;
              }
            }
          }
          else
          {
            obj2.data = responseData;
            if(client_req.url.indexOf("login") != -1 && client_req.method.toLowerCase() == "post")
            {
              // Grab the cookie
              cookieData.cookie2 = res2.headers["Cookie"];
              if(cookieData.cookie1 != null)
              {
                cookieMap[cookieData.cookie1] = cookieData.cookie2;
              }
            }
          }

          var timeNow = (new Date()).getTime();
          requestResponseData.response2LatencyMilliseconds = timeNow - requestResponseData.timeRequest2Made;

          requestResponseData.responseData2 = obj2;

          if(requestResponseData.responseData1 != null)
          {
            console.log(requestResponseData);
            logger.info(requestResponseData);
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

  client_req.uniqueLogId = (new Date()).getTime();
  // console.log(client_req.uniqueLogId);

  console.log("Https Request to " + client_req.url);
  console.log(client_req.headers);

  var sourceIp = client_req.headers['x-forwarded-for'] || client_req.connection.remoteAddress; 

  var uniqueId = uuidV4(); // sourceIp + (new Date()).getTime() ;


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
    id: uniqueId,
    timeRequest1Made : (new Date()).getTime(),
    timeRequest2Made : (new Date()).getTime(),
    response1LatencyMilliseconds : 0,
    response2LatencyMilliseconds : 0,
    responseData1 : null,
    responseData2 : null
  }



  var options1 = {
    hostname: cluster1Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method, // 'GET' // change to client_req method
    rejectUnauthorized: false,
    headers: headers
  };


  var headers2 = {};
  headers2["accept"] = client_req.headers["accept"];
  if(client_req.headers["Authorization"])
  {
    var tok1 = client_req.headers["Authorization"].replace("Bearer", "").trim();
    if(tokenMap.hasOwnProperty(tok1))
    {
      headers2["Authorization"] = client_req.headers["Authorization"].replace(tok1, tokenMap[tok1]);
    }
    else
    {
      headers2["Authorization"] =  client_req.headers["Authorization"];
    }
  }
  if(client_req.headers["Cookie"])
  {
    if(cookieMap.hasOwnProperty(client_req.headers["Cookie"]) )
    {
      headers2["Cookie"] = cookieMap[client_req.headers["Cookie"]];
    }
    else
    {
      headers2["Cookie"] = client_req.headers["Cookie"] ;
    }
  }


  var options2 = {
    hostname: cluster2Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method,  // 'GET' // change to client_req method
    rejectUnauthorized: false,
    headers: headers2
  };


  var proxy1 = https.request(options1, function (res) {

     var obj = 
    {
      id: uniqueId,
      source: sourceIp,
      request_url: client_req.url,
      response_code: res.statusCode,
      response_header: res.headers,
      data: null

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
          if(contentType.toLowerCase().indexOf("json") != -1 )
          {
            obj.data = JSON.parse(responseData);
            if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
            {
              // Grab the token 
              tokenData.token1 = obj.data.auth_token;
              if(tokenData.token2 != null)
              {
                tokenMap[tokenData.token1] = tokenData.token2;
              }
            }
          }
          else
          {
            obj.data = responseData;
            if(client_req.url.indexOf("login") != -1 && client_req.method.toLowerCase() == "post")
            {
              // Grab the cookie
              cookieData.cookie1 = res.headers["Cookie"];
              if(cookieData.cookie2 != null)
              {
                cookieMap[cookieData.cookie1] = cookieData.cookie2;
              }
            }
          }

          var timeNow = (new Date()).getTime();
          requestResponseData.response1LatencyMilliseconds = timeNow - requestResponseData.timeRequest1Made;
          requestResponseData.responseData1 = obj;
          if(requestResponseData.responseData2 != null)
          {
            console.log(requestResponseData);
            logger.info(requestResponseData);
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
      response_header: res2.headers,
      data: null
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
          if(contentType.toLowerCase().indexOf("json") != -1 )
          {
            obj2.data = JSON.parse(responseData);
            if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
            {
              // Grab the token 
              tokenData.token2 = obj2.data.auth_token;
              if(tokenData.token1 != null)
              {
                tokenMap[tokenData.token1] = tokenData.token2;
              }
            }
          }
          else
          {
            obj2.data = responseData;
            if(client_req.url.indexOf("login") != -1 && client_req.method.toLowerCase() == "post")
            {
              // Grab the cookie
              cookieData.cookie2 = res2.headers["Cookie"];
              if(cookieData.cookie1 != null)
              {
                cookieMap[cookieData.cookie1] = cookieData.cookie2;
              }
            }
          }

          var timeNow = (new Date()).getTime();
          requestResponseData.response2LatencyMilliseconds = timeNow - requestResponseData.timeRequest2Made;

          // console.log(JSON.stringify(obj2) );
          //console.log("===============Response data from manufacturing is: " + JSON.stringify(obj2));

          requestResponseData.responseData2 = obj2;

          if(requestResponseData.responseData1 != null)
          {
            console.log(requestResponseData);
            logger.info(requestResponseData);
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
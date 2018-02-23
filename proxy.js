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
   //cert: fs.readFileSync('../ssl/test.com.crt'),
   //key: fs.readFileSync('../ssl/test.com.key')
  cert: fs.readFileSync('/etc/ssl-glowforge/glowforge.com.crt'),
  key: fs.readFileSync('/etc/ssl-glowforge/glowforge.com.key')
};

http.createServer(onRequest).listen(3023);

https.createServer(options, onRequestS).listen(3024);

var cluster1Address =  "app.glowforge.com"; //  "130.211.155.236" ; // GFCORE prod LB // "35.197.31.30";
var cluster2Address =  "manufacturing.glowforge.com";  // "146.148.41.230" ; // GFCORE manufacturing LB // "35.184.176.29";

//var cluster1Address =  "google.com"; 
//var cluster2Address =  "google.com"; 


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
  

  var requestData = '';

/*
  client_req.on('data', function(chunk) {
    requestData += chunk;
  });
  client_req.on('end', function() {
    console.log('Request data: ' + requestData);
    logger.info('Mirroring: Request data: ' + requestData);
  });
*/

  client_req.uniqueLogId = (new Date()).getTime();
  // console.log(client_req.uniqueLogId);

  // console.log(JSON.stringify(client_req.headers));

  console.log('Http request to ' + client_req.url);
  console.log(client_req.headers);

  logger.info('Mirroring: Http request to ' + client_req.url);
  logger.info('Mirroring: Client request headers: ' + JSON.stringify(client_req.headers) );

  var sourceIp = client_req.headers['x-forwarded-for'] || client_req.connection.remoteAddress; 

  var uniqueId = uuidV4(); // sourceIp + (new Date()).getTime() ;

  //  client_req.headers['x-forwarded-for'] + "-" + (new Date()).getTime()  ;

  // client_req.headers['x-forwarded-for'] ;

  var headers = {};
  headers["accept"] = client_req.headers["accept"];
  


  if(client_req.headers["authorization"])
  {
    headers["authorization"] = client_req.headers["authorization"];
  }
  if(client_req.headers["cookie"])
  {
    headers["cookie"] = client_req.headers["cookie"];
  }

  if(client_req.headers["content-type"])
  {
    headers["content-type"] = client_req.headers["content-type"];
  }
  if(client_req.headers["content-length"])
  {
    headers["content-length"] = client_req.headers["content-length"];
  }

  console.log("Mirroring: headers actually mirrored: " + JSON.stringify( headers) );
  logger.info("Mirroring: headers actually mirrored: " + JSON.stringify( headers) );

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
  if(client_req.headers["authorization"])
  {
    var tok1 = client_req.headers["authorization"].replace("Bearer", "").trim();
    if(tokenMap.hasOwnProperty(tok1))
    {
      headers2["authorization"] = client_req.headers["authorization"].replace(tok1, tokenMap[tok1]);
      console.log('Replaced token in header for second request: Token1: ' + tok1 + " , Token2: " +tokenMap[tok1]);
      logger.info("Mirroring: Replaced token in header for second request: Token1: " + tok1 + " , Token2: " +tokenMap[tok1]);
    }
    else
    {
      headers2["authorization"] =  client_req.headers["authorization"];
    }
  }
  if(client_req.headers["cookie"])
  {
    if(cookieMap.hasOwnProperty(client_req.headers["cookie"]) )
    {
      headers2["cookie"] = cookieMap[client_req.headers["cookie"]];
      console.log('Replaced cookie in header for second request: Cookie1: ' + client_req.headers["cookie"] + " , Cookie2: " + headers2["cookie"]);
      logger.info("Mirroring: Replaced cookie in header for second request: Cookie1: " + client_req.headers["cookie"] + " , Cookie2: " + headers2["cookie"]);
    }
    else
    {
      headers2["cookie"] = client_req.headers["cookie"] ;
    }
  }

  if(client_req.headers["content-type"])
  {
    headers2["content-type"] = client_req.headers["content-type"];
  }
  if(client_req.headers["content-length"])
  {
    headers2["content-length"] = client_req.headers["content-length"];
  }

  console.log("Mirroring actual headers 2: " + JSON.stringify(headers2) );
  logger.info("Mirroring: actual headers 2: " + JSON.stringify(headers2) );

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


  console.log("Mirroring proxy1 options : " + JSON.stringify(options1) );

  logger.info("Mirroring: proxy1 options : " + JSON.stringify(options1) );


  console.log("Mirroring proxy2 options : " + JSON.stringify(options2) );

  logger.info("Mirroring: proxy2 options : " + JSON.stringify(options2) );

  var proxy1 = https.request(options1, function (res) {


    // console.log("Request unique Id is " + uniqueId);
    // console.log(res.statusCode);
    // console.log(JSON.stringify(res.headers));

    if(res.headers)
    {
      console.log("Res received, headers " + client_req.url + ", "  + JSON.stringify(res.headers) );

      logger.info("Mirroring: Res received headers: " + client_req.url + ", "  + JSON.stringify(res.headers) );
    }

    if(res)
    {

      var contentType = "";
      if(res.headers)
      {
        if(res.headers.hasOwnProperty("content-type"))
        {
          contentType = res.headers["content-type"];
        }

      }

      var obj = 
      {
        mirroring_unique_id: uniqueId,
        content_type: contentType,
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
          logger.info("Mirroring: Redirect 1 to " + res.headers.location);
          client_res.writeHead(res.statusCode, {
            location: res.headers.location
          });
          client_res.end();
      }
      else
      {
        logger.info("Mirroring: non redirect response");
        var responseData = '';
        res.on('data', function (chunk) {
          //res.setEncoding('utf8');
          responseData += chunk;
        });

        res.on('error', function (error) {
            console.log("response error " + error.message);
            logger.info("Mirroring: response error " + error.message);
        });
        res.on('end', function () {
          console.log("Res http ended ");
          logger.info("Res http ended");
          contentType = contentType.toLowerCase();
          if (true) // (contentType.indexOf("image") == -1 )
          //if (contentType.indexOf("json") != -1 )
          {
            if(contentType.toLowerCase().indexOf("json") != -1 )
            {
              obj.data = JSON.parse(responseData);
              if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
              {
                // Grab the token 
                tokenData.token1 = obj.data.auth_token;
                console.log("Received Json response 1 with auth token: " + tokenData.token1);
                logger.info("Mirroring: Received Json response 1 with auth token: " + tokenData.token1);

                if(tokenData.token2 != null)
                {
                  tokenMap[tokenData.token1] = tokenData.token2;
                  console.log("Setting token map: " );
                  logger.info("Mirroring: Setting token map: " );
                }
              }
            }
            else
            {
              obj.data = responseData;
              if(client_req.url.indexOf("login") != -1 && client_req.method.toLowerCase() == "post")
              {
                // Grab the cookie
                cookieData.cookie1 = res.headers["cookie"];
                console.log("Received non Json response  1 with cookie: " + cookieData.cookie1);
                logger.info("Mirroring: Received non Json response  1 with cookie: " + cookieData.cookie1);

                if(cookieData.cookie2 != null)
                {
                  cookieMap[cookieData.cookie1] = cookieData.cookie2;
                }
              }
              else if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
              {
                // Grab the token 
                tokenData.token1 = JSON.parse(obj.data.auth_token);
                console.log("Received non Json response 1 with auth token: " + tokenData.token1);
                 logger.info("Mirroring: Received non Json response 1 with auth token: " + tokenData.token1);
                if(tokenData.token2 != null)
                {
                  tokenMap[tokenData.token1] = tokenData.token2;

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
              logger.info( JSON.stringify(requestResponseData) );
            }
          }
        });      


        if(res.headers && res.headers.hasOwnProperty("cookie"))
        {
            client_res.headers["cookie"] = res.headers["cookie"];
        }
        if(res.headers && res.headers.hasOwnProperty("authorization"))
        {
            client_res.headers["authorization"] = res.headers["authorization"];
        }


        if(res.headers)
        {
          client_res.headers = res.headers;
        }


        res.pipe(client_res, {
          end: true
        });


      }

    } // if res not null
    else
    {
      console.log("Res null" );
      logger.info("Mirroring: Res null" );
    }



  });



  client_req.pipe(proxy1, {
    end: true
  });


    requestResponseData.timeRequest2Made = (new Date()).getTime();

    var proxy2 = https.request(options2, function (res2) {

      if(res2.headers)
      {
        console.log("Res 2 received headers: " + client_req.url + ", "  + JSON.stringify(res2.headers) );
        logger.info("Mirroring: Res 2 received headers: " + client_req.url + ", "  + JSON.stringify(res2.headers) );
      }

      if(res2)
      {

        var contentType = "";
        if(res2.headers)
        {
          if(res2.headers.hasOwnProperty("content-type"))
          {
            contentType = res2.headers["content-type"];
          }

        }


        var obj2 = 
        {
          mirroring_unique_id: uniqueId,
          content_type: contentType,
          source: sourceIp,
          request_url: client_req.url,
          response_code: res2.statusCode,
          response_header: res2.headers,
          data: null
        };



        if(res2.statusCode == 301 || res2.statusCode == 302 || res2.statusCode == 404)
        {
          console.log("Redirect 2 to " + res2.headers.location);
          logger.info("Mirroring: Redirect 2 to " + res2.headers.location);
        }
        else
        {
          logger.info("Mirroring: non redirect response");
          var responseData = '';
          res2.on('data', function (chunk) {
            //res.setEncoding('utf8');
            responseData += chunk;
          });

          res2.on('error', function (error) {
              console.log("response error " + error.message);
              logger.info("Mirroring: response error " + error.message);
          });

          res2.on('end', function () {
            console.log("Res2 http ended ");
            logger.info("Res2 http ended");
            contentType = contentType.toLowerCase();
            if (true) // (contentType.indexOf("image") == -1 )
            //if (contentType.indexOf("json") != -1 )
            {
              if(contentType.toLowerCase().indexOf("json") != -1 )
              {
                obj2.data = JSON.parse(responseData);
                if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
                {
                  // Grab the token 
                  tokenData.token2 = obj2.data.auth_token;
                  console.log("Received Json response 2 with auth token: " + tokenData.token2);
                  logger.info("Mirroring: Received Json response 2 with auth token: " + tokenData.token2);
                  if(tokenData.token1 != null)
                  {
                    tokenMap[tokenData.token1] = tokenData.token2;
                    console.log("Setting token map: " );
                    logger.info("Mirroring: Setting token map: " );
                  }
                }
              }
              else
              {
                obj2.data = responseData;
                if(client_req.url.indexOf("login") != -1 && client_req.method.toLowerCase() == "post")
                {
                  // Grab the cookie
                  cookieData.cookie2 = res2.headers["cookie"];
                  console.log("Received non Json response with cookie: " + cookieData.cookie2);
                  logger.info("Mirroring: Received non Json response with cookie: " + cookieData.cookie2);

                  if(cookieData.cookie1 != null)
                  {
                    cookieMap[cookieData.cookie1] = cookieData.cookie2;
                  }
                }
                else if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
                {
                  // Grab the token 
                  tokenData.token2 = JSON.parse(obj2.data.auth_token);
                  console.log("Received non Json response with auth token: " + tokenData.token2);
                  logger.info("Mirroring: Received non Json response with auth token: " + tokenData.token2);
                  if(tokenData.token1 != null)
                  {
                    tokenMap[tokenData.token1] = tokenData.token2;

                  }
                }
              }

              var timeNow = (new Date()).getTime();
              requestResponseData.response2LatencyMilliseconds = timeNow - requestResponseData.timeRequest2Made;

              requestResponseData.responseData2 = obj2;

              if(requestResponseData.responseData1 != null)
              {
                console.log(requestResponseData);
                logger.info(JSON.stringify(requestResponseData) ) ;
              }

            }
          });      

          // dont pipe second response

        }
      } // if res 2 not null
      else
      {
        console.log("Res2 null" );
        logger.info("Mirroring: Res2 null" );
      }

    
  });


  client_req.pipe(proxy2, {
    end: true
  });



}











function onRequestS(client_req, client_res) {

  var requestData = '';

/*
  client_req.on('data', function(chunk) {
    requestData += chunk;
  });
  client_req.on('end', function() {
    console.log('Https Request data: ' + requestData);
    logger.info('Mirroring: Https Request data: ' + requestData);
  });

*/
  client_req.uniqueLogId = (new Date()).getTime();
  // console.log(client_req.uniqueLogId);

  console.log("Https Request to " + client_req.url);
  console.log(client_req.headers);
  logger.info('Mirroring: Https request to ' + client_req.url);
  logger.info('Mirroring: client request headers: ' + JSON.stringify(client_req.headers ) );

  var sourceIp = client_req.headers['x-forwarded-for'] || client_req.connection.remoteAddress; 

  var uniqueId = uuidV4(); // sourceIp + (new Date()).getTime() ;


  var headers = {};
  headers["accept"] = client_req.headers["accept"];
  if(client_req.headers["authorization"])
  {
    headers["authorization"] = client_req.headers["authorization"];
  }
  if(client_req.headers["cookie"])
  {
    headers["cookie"] = client_req.headers["cookie"];
  }

  if(client_req.headers["content-type"])
  {
    headers["content-type"] = client_req.headers["content-type"];
  }
  if(client_req.headers["content-length"])
  {
    headers["content-length"] = client_req.headers["content-length"];
  }

  console.log("Mirroring: headers actually mirrored: " + JSON.stringify( headers) );
   logger.info("Mirroring: headers actually mirrored: " + JSON.stringify( headers) );


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
  
   if(client_req.headers["authorization"])
  {
    var tok1 = client_req.headers["authorization"].replace("Bearer", "").trim();
    if(tokenMap.hasOwnProperty(tok1))
    {
      headers2["authorization"] = client_req.headers["authorization"].replace(tok1, tokenMap[tok1]);
      console.log('Replaced token in header for second request: Token1: ' + tok1 + " , Token2: " +tokenMap[tok1]);
       logger.info("Mirroring: Replaced token in header for second request: Token1: " + tok1 + " , Token2: " +tokenMap[tok1]);
    }
    else
    {
      headers2["authorization"] =  client_req.headers["authorization"];
    }
  }
  if(client_req.headers["cookie"])
  {
    if(cookieMap.hasOwnProperty(client_req.headers["cookie"]) )
    {
      headers2["cookie"] = cookieMap[client_req.headers["cookie"]];
      console.log('Replaced cookie in header for second request: Cookie1: ' + client_req.headers["cookie"] + " , Cookie2: " + headers2["cookie"]);
       logger.info("Mirroring: Replaced cookie in header for second request: Cookie1: " + client_req.headers["cookie"] + " , Cookie2: " + headers2["cookie"]);
    }
    else
    {
      headers2["cookie"] = client_req.headers["cookie"] ; 
    }
  }

  if(client_req.headers["content-type"])
  {
    headers2["content-type"] = client_req.headers["content-type"];
  }
  if(client_req.headers["content-length"])
  {
    headers2["content-length"] = client_req.headers["content-length"];
  }


  console.log("Mirroring actual headers 2: " + JSON.stringify(headers2) );

    logger.info("Mirroring: actual headers 2: " + JSON.stringify(headers2) );


  var options2 = {
    hostname: cluster2Address, // 'www.google.com',
    port: 443,
    path: client_req.url,
    method: client_req.method,  // 'GET' // change to client_req method
    rejectUnauthorized: false,
    headers: headers2
  };



  console.log("Mirroring proxy1 options : " + JSON.stringify(options1) );

  logger.info("Mirroring: proxy1 options : " + JSON.stringify(options1) );


  console.log("Mirroring proxy2 options : " + JSON.stringify(options2) );

  logger.info("Mirroring: proxy2 options : " + JSON.stringify(options2) );


  var proxy1 = https.request(options1, function (res) {

    if(res.headers)
    {
      console.log("Res received: headers " + client_req.url + ", "  + JSON.stringify(res.headers) );
      logger.info("Mirroring: Res received: headers " + client_req.url + ", "  + JSON.stringify(res.headers) );
    }
    if(res)
    {

      console.log("Res is non null" );
      logger.info("Mirroring: Res is non null" );
      
      var contentType = "";
      if(res.headers)
      {
        if(res.headers.hasOwnProperty("content-type"))
        {
          contentType = res.headers["content-type"];
        }

      }



       var obj = 
      {
        mirroring_unique_id: uniqueId,
        content_type: contentType,
        source: sourceIp,
        request_url: client_req.url,
        response_code: res.statusCode,
        response_header: res.headers,
        data: null

      };

      if(res.statusCode == 301 || res.statusCode == 302 || res.statusCode == 404)
      {
        console.log("Redirect https 1 to " + res.headers.location);
        logger.info("Mirroring:  Redirect https 1 to " + res.headers.location);
          client_res.writeHead(res.statusCode, {
            location: res.headers.location
          });
          client_res.end();
      }
      else
      {
        logger.info("Mirroring: non redirect res1 ");
        var responseData = '';
        res.on('data', function (chunk) {
          //res.setEncoding('utf8');
          responseData += chunk;
        });

        logger.info("Mirroring: non redirect response 2");

        res.on('error', function (error) {
            console.log("response error " + error.message);
            logger.info("Mirroring:  response error " + error.message);
        });

        logger.info("Mirroring: non redirect response 3");

        res.on('end', function () {
          console.log("Res https ended ");
          logger.info("Res https ended");
          //var contentType = res.headers["content-type"].toLowerCase();
          contentType = contentType.toLowerCase();
          if (true) //  contentType.indexOf("image") == -1 )
          //if (contentType.indexOf("json") != -1 )
          {
            if(contentType.toLowerCase().indexOf("json") != -1 )
            {
              obj.data = JSON.parse(responseData);
              if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
              {
                // Grab the token 
                tokenData.token1 = obj.data.auth_token;
                console.log("Received https Json response 1 with auth token: " + tokenData.token1);
                logger.info("Mirroring: Received https Json response 1 with auth token: " + tokenData.token1);
                if(tokenData.token2 != null)
                {
                  tokenMap[tokenData.token1] = tokenData.token2;
                  console.log("Setting token map 1 https");
                  logger.info("Mirroring: Setting token map 1 https");

                }
              }
            }
            else
            {
              obj.data = responseData;
              if(client_req.url.indexOf("login") != -1 && client_req.method.toLowerCase() == "post")
              {
                // Grab the cookie
                cookieData.cookie1 = res.headers["cookie"];
                console.log("Received non Json response with cookie: " + cookieData.cookie1);
                logger.info("Mirroring: Received non Json response with cookie: " + cookieData.cookie1);

                if(cookieData.cookie2 != null)
                {
                  cookieMap[cookieData.cookie1] = cookieData.cookie2;
                }
              }
              else if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
              {
                // Grab the token 
                tokenData.token1 = JSON.parse(obj.data.auth_token);
                console.log("Received non Json response with auth token: " + tokenData.token1);
                logger.info("Mirroring: Received non Json response with auth token: " + tokenData.token1);
                if(tokenData.token2 != null)
                {
                  tokenMap[tokenData.token1] = tokenData.token2;
                  console.log("Setting token map  https");
                  logger.info("Mirroring:  Setting token map https");

                }
              }
            }

            var timeNow = (new Date()).getTime();
            requestResponseData.response1LatencyMilliseconds = timeNow - requestResponseData.timeRequest1Made;
            requestResponseData.responseData1 = obj;
            if(requestResponseData.responseData2 != null)
            {
              console.log(requestResponseData);
              logger.info(JSON.stringify(requestResponseData) );
            }
          }
        });
      }   

      logger.info("Mirroring: non redirect response 4");



      

      if(res.headers && res.headers.hasOwnProperty("cookie"))
      {
          client_res.headers["cookie"] = res.headers["cookie"];
      }
      if(res.headers && res.headers.hasOwnProperty("authorization"))
      {
          client_res.headers["authorization"] = res.headers["authorization"];
      }

      if(res.headers)
      {
        client_res.headers = res.headers;
      }

      res.pipe(client_res, {
        end: true
      });

      logger.info("Mirroring: non redirect response 5");


    } // end if res
    else
    {
      console.log("Res null" );
      logger.info("Mirroring: Res null" );
    }


  });

  client_req.pipe(proxy1, {
    end: true
  });



  requestResponseData.timeRequest2Made = (new Date()).getTime();

  var proxy2 = https.request(options2, function (res2) {


    

    if(res2.headers)
    {
      console.log("Res 2 received, headers: " + client_req.url + ", " + JSON.stringify(res2.headers) );
      logger.info("Mirroring: Res 2 received: " + client_req.url + ", "  + JSON.stringify(res2.headers) );
    }

    if(res2)
    {

      console.log("Res 2is non null" );
      logger.info("Mirroring: Res 2 is non null" );



      var contentType = "";
      if(res2.headers)
      {
        if(res2.headers.hasOwnProperty("content-type"))
        {
          contentType = res2.headers["content-type"];
        }

      }


      var obj2 = 
      {
        mirroring_unique_id: uniqueId,
        content_type: contentType,
        source: sourceIp,
        request_url: client_req.url,
        response_code: res2.statusCode,
        response_header: res2.headers,
        data: null
      };
      
     if(res2.statusCode == 301 || res2.statusCode == 302 || res2.statusCode == 404)
      {
        console.log("Redirect https 2 to " + res2.headers.location);
        logger.info("Mirroring: Redirect https 2 to " + res2.headers.location);
      }
      else
      {
        logger.info("Mirroring: non redirect res2");
        var responseData = '';
        res2.on('data', function (chunk) {
          //res.setEncoding('utf8');
          responseData += chunk;
        });

        logger.info("Mirroring: non redirect response 2");

        res2.on('error', function (error) {
            console.log("response error " + error.message);
        });

        logger.info("Mirroring: non redirect response 3");


        res2.on('end', function () {

          console.log("Res2 https ended ");
          logger.info("Res2 https ended");
          contentType = contentType.toLowerCase();
          if(true) // (contentType.indexOf("image") == -1 )
          //if (contentType.indexOf("json") != -1 )
          {
            if(contentType.toLowerCase().indexOf("json") != -1 )
            {
              obj2.data = JSON.parse(responseData);
              if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
              {
                // Grab the token 
                tokenData.token2 = obj2.data.auth_token;
                console.log("Received https Json response 2 with auth token: " + tokenData.token2);
                logger.info("Mirroring: Received https Json response 2 with auth token: " + tokenData.token2);
                if(tokenData.token1 != null)
                {
                  tokenMap[tokenData.token1] = tokenData.token2;
                  console.log("Setting token map 2 https");
                  logger.info("Mirroring: Setting token map 2 https");
                }
              }
            }
            else
            {
              obj2.data = responseData;
              if(client_req.url.indexOf("login") != -1 && client_req.method.toLowerCase() == "post")
              {
                // Grab the cookie
                cookieData.cookie2 = res2.headers["cookie"];
                console.log("Received non Json response with cookie: " + cookieData.cookie2);
                logger.info("Mirroring: Received non Json response with cookie: " + cookieData.cookie2);

                if(cookieData.cookie1 != null)
                {
                  cookieMap[cookieData.cookie1] = cookieData.cookie2;
                }
              }
              else if(client_req.url.indexOf("machines/sign_in") != -1 && client_req.method.toLowerCase() == "post")
              {
                // Grab the token 
                tokenData.token2 = JSON.parse(obj2.data.auth_token);
                console.log("Received non Json response with auth token: " + tokenData.token2);
                logger.info("Mirroring: Received non Json response with auth token: " + tokenData.token2);
                if(tokenData.token1 != null)
                {
                  tokenMap[tokenData.token1] = tokenData.token2;
                  console.log("Setting token map 2 https");
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
              logger.info(JSON.stringify(requestResponseData) );
            }

          }
        });     

        logger.info("Mirroring: non redirect response 4"); 

      // dont pipe second response

      }

    } // if res2 not null

    else
    {
      console.log("Res2 null" );
      logger.info("Mirroring: Res2 null" );
    }
   
  });

  client_req.pipe(proxy2, {
    end: true
  });


}



/*
Machine login sim code
machineAuth = new Promise((done) => {
  request({
    method: 'POST',
    url: `${serverUrl}/machines/sign_in?serial=${MACHINE_SERIAL}&password=cb4778d132c966c4d2c8089eb8ca51c20fc91ad35652d9848cbd9ab8c34fd0dd`,
  }, (error, response) => {
    done(JSON.parse(response.body).auth_token);
  })

then we make requests with the machine auth like this 

machineAuth.then(token => {
    request({
      method: 'POST',
      url: `${serverUrl}/api/machines/owner?token=${req.body.token}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (err, result) => {
      console.log(result.body);
      res.status(200); // left in to allow easy adding of failures at this step
      res.send(fake_connection_status);
    })
  });


  */
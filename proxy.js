var http = require('http');

http.createServer(onRequest).listen(3023);

var cluster1Address = "35.197.31.30";
var cluster2Address = "35.184.176.29";

if(process.env.cluster1Address != null)
{
    cluster1Address = process.env.cluster1Address;
}

if(process.env.cluster2Address != null)
{
    cluster2Address = process.env.cluster2Address;
}



function onRequest(client_req, client_res) {
  // console.log('serve: ' + client_req.url);


  client_req.uniqueLogId = (new Date()).getTime();
  // console.log(client_req.uniqueLogId);

  var options1 = {
    hostname: cluster1Address, // 'www.google.com',
    port: 80,
    path: client_req.url,
    method: 'GET'
  };

  var options2 = {
    hostname: cluster2Address, // 'www.google.com',
    port: 80,
    path: client_req.url,
    method: 'GET'
  };


  var proxy1 = http.request(options1, function (res) {
    res.pipe(client_res, {
      end: true
    });
  });

  client_req.pipe(proxy1, {
    end: true
  });




  var proxy2 = http.request(options2, function (res2) {
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
/// Mirroring: Response comparison: 
var http = require('http'),
express = require('express'),
app = express(),
server = http.createServer(app).listen(3001);

var parsedJSON = require('./testresults.json');

app.get("/", function(req, res){
    
	var displayResults = [];
    for( i = 0; i < parsedJSON.length; i++)
    {
    	var comp = parsedJSON[i];

    	var contentType = comp.responseData1.content_type;

    	var displayResult = {};
    	displayResult.api = comp.responseData1.request_url;
    	displayResult.response_code1 = comp.responseData1.response_code;
    	displayResult.response_code2 = comp.responseData2.response_code;

    	displayResult.response1LatencyMilliseconds = comp.response1LatencyMilliseconds;
    	displayResult.response2LatencyMilliseconds = comp.response2LatencyMilliseconds;

    	displayResult.data1 = comp.responseData1.data;
    	displayResult.data2 = comp.responseData2.data;

    	if(contentType.toLowerCase().indexOf("json") != -1)
    	{
    		var data1Str = JSON.stringify(displayResult.data1);
    		var data2Str = JSON.stringify(displayResult.data2);
    		if(data1Str.trim() == data2Str.trim())
    		{
    			displayResult.diff = "IDENTICAL";
    		}
    		else
    		{
    			displayResult.diff = "DIFFERENT";
    		}
    	}

    	displayResults.push(displayResult);

    }

    res.json(displayResults);
});
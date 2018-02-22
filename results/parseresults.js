
$( document ).ready(function() {
    
    var results;
    $.getJSON('http://localhost:3000/testresults.json', function(data) {
        results = data.items;
        console.log(results);
    });
});
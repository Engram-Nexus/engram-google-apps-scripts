function searchPeopleViaApollo() {
  var apiEndpoint = "https://api.apollo.io/api/v1/mixed_people/search";
  var apiKey = PropertiesService.getScriptProperties().getProperty('APOLLO_API_KEY');
  console.log(`apiKey: ${apiKey}`);
  
  var searchParams = {
    "person_titles": ["CEO"],
    "per_page": 1
  };

  var options = {
    method: "post",
    headers: {
      Authorization: "Bearer " + apiKey, // If using a Bearer token
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Accept": "application/json"
    },
    payload: JSON.stringify(searchParams),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(apiEndpoint, options);
    var json = response.getContentText();
    Logger.log(json); // Log the full response for debugging
    var data = JSON.parse(json);
    Logger.log(data); // Process the search results
  } catch (error) {
    Logger.log("Error during Apollo API call: " + error.message);
  }
}
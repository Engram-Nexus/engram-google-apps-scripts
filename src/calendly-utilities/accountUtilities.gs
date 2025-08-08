/***********************
 * ACCOUNT UTILITIES
 ***********************/

/**
 * Retrieves user information from Calendly using the Personal Access Token.
 * 
 * This function fetches user details, including the organization URI, using a Calendly Personal Access Token.
 * If the token is not provided, it will be fetched from script properties.
 * 
 * @param {string} [calendlyToken] The Calendly Personal Access Token. If not provided, it will be fetched from script properties.
 * 
 * @return {object} The user resource object containing details such as:
 *   - `avatar_url`: The URL of the user's avatar.
 *   - `created_at`: The date and time the user was created.
 *   - `current_organization`: The URI of the user's current organization.
 *   - `email`: The user's email address.
 *   - `locale`: The user's locale.
 *   - `name`: The user's name.
 *   - `resource_type`: The type of resource (e.g., User).
 *   - `scheduling_url`: The user's scheduling URL.
 *   - `slug`: The user's slug.
 *   - `timezone`: The user's timezone.
 *   - `updated_at`: The date and time the user was last updated.
 *   - `uri`: The URI of the user resource.
 * 
 * @throws {Error} If there is an issue with the API request.
 */
function getAccountInfo(calendlyToken) {
  if (!calendlyToken) {
    calendlyToken = PropertiesService.getScriptProperties().getProperty('CALENDLY_PERSONAL_ACCESS_TOKEN');
    
    if (!calendlyToken) {
      Logger.log("Calendly Personal Access Token is not set. Please configure it in the script properties.");
      return null;
    }
  }
  
  var apiEndpoint = "https://api.calendly.com/users/me";
  
  var options = {
    "method": "get",
    "headers": {
      "Authorization": "Bearer " + calendlyToken,
      "accept": "application/json"
    },
    "muteHttpExceptions": true // To capture the full response even if it's an error
  };
  
  try {
    var response = UrlFetchApp.fetch(apiEndpoint, options);
    var responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      var json = response.getContentText();
      var data = JSON.parse(json);
      
      //Logger.log(`Raw Response: ${JSON.stringify(data, null, 2)}`); // Log the raw response
      
      return data.resource;
    } else {
      Logger.log("Failed to retrieve user information. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error fetching user information: " + e);
  }
  
  return null;
}

/**
 * Retrieves the organization URI from Calendly using the Personal Access Token.
 * 
 * This function fetches the organization URI by calling getAccountInfo and extracting the current_organization value.
 * If the token is not provided, it will be fetched from script properties.
 * 
 * @param {string} [calendlyToken] The Calendly Personal Access Token. If not provided, it will be fetched from script properties.
 * 
 * @return {string} The organization URI.
 * 
 * @throws {Error} If there is an issue with the API request.
 */
function getOrganizationUri(calendlyToken) {
  var accountInfo = getAccountInfo(calendlyToken);
  
  if (accountInfo) {
    Logger.log(`Organization URI: ${accountInfo.current_organization}`);
    
    return accountInfo.current_organization;
  } else {
    Logger.log("Failed to retrieve organization URI.");
    return null;
  }
}

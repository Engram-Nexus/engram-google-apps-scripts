/***********************
 * WEBHOOKS UTILITES: GET WEBHOOKS
 ***********************/

/**
 * Retrieves a list of Calendly webhook subscriptions for a specified organization and logs them to a sheet.
 * 
 * @returns {Object} The retrieved webhook subscriptions data.
 */
function getOrgWebhookSubscriptions() {

  // Get the Calendly Personal Access Token from script properties if not provided
  const accessToken = PropertiesService.getScriptProperties().getProperty('CALENDLY_PERSONAL_ACCESS_TOKEN');

  if (!accessToken) {
    Logger.log("Calendly Personal Access Token is not set. Please configure it in the script properties.");
    return;
  }

  // Get the organization URI
  var organizationUri = getOrganizationUri(accessToken);

  var url = `https://api.calendly.com/webhook_subscriptions?organization=${organizationUri}&scope=organization&count=100`;

  var options = {
    "method": "get",
    "headers": {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    "muteHttpExceptions": true // To handle HTTP errors gracefully
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();

    if (statusCode === 200) {
      var data = JSON.parse(response.getContentText());
      Logger.log("Successful response from Calendly API:");
      Logger.log(JSON.stringify(data, null, 2)); // Log the response data

      var webhooks = data.collection;
      Logger.log(`Webhooks: ${JSON.stringify(webhooks, null, 2)}`);
      
      // Define headers for the log sheet
      const CALENDLYWEBHOOKS_SHEET_NAME = "Calendly Webhooks";
      const CALENDLYWEBHOOKS_HEADERS = ["Created At", "Webhook URI", "Callback URL", "Events", "Organization URI", "Scope", "Status"];
      
      // Prepare data to log
      var logData = webhooks.map(function(webhook) {
        return {
          "Created At": webhook.created_at,
          "Webhook URI": webhook.uri,
          "Callback URL": webhook.callback_url,
          "Events": JSON.stringify(webhook.events),
          "Organization URI": webhook.organization,
          "Scope": webhook.scope,
          "Status": webhook.state
        };
      });
      
      // Log webhooks to sheet
      appendDataToLog(CALENDLYWEBHOOKS_SHEET_NAME, CALENDLYWEBHOOKS_HEADERS, logData, 'top');
      
      return webhooks;
    } else {
      Logger.log(`Failed to retrieve webhook subscriptions. Status code: ${statusCode}`);
      Logger.log(response.getContentText());
      return null;
    }
  } catch (error) {
    Logger.log(`Error retrieving webhook subscriptions: ${error}`);
    return null;
  }
}

/***********************
 * WEBHOOKS UTILITES: CREATE WEBHOOKS
 ***********************/

/**
 * Creates a new webhook subscription in Calendly for a specified organization or user.
 * 
 * This function uses a Calendly Personal Access Token stored in script properties for authentication.
 * It supports creating subscriptions for various events and scopes.
 * 
 * @param {string} callbackUrl The URL where Calendly will send webhook notifications.
 * @param {string} scope The scope of the subscription (e.g., "organization" or "user").
 * @param {array} events The list of events to subscribe to. Possible events include:
 *   - `invitee.created`: Receive notifications when a new Calendly event is scheduled.
 *   - `invitee.canceled`: Receive notifications when a Calendly event is canceled.
 *   - `invitee_no_show.created`: Receive notifications when an invitee is marked as a no-show.
 *   - `invitee_no_show.deleted`: Receive notifications when an invitee's no-show status is removed.
 *   - `routing_form_submission.created`: Receive notifications when a user submits a routing form (whether an event is scheduled or not).
 * 
 * @return {void} Logs the created webhook subscription details to the console.
 * 
 * @throws {Error} If there is an issue with the API request.
 */
function createOrgWebhookSubscription(
  callbackUrl = "https://script.google.com/macros/s/AKfycbzXxHnvzoc_jiRKOK4WkZFQvCW8wjovcjsYpMeE_Q-ScEZ4EmU7olrBcuIdwg4-RfA/exec",
  events = [
    'invitee.created',
    'invitee.canceled',
    'invitee_no_show.created',
    'invitee_no_show.deleted',
    'routing_form_submission.created'
  ]
) {
  var apiEndpoint = "https://api.calendly.com/webhook_subscriptions";

  // Get the Calendly Personal Access Token from script properties
  var calendlyToken = PropertiesService.getScriptProperties().getProperty('CALENDLY_PERSONAL_ACCESS_TOKEN');

  if (!calendlyToken) {
    Logger.log("Calendly Personal Access Token is not set. Please configure it in the script properties.");
    return;
  }

  // Get the organization URI
  var organizationUri = getOrganizationUri(calendlyToken);

  var options = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + calendlyToken,
      "Content-Type": "application/json"
    },
    "muteHttpExceptions": true // To capture the full response even if it's an error
  };

  var payload = {
    "url": callbackUrl,
    "events": events,
    "organization": organizationUri,
    "scope": "organization"
    // Optionally, add "user" or "group" fields if needed
  };

  options.payload = JSON.stringify(payload);

  try {
    var response = UrlFetchApp.fetch(apiEndpoint, options);
    var responseCode = response.getResponseCode();

    if (responseCode === 201) {
      var json = response.getContentText();
      var data = JSON.parse(json);
      var webhookResponse = data.resource;

      // Log the created webhook subscription details
      Logger.log(`Webhook Response: ${JSON.stringify(webhookResponse, null, 2)}`);
      var logData = [
        {
          "Created At": webhookResponse.created_at,
          "Webhook URI": webhookResponse.uri,
          "Callback URL": webhookResponse.callback_url,
          "Events": JSON.stringify(webhookResponse.events),
          "Organization URI": webhookResponse.organization,
          "Scope": webhookResponse.scope,
          "Status": webhookResponse.state
        }
      ]
      appendDataToLog(CALENDLYWEBHOOKS_SHEET_NAME, CALENDLYWEBHOOKS_HEADERS, logData, append = 'top');
      Logger.log("Webhook subscription created successfully: " + webhookResponse.uri);

    } else {
      Logger.log("Failed to create webhook subscription. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error creating webhook subscription: " + e);
  }
}

/***********************
 * WEBHOOKS UTILITES: DELETE WEBHOOKS
 ***********************/

/**
 * Deletes a Calendly webhook subscription using the provided webhook UUID and OAuth 2.0 access token.
 * 
 * @param {string} webhookUuid - The unique identifier of the Calendly webhook subscription to delete.
 * @param {string} accessToken - A valid OAuth 2.0 access token with permissions to manage Calendly webhook subscriptions.
 * 
 * @throws {Error} If there is an issue with the HTTP request.
 */
function deleteWebhookSubscription(webhookUri="https://api.calendly.com/webhook_subscriptions/aedf5d37-886d-4477-8ffb-4b527eaf8fdb") {
  console.log(`Deleting webhook URI: "${webhookUri}"...`);

  // Get the Calendly Personal Access Token from script properties
  var calendlyToken = PropertiesService.getScriptProperties().getProperty('CALENDLY_PERSONAL_ACCESS_TOKEN');

  if (!calendlyToken) {
    Logger.log("Calendly Personal Access Token is not set. Please configure it in the script properties.");
    return;
  }

  var options = {
    "method": "delete",
    "headers": {
      "Authorization": `Bearer ${calendlyToken}`,
      "Content-Type": "application/json"
    },
    "muteHttpExceptions": true // To handle HTTP errors gracefully
  };

  try {
    var response = UrlFetchApp.fetch(webhookUri, options);
    var statusCode = response.getResponseCode();

    if (statusCode === 204) {
      Logger.log("Webhook subscription deleted successfully.");
      
      // Update the webhook row in sheets
      var dataToUpdate = [
        {
          "Webhook URI": webhookUri,
          "Status": "deleted"
        }
      ];
    } else {
      Logger.log(`Failed to delete webhook subscription. Status code: ${statusCode}`);
      Logger.log(response.getContentText());

      // Update the webhook row in sheets
      var dataToUpdate = [
        {
          "Webhook URI": webhookUri,
          "Status": "not found"
        }
      ];
    }
    
    createOrUpdateLogData(CALENDLYWEBHOOKS_SHEET_NAME, CALENDLYWEBHOOKS_HEADERS, dataToUpdate, ["Webhook URI"], 'top');

  } catch (error) {
    Logger.log(`Error deleting webhook subscription: ${error}`);
  }
}

/***********************
 * WEBHOOKS UTILITES: EVENT TYPES
 ***********************/

/**
 * Retrieves a list of all event types for a specified organization or user in Calendly.
 * 
 * This function fetches event types using a Calendly Personal Access Token stored in script properties.
 * It supports pagination and optional query parameters for filtering event types.
 * 
 * @param {string} organizationUri The URI of the organization for which to retrieve event types.
 * @param {string} [userUri] The URI of the user for which to retrieve event types (optional).
 * 
 * @return {void} Logs the retrieved event types data to the console.
 * 
 * @throws {Error} If there is an issue with the API request.
 */
function listOrgEventTypes() {
  var apiEndpoint = "https://api.calendly.com/event_types";

  // Get the Calendly Personal Access Token from script properties
  var calendlyToken = PropertiesService.getScriptProperties().getProperty('CALENDLY_PERSONAL_ACCESS_TOKEN');

  if (!calendlyToken) {
    Logger.log("Calendly Personal Access Token is not set. Please configure it in the script properties.");
    return;
  }

  // Get the organization URI
  var organizationUri = getOrganizationUri(calendlyToken);

  var options = {
    "method": "get",
    "headers": {
      "Authorization": "Bearer " + calendlyToken,
      "accept": "application/json"
    },
    "muteHttpExceptions": true // To capture the full response even if it's an error
  };

  var queryParams = {
    "organization": organizationUri
  };

  var queryString = Object.keys(queryParams).map(function (key) {
    return key + "=" + encodeURIComponent(queryParams[key]);
  }).join("&");

  if (queryString) {
    apiEndpoint += "?" + queryString;
  }

  try {
    var response = UrlFetchApp.fetch(apiEndpoint, options);
    var responseCode = response.getResponseCode();

    if (responseCode === 200) {
      var json = response.getContentText();
      var data = JSON.parse(json);

      // Optionally, handle pagination using 'next_page_token'
      if (data.pagination.next_page_token) {
        var nextPageUrl = apiEndpoint + "&organization=" + organizationUri + "&page_token=" + data.pagination.next_page_token;

        if (userUri) {
          nextPageUrl += "&user=" + userUri;
        }

        // Recursively fetch the next page of event types
        listNextEventTypesPage(nextPageUrl, options);
      }

      var eventTypes = data.collection;
      Logger.log(`${eventTypes.length} event types found.`);
      Logger.log(`Event types: ${JSON.stringify(eventTypes, null, 2)}`);
    } else {
      Logger.log("Failed to retrieve event types. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error fetching event types: " + e);
  }
}

function listNextEventTypesPage(nextUrl, options) {
  try {
    var response = UrlFetchApp.fetch(nextUrl, options);
    var responseCode = response.getResponseCode();

    if (responseCode === 200) {
      var json = response.getContentText();
      var data = JSON.parse(json);

      // Log the raw response before processing
      Logger.log(`Raw Response: ${JSON.stringify(data, null, 2)}`);

      // Process the next page of event types data here
      Logger.log(data);

      if (data.pagination.next_page_token) {
        var nextPageUrl = nextUrl + "&page_token=" + data.pagination.next_page_token;

        // Recursively fetch the next page of event types
        listNextEventTypesPage(nextPageUrl, options);
      }
    } else {
      Logger.log("Failed to retrieve next page of event types. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error fetching next page of event types: " + e);
  }
}


/***********************
 * EVENTS UTILITES: GET EVENTS
 ***********************/

/**
 * Retrieves a list of all Calendly events.
 * 
 * This function fetches Calendly events using a Calendly Personal Access Token stored in script properties.
 * It supports pagination and optional query parameters for filtering events.
 * 
 * @return {void} Logs the retrieved Calendly events data to the console.
 * 
 * @throws {Error} If there is an issue with the API request.
 */
function listAllCalendlyEvents() {
  console.log("Retrieving all Calendly events...");
  var apiEndpoint = "https://api.calendly.com/scheduled_events";

  // Get the Calendly Personal Access Token from script properties
  var calendlyToken = PropertiesService.getScriptProperties().getProperty('CALENDLY_PERSONAL_ACCESS_TOKEN');

  if (!calendlyToken) {
    Logger.log("Calendly Personal Access Token is not set. Please configure it in the script properties.");
    return;
  }

  // Get the organization URI
  var organizationUri = getOrganizationUri(calendlyToken);

  if (!organizationUri) {
    Logger.log("Organization URI is not set. Please ensure you have access to the organization.");
    return;
  }

  var options = {
    "method": "get",
    "headers": {
      "Authorization": "Bearer " + calendlyToken,
      "accept": "application/json"
    },
    "muteHttpExceptions": true // To capture the full response even if it's an error
  };

  var queryParams = {
    "count": 100, // Optional: Set the number of events per page
    "organization": organizationUri,
    "sort": "start_time:desc" // Sort by start time in descending order
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

      // Log the raw response before processing
      //Logger.log(`Raw Response: ${JSON.stringify(data, null, 2)}`);

      // Optionally, handle pagination using 'next_page_token'
      if (data.pagination.next_page_token) {
        var nextPageUrl = apiEndpoint + "&page_token=" + data.pagination.next_page_token;

        // Recursively fetch the next page of events
        listNextCalendlyEventsPage(nextPageUrl, options);
      }

      var events = data.collection;
      Logger.log(`${events.length} events found.`);
      Logger.log(`Events: ${JSON.stringify(events, null, 2)}`);
      return events; // Return the parsed response object
    } else {
      Logger.log("Failed to retrieve Calendly events. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error fetching Calendly events: " + e);
  }
}

function listNextCalendlyEventsPage(nextUrl, options) {
  try {
    var response = UrlFetchApp.fetch(nextUrl, options);
    var responseCode = response.getResponseCode();

    if (responseCode === 200) {
      var json = response.getContentText();
      var data = JSON.parse(json);

      // Log the raw response before processing
      Logger.log(`Raw Response: ${JSON.stringify(data, null, 2)}`);

      // Process the next page of events data here
      Logger.log(data);

      if (data.pagination.next_page_token) {
        var nextPageUrl = nextUrl + "&page_token=" + data.pagination.next_page_token;

        // Recursively fetch the next page of events
        listNextCalendlyEventsPage(nextPageUrl, options);
      }
    } else {
      Logger.log("Failed to retrieve next page of Calendly events. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error fetching next page of Calendly events: " + e);
  }
}

/**
 * Retrieves a Calendly event using its event URI.
 * 
 * @param {string} eventUri - The URI of the Calendly event to retrieve.
 * 
 * @returns {object} The Calendly event details.
 */
function getCalendlyEvent(eventUri = "https://api.calendly.com/scheduled_events/b8ab625c-19db-450a-8b92-1fdfc9cd2f2d") {
  console.log(`Retrieving Calendly event from URI: ${eventUri}...`);

  // Get the Calendly Personal Access Token from script properties
  var calendlyToken = PropertiesService.getScriptProperties().getProperty('CALENDLY_PERSONAL_ACCESS_TOKEN');

  if (!calendlyToken) {
    Logger.log("Calendly Personal Access Token is not set. Please configure it in the script properties.");
    return;
  }

  // Extract the event UUID from the URI
  var uuid = eventUri.split('/').pop();

  var options = {
    'method': 'GET',
    'headers': {
      'Authorization': 'Bearer ' + calendlyToken,
      'Content-Type': 'application/json'
    },
    'muteHttpExceptions': true
  };

  var url = `https://api.calendly.com/scheduled_events/${uuid}`;

  try {
    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();

    if (statusCode === 200) {
      var eventApi = JSON.parse(response.getContentText());
      var eventDetails = eventApi.resource;
      Logger.log(`Calendly event retrieved successfully.`);
      Logger.log(`Calendly event details: ${JSON.stringify(eventDetails, null, 2)}`);
      return eventDetails;
    } else {
      Logger.log(`Failed to retrieve event. Status Code: ${statusCode}`);
    }
  } catch (e) {
    Logger.log(`Error retrieving event: ${e.message}`);
  }
}

/**
 * Converts a Calendly join URL to a Google Meet URL by following redirects.
 * 
 * @param {string} [calendlyUrl="https://calendly.com/events/b8ab625c-19db-450a-8b92-1fdfc9cd2f2d/google_meet"] 
 *   The Calendly join URL to convert.
 * 
 * @returns {string|null} The Google Meet URL if successful, or null if the conversion fails.
 * 
 * @throws {Error} If there is an issue with the HTTP request.
 */
function convertCalendlyJoinUrlToGoogleMeetUrl(calendlyUrl = "https://calendly.com/events/b8ab625c-19db-450a-8b92-1fdfc9cd2f2d/google_meet") {
  var options = {
    "method": "get",
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(calendlyUrl, options);
    var statusCode = response.getResponseCode();

    if (statusCode === 302) {
      var googleMeetUrl = response.getHeaders()["Location"];
      Logger.log(`Google Meet URL: ${googleMeetUrl}`);
      return googleMeetUrl;
    } else {
      Logger.log(`Failed to get Google Meet URL. Status code: ${statusCode}`);
      return null;
    }
  } catch (error) {
    Logger.log(`Error getting Google Meet URL: ${error}`);
    return null;
  }
}

/***********************
 * EVENTS UTILITES: GET EVENT INVITEES
 ***********************/

/**
 * Retrieves a list of invitees for a Calendly event.
 * 
 * This function fetches invitees using a Calendly Personal Access Token stored in script properties.
 * It supports pagination and optional query parameters for filtering invitees.
 * 
 * @param {string} eventUri - The URI of the Calendly event to retrieve invitees for.
 * 
 * @return {array} An array of invitee objects. Each invitee object contains details such as:
 *   - `cancel_url`: The URL to cancel the event for the invitee.
 *   - `created_at`: The timestamp when the invitee was created.
 *   - `email`: The email address of the invitee.
 *   - `event`: The URI of the event associated with the invitee.
 *   - `first_name`, `last_name`, `name`: The name details of the invitee.
 *   - `questions_and_answers`: An array of questions and answers provided by the invitee.
 *   - `reschedule_url`: The URL to reschedule the event for the invitee.
 *   - `status`: The status of the invitee (e.g., "active" or "canceled").
 *   - `timezone`: The timezone of the invitee.
 *   - `uri`: The URI of the invitee.
 * 
 * @throws {Error} If there is an issue with the API request.
 */
function getEventInvitees(eventUri="https://api.calendly.com/scheduled_events/865d00b0-9651-4057-9b33-355d9f904a10") {
  var uuid = eventUri.split("/").pop(); // Extract the event UUID from the URI
  console.log(`Retrieving invitees for Calendly event "${uuid}"...`);

  var calendlyToken = PropertiesService.getScriptProperties().getProperty('CALENDLY_PERSONAL_ACCESS_TOKEN');
  if (!calendlyToken) {
    Logger.log("Calendly Personal Access Token is not set. Please configure it in the script properties.");
    return;
  }

  var options = {
    "method": "get",
    "headers": {
      "Authorization": "Bearer " + calendlyToken,
      "accept": "application/json"
    },
    "muteHttpExceptions": true // To capture the full response even if it's an error
  };

  var apiEndpoint = "https://api.calendly.com/scheduled_events/" + uuid + "/invitees";

  var queryParams = {
    "count": 100 // Optional: Set the number of invitees per page
    // Add other query parameters as needed, e.g., page_token, sort, email, status
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

      // Log the raw response before processing
      //Logger.log(`Raw Response: ${JSON.stringify(data, null, 2)}`);

      // Optionally, handle pagination using 'next_page_token'
      if (data.pagination.next_page_token) {
        var nextPageUrl = apiEndpoint + "&page_token=" + data.pagination.next_page_token;

        // Recursively fetch the next page of invitees
        getNextPageInvitees(nextPageUrl, options);
      }

      var invitees = data.collection;
      Logger.log(`${invitees.length} invitees found.`);
      Logger.log(`Invitees: ${JSON.stringify(invitees, null, 2)}`);
      return invitees; // Return the parsed response object
    } else {
      Logger.log("Failed to retrieve invitees. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error fetching invitees: " + e);
  }
}

function getNextPageInvitees(nextUrl, options) {
  try {
    var response = UrlFetchApp.fetch(nextUrl, options);
    var responseCode = response.getResponseCode();

    if (responseCode === 200) {
      var json = response.getContentText();
      var data = JSON.parse(json);

      // Log the raw response before processing
      Logger.log(`Raw Response: ${JSON.stringify(data, null, 2)}`);

      // Process the next page of invitees data here
      Logger.log(data);

      if (data.pagination.next_page_token) {
        var nextPageUrl = nextUrl + "&page_token=" + data.pagination.next_page_token;

        // Recursively fetch the next page of invitees
        getNextPageInvitees(nextPageUrl, options);
      }
    } else {
      Logger.log("Failed to retrieve next page of invitees. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error fetching next page of invitees: " + e);
  }
}

/***********************
 * EVENTS UTILITES: GET GCALENDAR EVENTS
 ***********************/

/**
 * Retrieves a Calendly event using its event URI and extracts the Google Calendar event ID.
 * 
 * @param {string} eventUri - The URI of the Calendly event to retrieve.
 * 
 * @returns {string} The Google Calendar event ID.
 */
function getGoogleCalendarEventIdFromCalendlyEventUri(eventUri = "https://api.calendly.com/scheduled_events/b8ab625c-19db-450a-8b92-1fdfc9cd2f2d") {
  // Fetch Calendly event details
  var calendlyEvent = getCalendlyEvent(eventUri);

  // Extract Google Calendar event ID
  var googleCalendarEventId = calendlyEvent.calendar_event.external_id;

  Logger.log(`googleCalendarEventId: ${googleCalendarEventId}`);
  return googleCalendarEventId;
}

/**
 * Retrieves a Calendly event using its event URI, extracts the Google Calendar event ID,
 * and then fetches the Google Calendar event details.
 * 
 * @param {string} eventUri - The URI of the Calendly event to retrieve.
 * @param {string} [calendarId] - The ID of the calendar where the event is located. Defaults to 'primary' if not specified.
 * 
 * @returns {object} An object containing the Google Calendar event details.
 */
function getGoogleCalendarEventFromCalendlyEventUri(eventUri = "https://api.calendly.com/scheduled_events/b8ab625c-19db-450a-8b92-1fdfc9cd2f2d", calendarId = 'primary') {
  // Fetch Google Calendar event ID from Calendly event URI
  var eventId = getGoogleCalendarEventIdFromCalendlyEventUri(eventUri);

  if (eventId) {
    // Fetch Google Calendar event details using the event ID
    var eventDetails = getEventById(eventId, calendarId);

    Logger.log(`eventDetails: ${JSON.stringify(eventDetails, null, 2)}`);
    return eventDetails;
  } else {
    Logger.log("No Google Calendar event ID found for the Calendly event.");
    return null;
  }
}

/***********************
 * EVENTS UTILITES: UPDATE GCALENDAR EVENTS
 ***********************/

/**
 * Updates the description and location of a Google Calendar event linked to a Calendly event and adds invitees.
 * 
 * @param {string} eventUri - The URI of the Calendly event to retrieve.
 * @param {Object} updateOptions - An object containing fields to update:
 *   - {string} [newTitle] - The new title for the Google Calendar event.
 *   - {string} [newDescription] - The new description for the Google Calendar event.
 *   - {string} [newLocation] - The new location for the Google Calendar event.
 *   - {Array<Object>} [invitees] - An array of objects containing invitee details:
 *     - {string} email - The email address of the invitee.
 *     - {string} [role='reader'] - The role of the invitee (e.g., 'reader', 'writer', 'owner').
 *     - {boolean} [notify=false] - Whether to send a notification to the invitee.
 * @param {string} serviceAccountEmail - The email address of the service account used for authentication.
 * @param {string} impersonateAsEmail - The email address of the user to impersonate.
 * @param {string} [calendarId='primary'] - The ID of the calendar where the event is located. Defaults to 'primary' if not specified.
 * 
 * @returns {Object} The updated event details.
 */
function updateGoogleCalendarEventFromCalendlyEventUri(
  eventUri = "https://api.calendly.com/scheduled_events/cce2236e-007b-4afe-b606-d4adc3b38223",
  updateOptions = {
    newTitle: "New Title3",
    newDescription: `
    Hey there33333
    
    This is pretty cool.
    Lets do a lot more.
  `,
    newLocation: "Google Meet",
    invitees: [
      { email: "chris@revsup.com", role: "reader", notify: true },
      { email: "chris+1@revsup.com", role: "reader", notify: false }
    ]
  },
  serviceAccountEmail = 'revsup-calendar@candidate-qualification.iam.gserviceaccount.com',
  impersonateAsEmail = 'chris@revsup.com',
  calendarId = 'primary'
) {
  // Retrieve Google Calendar event ID from Calendly event URI
  var eventId = getGoogleCalendarEventIdFromCalendlyEventUri(eventUri);

  if (eventId) {

    // Update the Google Calendar event
    var updatedEvent = updateCalendarEventByServiceAccount(eventId, updateOptions, serviceAccountEmail, impersonateAsEmail, calendarId);

    return updatedEvent;
  } else {
    Logger.log("No Google Calendar event ID found for the Calendly event.");
    return null;
  }
}

/***********************
 * EVENTS UTILITES: GET NOTION PAGE
 ***********************/


/***********************
 * AUTH UTILITIES: REGISTER SERVICE ACCOUNTS
 ***********************/

/**
 * Displays a modal dialog for registering service accounts.
 * The dialog provides instructions on setting up a service account and allows users to upload a JSON key for registration.
 * It also lists previously registered accounts and offers the option to delete them.
 * 
 * @returns {void}
 */
function showServiceAccountRegistration() {
  const registeredAccounts = getRegisteredAccounts();
  
  const html = [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<base target="_top">',
    '<style>',
    '.container { padding: 20px; }',
    '.input-group { margin-bottom: 15px; }',
    'label { display: block; margin-bottom: 5px; }',
    'input[type="file"] { margin-bottom: 10px; }',
    '</style>',
    '</head>',
    '<body>',
    '<div class="container">',
    '<h3>Service Account Registration</h3>',
    '<p><strong>Before registering a service account:</strong></p>',
    '<ol>',
    '<li><strong>Create a Google Cloud Project:</strong> Go to the Google Cloud Console and create a new project.</li>',
    '<li><strong>Enable Required APIs:</strong> Enable the Google Calendar API and any other necessary APIs for your project.</li>',
    '<li><strong>Create a Service Account:</strong> Create a new service account in the IAM & Admin section.</li>',
    '<li><strong>Generate a JSON Key:</strong> Create a new JSON key for the service account.</li>',
    '<li><strong>Set Up Domain-Wide Delegation:</strong> Go to Google Workspace admin > Security > Access and data control > API controls > Domain wide delegation. Add the service account\'s client ID and select the necessary scopes (e.g., <code>https://www.googleapis.com/auth/calendar</code>).</li>',
    '</ol>',
    '<form id="registrationForm">',
    '<div class="input-group">',
    '<label for="serviceAccountFile">Upload Service Account JSON key:</label>',
    '<input type="file" id="serviceAccountFile" required>',
    '</div>',
    '<button type="button" onclick="handleRegistration()">Register Account</button>',
    '<div id="status"></div>',
    '</form>',
    '<h4>Registered Accounts:</h4>',
    '<ul id="accountsList"></ul>',
    '</div>',
    '<script>',
    'const registeredAccounts = ' + JSON.stringify(registeredAccounts) + ';',
    'document.addEventListener("DOMContentLoaded", function() {',
    '  const accountsList = document.getElementById("accountsList");',
    '  registeredAccounts.forEach(account => {',
    '    const li = document.createElement("li");',
    '    li.textContent = account;',
    '    const deleteButton = document.createElement("button");',
    '    deleteButton.textContent = "Delete";',
    '    deleteButton.onclick = function(accountEmail) {',
    '      return function() {',
    '        google.script.run',
    '          .withSuccessHandler(refreshModal)',
    '          .withFailureHandler(err => {',
    '            document.getElementById("status").innerHTML =',
    '              `<p style=\"color:red\">Error: ${err.message}</p>`;',
    '          })',
    '          .deleteServiceAccount(accountEmail);',
    '      };',
    '    }(account);',
    '    li.appendChild(deleteButton);',
    '    accountsList.appendChild(li);',
    '  });',
    '});',
    'function handleRegistration() {',
    '  const fileInput = document.getElementById("serviceAccountFile");',
    '  const file = fileInput.files[0];',
    '  if (!file) {',
    '    alert("Please select a JSON file");',
    '    return;',
    '  }',
    '  const reader = new FileReader();',
    '  reader.onload = function(e) {',
    '    try {',
    '      const jsonData = JSON.parse(e.target.result);',
    '      google.script.run',
    '        .withSuccessHandler(refreshModal)',
    '        .withFailureHandler(err => {',
    '          document.getElementById("status").innerHTML =',
    '            `<p style=\"color:red\">Error: ${err.message}</p>`;',
    '        })',
    '        .saveServiceAccount(jsonData);',
    '    } catch (err) {',
    '      document.getElementById("status").innerHTML =',
    '        `<p style=\"color:red\">Invalid JSON file: ${err.message}</p>`;',
    '    }',
    '  };',
    '  reader.readAsText(file);',
    '}',
    'function refreshModal() {',
    '  google.script.run.showServiceAccountRegistration();',
    '}',
    '</script>',
    '</body>',
    '</html>'
  ].join('');

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html)
      .setWidth(400)
      .setHeight(550), // Increased height for updated instructions
    'Register Service Account'
  );
}

// Updated server-side handler to save credentials
function saveServiceAccount(jsonData) {
  const requiredFields = [
    'client_email', 'private_key', 'private_key_id', 
    'project_id', 'client_id', 'token_uri'
  ];
  
  // Validate JSON structure
  const missingFields = requiredFields.filter(f => !(f in jsonData));
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Store as single JSON object using email as key
  const props = PropertiesService.getUserProperties();
  const accountKey = `SERVICE_ACCOUNT_${jsonData.client_email}`;
  
  const accountData = {
    private_key: jsonData.private_key,
    private_key_id: jsonData.private_key_id,
    project_id: jsonData.project_id,
    client_id: jsonData.client_id,
    token_uri: jsonData.token_uri
  };

  props.setProperty(accountKey, JSON.stringify(accountData));
  return true;
}

// New function to delete a registered service account
function deleteServiceAccount(serviceAccountEmail) {
  const props = PropertiesService.getUserProperties();
  const accountKey = `SERVICE_ACCOUNT_${serviceAccountEmail}`;
  props.deleteProperty(accountKey);
  return true;
}

// New function to get all registered accounts
function getRegisteredAccounts() {
  const props = PropertiesService.getUserProperties();
  return props.getKeys()
    .filter(key => key.startsWith('SERVICE_ACCOUNT_'))
    .map(key => key.replace('SERVICE_ACCOUNT_', ''));
}

/***********************
 * AUTH UTILITIES: SERVICE ACCOUNTS
 ***********************/

/**
 * Retrieves an access token for a service account, impersonating a specified user.
 * 
 * @param {string} serviceAccountEmail - The email address of the service account.
 * @param {string} impersonateAsEmail - The email address of the user to impersonate.
 * 
 * @returns {string} The access token for the service account.
 * 
 * @throws {Error} If the service account is not registered or if access token retrieval fails.
 */
function getServiceAccountAccessToken(serviceAccountEmail, impersonateAsEmail) {
  console.log(`Generating access token. Impersonating "${impersonateAsEmail}"...`);
  
  // Retrieve auth details from properties
  const props = PropertiesService.getUserProperties();
  const accountKey = `SERVICE_ACCOUNT_${serviceAccountEmail}`;
  const accountData = JSON.parse(props.getProperty(accountKey));

  if (!accountData) {
    throw new Error(`No account found for ${serviceAccountEmail}. Register first.`);
  }

  const privateKey = accountData.private_key;
  const privateKeyId = accountData.private_key_id;

  const tokenUrl = 'https://accounts.google.com/o/oauth2/token';
  const assertion = getJWTAssertion(serviceAccountEmail, impersonateAsEmail, privateKey, privateKeyId);
  
  const response = UrlFetchApp.fetch(tokenUrl, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
    muteHttpExceptions: true
  });

  const json = JSON.parse(response.getContentText());
  if (!json.access_token) {
    throw new Error('Failed to get access token: ' + response.getContentText());
  }

  return json.access_token;
}

// Function to generate JWT assertion (Updated)
function getJWTAssertion(serviceAccountEmail, impersonateAsEmail, privateKey, privateKeyId) {
  console.log('Generating JTW token...');
  const header = {
    "alg": "RS256",
    "typ": "JWT",
    "kid": privateKeyId
  };

  const payload = {
    "iss": serviceAccountEmail,
    "sub": impersonateAsEmail, // Update with your admin email
    "aud": "https://accounts.google.com/o/oauth2/token",
    "iat": Math.floor(Date.now() / 1000),
    "exp": Math.floor(Date.now() / 1000) + 3600,
    "scope": "https://www.googleapis.com/auth/calendar"
  };

  const base64Header = Utilities.base64EncodeWebSafe(JSON.stringify(header));
  const base64Payload = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const signature = signRSA(`${base64Header}.${base64Payload}`, privateKey);

  return `${base64Header}.${base64Payload}.${signature}`;
}

// RSA Signing Helper (unchanged)
function signRSA(input, privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n'); // Fix formatting
  var signatureBytes = Utilities.computeRsaSha256Signature(input, privateKey);
  return Utilities.base64EncodeWebSafe(signatureBytes); // ✅ proper encoding
}

/***********************
 * EVENTS UTILITIES: FIND EVENTS
 ***********************/

/**
 * Retrieves a Google Calendar event by its API ID and returns its details.
 * 
 * **Note:** This function requires the Google Calendar service to be enabled.
 * To enable it, follow these steps:
 * 1. Open your Google Apps Script project.
 * 2. Click on **Services** in the left sidebar.
 * 3. Search for **Google Calendar API** and click on it.
 * 4. Click on **Add Service**.
 * 
 * @param {string} [eventId] The API ID (e.g. "de7v569tt2t6sa2ne39gv0pbqs") of the event to retrieve.
 * @param {string} [calendarId] The ID of the calendar where the event is located. Defaults to 'primary' if not specified.
 * 
 * @returns {object} An object containing the event details:
 *   - title: The title of the event.
 *   - description: The description of the event.
 *   - location: The location of the event.
 *   - googleMeetUrl: The Google Meet URL for the event.
 *   - calendarId: The ID of the calendar where the event is located.
 *   - iCalId: The iCal ID of the event.
 *   - joinByPhone: An object containing phone details for joining the event.
 *   - invitees: A comma-separated list of attendee email addresses.
 *   - htmlLink: The HTML link to view the event in Google Calendar.
 */
function getEventById(eventId, calendarId='primary') {
  console.log(`Retrieving Google Calendar event "${eventId}"...`);
  if (!calendarId) {
    calendarId = 'primary';
  }

  var options = {
    'calendarId': calendarId,
    'eventId': eventId
  };

  try {
    var event = Calendar.Events.get(options.calendarId, options.eventId);

    //Logger.log('Event Retrieved:');
    //Logger.log(JSON.stringify(event, null, 2));

    // Extract and log event details
    var details = {
      id: event.id,
      iCalId: event.iCalUID,
      calendarId: options.calendarId,
      title: event.summary,
      description: event.description,
      location: event.location,
      googleMeetUrl: event.hangoutLink,
      joinByPhone: getJoinByPhone(event),
      invitees: getInvitees(event),
      htmlLink: event.htmlLink
    };

    //Logger.log(`details: ${JSON.stringify(details, null, 2)}`);
    return details;

  } catch (e) {
    if (e.message.includes("Calendar service not found")) {
      Logger.log('Error: The Google Calendar service is not enabled. Please follow these steps to enable it:');
      Logger.log('1. Open your Google Apps Script project.');
      Logger.log('2. Click on **Services** in the left sidebar.');
      Logger.log('3. Search for **Google Calendar API** and click on it.');
      Logger.log('4. Click on **Add Service**.');
    } else {
      Logger.log('Error: ' + e.message);
    }
  }
}

function getJoinByPhone(event) {
  if (event.conferenceData && event.conferenceData.entryPoints) {
    var phoneDetails = {};
    for (var i = 0; i < event.conferenceData.entryPoints.length; i++) {
      var entryPoint = event.conferenceData.entryPoints[i];
      if (entryPoint.uri && entryPoint.uri.startsWith('tel:')) {
        phoneDetails.number = entryPoint.uri.replace('tel:', '');
        phoneDetails.label = entryPoint.label;
      } else if (entryPoint.uri && entryPoint.uri.includes('tel.meet')) {
        phoneDetails.url = entryPoint.uri;
        phoneDetails.pin = entryPoint.pin;
      }
    }
    return Object.keys(phoneDetails).length > 0 ? phoneDetails : {};
  }
  return {};
}

function getInvitees(event) {
  var invitees = [];
  if (event.attendees) {
    for (var i = 0; i < event.attendees.length; i++) {
      var attendee = event.attendees[i];
      invitees.push(attendee.email);
    }
  }
  return invitees.join(', ');
}

/**
 * Retrieves all calendar events for a specified date from the user's default calendar.
 *
 * @param {Date} date - The date for which to retrieve events.
 * @returns {Array<Object>} An array of objects, each representing a calendar event.
 * @returns {string} return.title - The title of the event.
 * @returns {Date} return.start - The start time of the event.
 * @returns {Date} return.end - The end time of the event.
 * @returns {string} return.description - The description of the event.
 * @returns {string} return.location - The location of the event.
 * @returns {string} return.apiEventId - The API event ID.
 *
 * @example
 * const date = new Date('2025-02-14');
 * const events = getCalendarEventsByDate(date);
 * console.log(events);
 */
function getCalendarEventsByDate(date) {
  Logger.log('Function started: getCalendarEventsByDate');
  Logger.log('Input date: ' + date);

  // Get the default calendar
  const calendarId = CalendarApp.getDefaultCalendar().getId();
  Logger.log('Default calendar retrieved');

  // Create start and end date for the given day
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  Logger.log('Start date: ' + startDate);
  Logger.log('End date: ' + endDate);

  // Get events within the specified date range using the Google Calendar API
  var options = {
    "timeMin": Utilities.formatDate(startDate, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    "timeMax": Utilities.formatDate(endDate, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
  };

  var events = Calendar.Events.list(calendarId, options).items;
  Logger.log('Number of events retrieved: ' + events.length);

  // Process event details and store in an array
  const eventDetails = events.map((event) => {
    Logger.log('Processing event');
    const apiEventId = event.id;
    const title = event.summary;
    const start = new Date(event.start.dateTime || event.start.date);
    const end = new Date(event.end.dateTime || event.end.date);
    const description = event.description;
    const location = event.location;
    const iCalId = event.iCalUID;

    return {
      id: iCalId,
      apiEventId: apiEventId,
      calendarId: calendarId, // Use the outer scope's calendarId
      title: title,
      start: start,
      end: end,
      description: description,
      location: location
    };
  });

  Logger.log('Function completed: getCalendarEventsByDate');
  Logger.log(`eventDetails: ${JSON.stringify(eventDetails, null, 2)}`);
  return eventDetails;
}

/**
 * Retrieves a Google Calendar event by its Google Meet URL, searching around a specified meet time.
 * 
 * @param {string} meetUrl - The Google Meet URL to search for in event descriptions or locations.
 * @param {string} meetTime - The time around which to search for the event, in ISO format.
 * 
 * @returns {object|null} An object containing the event details:
 *   - title: The title of the event.
 *   - description: The description of the event.
 *   - location: The location of the event.
 *   - googleMeetUrl: The Google Meet URL for the event.
 *   - calendarId: The ID of the calendar where the event is located.
 *   - iCalId: The iCal ID of the event.
 *   - joinByPhone: An object containing phone details for joining the event.
 *   - invitees: A comma-separated list of attendee email addresses.
 *   - htmlLink: The HTML link to view the event in Google Calendar.
 */
function getCalendarEventByGoogleMeetUrl(meetUrl, meetTime) {
  console.log(`Searching for Google Calendar event with Google Meet URL "${meetUrl}"...`);

  var calendarId = 'primary'; // Default calendar ID
  var calendar = CalendarApp.getDefaultCalendar();

  // Convert meetTime to a Date object
  var meetTimeDate = new Date(meetTime);

  // Calculate the search range: 12 hours before and after the meet time
  var startTime = new Date(meetTimeDate.getTime() - (12 * 60 * 60 * 1000)); // 12 hours before
  var endTime = new Date(meetTimeDate.getTime() + (12 * 60 * 60 * 1000)); // 12 hours after

  var events = calendar.getEvents(startTime, endTime);

  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    var iCalId = event.getId();

    // Use the Google Calendar API to get the API event ID
    var apiEvents = Calendar.Events.list(calendarId, {
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    var apiEventId = null;
    var apiEventList = apiEvents.items;
    for (var j = 0; j < apiEventList.length; j++) {
      if (apiEventList[j].iCalUID === iCalId) {
        apiEventId = apiEventList[j].id;
        break;
      }
    }

    if (apiEventId) {
      // Get event details using getEventById with API event ID
      var eventDetails = getEventById(apiEventId);

      // Check if eventDetails is not undefined
      if (eventDetails && eventDetails.googleMeetUrl) {
        if (eventDetails.googleMeetUrl === meetUrl) {
          Logger.log(`Event found by Google Meet URL: ${eventDetails.title}`);
          Logger.log(`event: ${JSON.stringify(eventDetails, null, 2)}`);
          return eventDetails;
        }
      } else {
        Logger.log(`Failed to retrieve event details for event ID: ${apiEventId}`);
      }
    } else {
      Logger.log(`Failed to find API event ID for iCal ID: ${iCalId}`);
    }
  }

  Logger.log("No event found with the specified Google Meet URL.");
  return null;
}

/***********************
 * EVENTS UTILITIES: UPDATE EVENTS
 ***********************/

/**
 * Updates multiple aspects of a Google Calendar event in a single API call using a service account.
 * 
 * @param {string} eventId - The API ID of the event to update
 * @param {Object} updates - An object containing fields to update:
 *   - {string} [newTitle] - New event title
 *   - {string} [newDescription] - New event description. Supports markdown hyperlinks in the format `[text](url)`.
 *   - {string} [newLocation] - New event location
 *   - {Array<Object>} [invitees] - Array of invitee details:
 *     - {string} email - Invitee email address
 *     - {string} [role='reader'] - Invitee role (reader/writer/owner)
 *     - {boolean} [notify=false] - Send notification to invitee
 * @param {string} serviceAccountEmail - The email address of the service account.
 * @param {string} impersonateAsEmail - The email address of the user to impersonate.
 * @param {string} [calendarId='primary'] - Calendar ID (defaults to primary)
 * 
 * @returns {Object} The updated event details
 */
function updateCalendarEventByServiceAccount(
  eventId = "g5s4sv9brcc3iq4su6ljqga408",
  updates = {
    newTitle: "Updated title2",
    newDescription: "Updated description",
    newLocation: "New location",
  },
  serviceAccountEmail = 'revsup-calendar@candidate-qualification.iam.gserviceaccount.com',
  impersonateAsEmail = 'chris@revsup.com',
  calendarId = 'primary'
) {
  console.log(`Updating event ID: ${eventId}...`);

  try {
    // Get access token
    var accessToken = getServiceAccountAccessToken(serviceAccountEmail, impersonateAsEmail);

    // Get current event state
    var options = {
      "method": "GET",
      "headers": {
        "Authorization": "Bearer " + accessToken
      }
    };
    var response = UrlFetchApp.fetch(
      'https://www.googleapis.com/calendar/v3/calendars/' + calendarId + '/events/' + eventId,
      options
    );
    var currentEvent = JSON.parse(response.getContentText());

    // Prepare updated resource
    var eventResource = {};
    var fieldsToUpdate = [];

    // Handle title update
    if (updates.newTitle) {
      eventResource.summary = updates.newTitle;
      fieldsToUpdate.push('summary');
    }

    // Handle description update
    if (updates.newDescription) {
      eventResource.description = updates.newDescription.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
      fieldsToUpdate.push('description');
    }

    // Handle location update
    if (updates.newLocation) {
      eventResource.location = updates.newLocation;
      fieldsToUpdate.push('location');
    }

    // Handle invitee addition
    if (updates.invitees) {
      eventResource.attendees = currentEvent.attendees || [];
      updates.invitees.forEach(invitee => {
        eventResource.attendees.push({
          email: invitee.email,
          role: invitee.role || 'reader'
        });
      });
      fieldsToUpdate.push('attendees');
    }

    // Configure API options to send updates to all guests
    options = {
      "method": "patch",
      "headers": {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json"
      },
      "payload": JSON.stringify(eventResource),
      "sendUpdates": "all"
    };

    // Execute update
    response = UrlFetchApp.fetch(
      'https://www.googleapis.com/calendar/v3/calendars/' + calendarId + '/events/' + eventId,
      options
    );

    var updatedEvent = JSON.parse(response.getContentText());

    Logger.log(`Updated Event: ${JSON.stringify(updatedEvent, null, 2)}`);
    Logger.log(`Successfully updated event ${eventId}`);
    return updatedEvent;

  } catch (e) {
    Logger.log(`Error updating event: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);
    throw e;
  }
}

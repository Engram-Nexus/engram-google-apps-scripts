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
function getEventById(eventId, calendarId = 'primary') {
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
function getCalendarEventsByDate(date = '2025-03-17') {
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
function getCalendarEventByGoogleMeetUrl(meetUrl = "https://meet.google.com/xds-qfey-qja", meetTime = "2025-03-14T13:30:00.000000Z") {
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

/**
 * Updates multiple aspects of a Google Calendar event in a single API call.
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
 * @param {string} [calendarId='primary'] - Calendar ID (defaults to primary)
 * 
 * @returns {Object} The updated event details
 */
function updateCalendarEvent(
  eventId = "g5s4sv9brcc3iq4su6ljqga408",
  updates = {
    newTitle: "Updated title",
    newDescription: "Updated description",
    newLocation: "New location",
    invitees: [
      {
        email: "chris@infinityweb.com",
        role: "reader",
        notify: false
      },
      {
        email: "guest@example.com",
        role: "reader",
        notify: true
      }
    ]
  },
  calendarId = 'primary'
) {
  console.log(`Updating event ID: ${eventId}...`);

  try {
    // Get current event state
    const currentEvent = Calendar.Events.get(calendarId, eventId);

    // Prepare updated resource
    const eventResource = {};
    const fieldsToUpdate = [];

    // Handle title update
    if (updates.newTitle) {
      eventResource.summary = updates.newTitle; // Google Calendar API uses 'summary' for event title
      fieldsToUpdate.push('summary');
    }

    // Handle description update
    if (updates.newDescription) {
      // Convert markdown hyperlinks to HTML
      const htmlDescription = convertMarkdownToHtml(updates.newDescription);
      eventResource.description = htmlDescription;
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

    // Determine if notifications should be sent
    const sendNotifications = updates.invitees?.some(invitee => invitee.notify) || false;

    // Configure API options
    const options = {
      calendarId,
      eventId,
      resource: eventResource,
      sendNotifications,
      fields: fieldsToUpdate.join(',')
    };

    // Execute update
    const updatedEvent = Calendar.Events.patch(
      options.resource,
      options.calendarId,
      options.eventId,
      {
        sendNotifications: options.sendNotifications,
        fields: options.fields
      }
    );

    Logger.log(`Successfully updated event ${eventId}`);
    Logger.log(JSON.stringify(updatedEvent, null, 2));
    return updatedEvent;

  } catch (e) {
    Logger.log(`Error updating event: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);
    throw e;
  }
}

// Function to convert markdown hyperlinks to HTML
function convertMarkdownToHtml(markdownText) {
  // Convert markdown hyperlinks to HTML
  markdownText = markdownText.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  return markdownText;
}

/**
 * Updates the description of a Google Calendar event using its API event ID.
 * 
 * @param {string} eventId - The API ID of the event to update.
 * @param {string} newDescription - The new description for the event.
 * @param {string} [calendarId='primary'] - The ID of the calendar where the event is located. Defaults to 'primary' if not specified.
 * 
 * @returns {object} The updated event details.
 */
function updateEventDescription(eventId = "b8dhunpij70bl2sq08shagonps", newDescription = "Here we go", calendarId = 'primary') {
  console.log(`Updating event description for event ID: ${eventId}...`);

  var options = {
    'calendarId': calendarId,
    'eventId': eventId,
    'resource': {
      'description': newDescription
    },
    'fields': 'description'
  };

  try {
    var updatedEvent = Calendar.Events.patch(options.resource, options.calendarId, options.eventId, options);
    Logger.log(`Event description updated successfully for event ID: ${eventId}`);
    Logger.log(`Updated Event Details: ${JSON.stringify(updatedEvent, null, 2)}`);
    return updatedEvent;
  } catch (e) {
    Logger.log(`Error updating event description: ${e.message}`);
  }
}

/**
 * Updates the location of a Google Calendar event using its API event ID.
 * 
 * @param {string} eventId - The API ID of the event to update.
 * @param {string} newLocation - The new location for the event.
 * @param {string} [calendarId='primary'] - The ID of the calendar where the event is located. Defaults to 'primary' if not specified.
 * 
 * @returns {object} The updated event details.
 */
function updateEventLocation(eventId = "5enc9eqln1p14q8ols1pouumbg", newLocation = "RevsUp Google Meet", calendarId = 'primary') {
  console.log(`Updating event location for event ID: ${eventId}...`);

  var options = {
    'calendarId': calendarId,
    'eventId': eventId,
    'resource': {
      'location': newLocation
    },
    'fields': 'location'
  };

  try {
    var updatedEvent = Calendar.Events.patch(options.resource, options.calendarId, options.eventId, { fields: options.fields });
    Logger.log(`Event location updated successfully for event ID: ${eventId}`);
    Logger.log(`Updated Event Details: ${JSON.stringify(updatedEvent, null, 2)}`);
    return updatedEvent;
  } catch (e) {
    Logger.log(`Error updating event location: ${e.message}`);
  }
}

/**
 * Adds an invitee to a Google Calendar event using its API event ID.
 * 
 * @param {string} eventId - The API ID of the event to update.
 * @param {string} inviteeEmail - The email address of the invitee to add.
 * @param {string} [role='reader'] - The role of the invitee. Available roles include:
 *   - reader: The attendee can see the event details but cannot modify them.
 *   - writer: The attendee can modify the event details.
 *   - owner: The attendee has full control over the event.
 *   Defaults to 'reader' if not specified.
 * @param {boolean} [notifyInvitee=false] - Whether to send a notification to the invitee. Defaults to false if not specified.
 * @param {string} [calendarId='primary'] - The ID of the calendar where the event is located. Defaults to 'primary' if not specified.
 * 
 * @returns {object} The updated event details.
 */
function addInviteeToEvent(eventId = 'b8dhunpij70bl2sq08shagonps', inviteeEmail = 'chris@infinityweb.app', role = "reader", notifyInvitee = false, calendarId = 'primary') {
  console.log(`Adding invitee (${inviteeEmail}) to event ID: ${eventId}...`);

  try {
    // First, retrieve the current attendees to avoid overwriting them
    var currentEvent = Calendar.Events.get(calendarId, eventId);
    var currentAttendees = currentEvent.attendees;

    // Add the new invitee to the list of attendees
    currentAttendees.push({
      'email': inviteeEmail,
      'role': role
    });

    // Update the event with the new list of attendees
    var options = {
      'calendarId': calendarId,
      'eventId': eventId,
      'resource': {
        'attendees': currentAttendees
      },
      'sendNotifications': notifyInvitee,
      'fields': 'attendees'
    };

    var updatedEvent = Calendar.Events.patch(options.resource, options.calendarId, options.eventId, {
      'sendNotifications': options.sendNotifications,
      'fields': options.fields
    });

    Logger.log(`Invitee added successfully to event ID: ${eventId}`);
    Logger.log(`Updated Event Details: ${JSON.stringify(updatedEvent, null, 2)}`);
    return updatedEvent;
  } catch (e) {
    Logger.log(`Error adding invitee: ${e.message}`);
  }
}
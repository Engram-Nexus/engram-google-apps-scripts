/**
 * Webhooks
 * --------
 * This function handles incoming webhook requests, creates a new client, and logs the payload to a Logs spreadsheet.
 */

/**
 * Main entry point for handling webhooks.
 * Determines whether the webhook is from Calendly or Notion and directs it accordingly.
 * @param {Object} e - The event object containing the webhook data.
 */
function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (data.created_by && data.created_by.includes("https://api.calendly.com/")) {
    // This is a Calendly webhook
    processCalendlyWebhookAsync(data);
  } else if (data.source && data.source.type === "automation") {
    // This is a Notion webhook
    processNotionWebhookAsync(data);
  } else {
    // Handle unknown webhook types
    Logger.log("Unknown webhook type received.");
  }
}

/**
 * Processes webhook data asynchronously based on the provided JSON data.
 * @param {Object} data - The JSON data from a webhook.
 */
function processCalendlyWebhookAsync(data) {
  var logMessage = "";
  var event = "";
  try {
    // Log the raw webhook data
    logToSpreadsheet("Webhook Data", JSON.stringify(data));

    event = data.event;
    var dataToLog = [
      {
        "Created At": data.created_at,
        "Event": event,
        "Payload": JSON.stringify(data)
      }
    ];
    appendDataToLog(WEBHOOKS_RECEIVED_SHEET_NAME, WEBHOOKS_RECEIVED_HEADERS, dataToLog, 'top');

    // Process based on the action
    if (event === "routing_form_submission.created") {
      logToSpreadsheet("Event initialized", event);

      var dataToLogRoutingForm = [
        {
          "Created At": data.payload.created_at,
          "Questions & Answers": JSON.stringify(data.payload.questions_and_answers),
          "URI": data.payload.uri
        }
      ];

      createOrUpdateLogData(FORMSUBMISSIONS_SHEETNAME, FORMSUBMISSIONS_HEADERS, dataToLogRoutingForm, ["URI"], 'top');

    } else if (event === "invitee.created") {
      logToSpreadsheet("Event initialized", event);

      var dataToLogMeeting = [
        {
          "Created At": data.payload.created_at,
          "Meeting Name": data.payload.scheduled_event.name,
          "Start Time": data.payload.scheduled_event.start_time,
          "Invitee Email": data.payload.email,
          "Invitee Name": data.payload.name,
          "Form Submission URI": data.payload.routing_form_submission,
          "Questions & Answers": JSON.stringify(data.payload.questions_and_answers),
          "Event": JSON.stringify(data.payload.scheduled_event),
          "Reschedule URL": data.payload.reschedule_url,
          "Rescheduled": data.payload.rescheduled,
          "URI": data.payload.uri,
          "Status": data.payload.status
        }
      ];

      createOrUpdateLogData(MEETINGINVITES_SHEETNAME, MEETINGINVITES_HEADERS, dataToLogMeeting, ["URI"], 'top');

    } else {
      // Handle unknown event
      logMessage += `Event is '${event}'. No process performed.\n\n`;
    }

    // Log success message
    logToSpreadsheet("Webhook Log - Success", logMessage);
  } catch (error) {
    // Handle and log any errors
    logMessage += "Error in processWebhookAsync: " + error.toString() + "\n\n";
    logToSpreadsheet("Webhook Error Log", logMessage);
  }
}

/**
 * Processes webhook data asynchronously.
 * @param {Object} data - The JSON data from a webhook.
 */
function processNotionWebhookAsync(data) {
  var logMessage = "";
  var notionId = "";
  var properties = {};
  try {
    // Log the raw webhook data
    logToSpreadsheet("Webhook Data", JSON.stringify(data));

    // Extract Notion ID from JSON data
    notionId = data.data.id.replace(/-/g, '');

    // Extract relevant properties from JSON data
    properties = extractNotionProperties(data, ["Action", "Share Link", "Form Name"]);

    // Ensure notionId is set
    if (!notionId) {
      throw new Error("Unable to extract Notion ID from provided data");
    }

    logToSpreadsheet("Notion Properties", JSON.stringify(properties));
    logToSpreadsheet("Notion Page ID", notionId);

    // Extract specific properties
    var action = properties.hasOwnProperty("Action") ? properties["Action"] : null;
    var shareLink = properties.hasOwnProperty("Share Link") ? properties["Share Link"] : null;
    var formName = properties.hasOwnProperty("Form Name") ? properties["Form Name"] : null;

    // Process based on the action
    if (action === "Register Calendly form") {
      try {
        sendNotionMessage(notionId, `Running "${action}" process...`);
        logToSpreadsheet("Action in-progress", `Running "${action}" process...`);

        // Register the form
        registerRoutingForm(jobName);

        logToSpreadsheet("Process complete", "Calendly form registered successfully.");
        sendNotionMessage(notionId, `Questionnaire form registered successfully.`, 'success');

      } catch (refreshError) {
        // Handle refresh errors
        logMessage += `Error registering Calendly form: ${refreshError.message}\n\n`;
        sendNotionMessage(notionId, `Error registering Calendly form: ${refreshError.message}`, "warning");
        throw refreshError;
      }
    } else {
      // Handle unknown action
      logMessage += `Action is '${action}'. No process performed.\n\n`;
      sendNotionMessage(notionId, `Action is '${action}'. No process performed.`, "warning");
    }

    // Log success message
    logToSpreadsheet("Webhook Log - Success", logMessage);

  } catch (error) {
    // Handle and log any errors
    logMessage += "Error in processWebhookAsync: " + error.toString() + "\n\n";
    if (notionId) {
      sendNotionMessage(notionId, "Error in processWebhookAsync: " + error.toString(), "warning");
    }
    logToSpreadsheet("Webhook Error Log", logMessage);
  }
}

function handleCors() {
  return createJsonResponse({});
}

function createJsonResponse(responseData) {
  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type')
    .addHeader('Access-Control-Max-Age', '3600');
}

/**
 * Logs information to a spreadsheet, creating an empty row for each new run.
 * 
 * @param {string} subject - The subject of the log entry.
 * @param {string} message - The message to be logged.
 * @param {boolean} [isNewRun=false] - Indicates if this is the start of a new run.
 */
function logToSpreadsheet(subject, message, isNewRun = false) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Logs");

  if (!sheet) {
    sheet = ss.insertSheet("Logs");
    var headers = ["Timestamp", "Subject", "Message"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Bold the headers
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

    // Freeze the header row
    sheet.setFrozenRows(1);
  }

  // If this is a new run, insert an empty row
  if (isNewRun) {
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, 3).setValues([['', '', '']]);
    sheet.getRange(2, 1, 1, 3).setFontWeight("normal");
  }

  // Insert a new row for the log entry
  sheet.insertRowAfter(1);

  // Add the new log entry to row 2
  sheet.getRange(2, 1, 1, 3).setValues([[new Date(), subject, message]]);

  // Ensure the newly added row is not bolded
  sheet.getRange(2, 1, 1, 3).setFontWeight("normal");
}
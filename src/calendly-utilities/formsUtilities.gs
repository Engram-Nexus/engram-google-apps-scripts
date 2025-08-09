/***********************
 * FORMS UTILITES: FORMS ADMIN
 ***********************/

/**
 * Registers a Calendly routing form by its title and updates a Notion page and a Google Sheets log.
 * 
 * This function retrieves the routing form details using getRoutingFormByTitle, finds a Notion page by the form title using findNotionPagesByProperties, and logs the form submission URI in a Google Sheets log using createOrUpdateLogData.
 * 
 * @param {string} formTitle - The title of the routing form to register.
 * @param {string} notionDatabaseId - The ID of the Notion database to query.
 * @param {string} sheetName - The name of the Google Sheets log to update.
 * 
 * @return {void} Updates the Notion page and Google Sheets log.
 * 
 * @throws {Error} If there is an issue with the API requests.
 */
function registerRoutingForm(formTitle) {
  try {
    // Retrieve the routing form details
    var routingForm = getRoutingFormByTitle(formTitle);
    
    if (!routingForm) {
      throw new Error("Failed to retrieve routing form details.");
    }
    
    // Find the Notion page by the form title
    var notionMatchProperties = [
      {
        "name": "Job Name", "match": formTitle
      }
    ];
    var notionPageIds = findNotionPagesByProperties(ROUTINGFORMS_NOTION_DATABASE_ID, notionMatchProperties);
    
    if (notionPageIds.length === 0) {
      throw new Error("No Notion page found matching the form title.");
    } else {
      // Update the Notion page (logic to update the page goes here)
      var notionPageId = notionPageIds[0];
      Logger.log(`Found Notion page ID: ${notionPageId}`);
      var notionPageProperties = getNotionPageProperties(notionPageId);
      Logger.log(`Notion page properties: ${JSON.stringify(notionPageProperties, null, 2)}`);
      // Call a function to update the Notion page if needed
    }
    
    // Log the form submission URI in Google Sheets
    var logData = [
      {
        "Created At": routingForm.created_at,
        "Form Title": routingForm.name,
        "Questions": JSON.stringify(routingForm.questions),
        "Share Link": notionPageProperties["Share Link"],
        "URI": routingForm.uri,
        "Notion Page ID": notionPageId,
        "Status": routingForm.status
      }
    ];
    
    createOrUpdateLogData(ROUTINGFORMS_SHEETNAME, ROUTINGFORMS_HEADERS, logData, ["URI"], 'top');
    var properties = [{name: "Form Status", value: "Registered", type: "status"}];
    updatePageProperties(notionPageId, properties);
    return logData;
    
  } catch (error) {
    Logger.log(`Error registering routing form: ${error.message}`);
    throw error;
  }
}

/**
 * Generates a form link with URL parameters based on a form URI.
 * 
 * @param {string} formUri - The URI of the form to retrieve the share link for.
 * @param {Object} params - An object containing URL parameter keys and values.
 * 
 * @return {string} The generated form link with URL parameters.
 */
function generateFormLinkWithParams(
  formUri="https://api.calendly.com/routing_forms/07c6d5c2-867d-41dc-88c0-f74b7c0ccbb8",
  params={
    "name": "Chris Rex",
    "email": "crexltp@gmail.com",
    "utm_source": "01234567",
    "salesforce_uuid": "01234567"
  }
) {
  // Find the row matching the form URI to get the share link
  var sheetData = findRowsByHeaderAndValue(ROUTINGFORMS_SHEETNAME, "URI", formUri, "data");
  
  if (sheetData.length > 0) {
    var formLink = sheetData[0]["Share Link"];
    
    if (formLink) {
      // Generate the form link with URL parameters
      var queryString = Object.keys(params).map(function (key) {
        return key + "=" + encodeURIComponent(params[key]);
      }).join("&");

      if (queryString) {
        var formLinkWithQueryString = formLink + "?" + queryString;
        Logger.log(`Share link: ${formLinkWithQueryString}`)
        return formLinkWithQueryString;
      } else {
        return formLink;
      }
    } else {
      Logger.log("No share link found for the form URI.");
      return null;
    }
  } else {
    Logger.log("No matching row found for the form URI.");
    return null;
  }
}

/***********************
 * FORMS UTILITES: GET FORMS
 ***********************/

/**
 * Retrieves a list of all routing forms for a specified organization in Calendly.
 * 
 * This function fetches routing forms using a Calendly Personal Access Token stored in script properties.
 * It supports pagination and optional query parameters for filtering forms.
 * 
 * @return {array} An array of routing form objects. Each form object contains details such as:
 *   - `created_at`: The timestamp when the form was created.
 *   - `name`: The name of the routing form.
 *   - `organization`: The URI of the organization associated with the form.
 *   - `questions`: An array of question objects, each containing:
 *     - `answer_choices`: An array of possible answer choices.
 *     - `name`: The name of the question.
 *     - `required`: Whether the question is required.
 *     - `type`: The type of the question (e.g., "textarea", "text").
 *     - `uuid`: The UUID of the question.
 *   - `status`: The status of the form (e.g., "published", "draft").
 *   - `updated_at`: The timestamp when the form was last updated.
 *   - `uri`: The URI of the routing form.
 * 
 * @throws {Error} If there is an issue with the API request.
 */
function listRoutingForms() {
  console.log('Retrieving all Calendly Forms...');

  var apiEndpoint = "https://api.calendly.com/routing_forms";

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
    "organization": organizationUri,
    "count": 100 // Optional: Set the number of forms per page
    // Add other query parameters as needed, e.g., page_token, sort
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

        // Recursively fetch the next page of routing forms
        listNextRoutingFormsPage(nextPageUrl, options);
      }

      var forms = data.collection;
      Logger.log(`${forms.length} forms found.`);
      //Logger.log(`Forms: ${JSON.stringify(forms, null, 2)}`);
      return forms; // Return the parsed response object
    } else {
      Logger.log("Failed to retrieve routing forms. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error fetching routing forms: " + e);
  }

  return null;
}

function listNextRoutingFormsPage(nextUrl, options) {
  try {
    var response = UrlFetchApp.fetch(nextUrl, options);
    var responseCode = response.getResponseCode();

    if (responseCode === 200) {
      var json = response.getContentText();
      var data = JSON.parse(json);

      // Process the next page of routing forms data here
      Logger.log(data);

      if (data.pagination.next_page_token) {
        var nextPageUrl = nextUrl + "&page_token=" + data.pagination.next_page_token;

        // Recursively fetch the next page of routing forms
        listNextRoutingFormsPage(nextPageUrl, options);
      }
    } else {
      Logger.log("Failed to retrieve next page of routing forms. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error fetching next page of routing forms: " + e);
  }
}

/**
 * Retrieves a Calendly routing form based on the provided URI.
 * 
 * This function fetches the routing form using a Calendly Personal Access Token stored in script properties.
 * 
 * @param {string} routingFormUri - The URI of the Calendly routing form to retrieve.
 * 
 * @return {Object|null} The retrieved routing form data, or null if the request fails.
 * 
 * @throws {Error} If there is an issue with the API request.
 */
function getRoutingForm(routingFormUri="https://api.calendly.com/routing_forms/07c6d5c2-867d-41dc-88c0-f74b7c0ccbb8") {
  var calendlyToken = PropertiesService.getScriptProperties().getProperty('CALENDLY_PERSONAL_ACCESS_TOKEN');
  
  if (!calendlyToken) {
    Logger.log("Calendly Personal Access Token is not set. Please configure it in the script properties.");
    return null;
  }
  
  var options = {
    "method": "get",
    "headers": {
      "Authorization": "Bearer " + calendlyToken,
      "accept": "application/json"
    },
    "muteHttpExceptions": true // To capture the full response even if it's an error
  };
  
  var uuid = routingFormUri.split("/").pop(); // Extract the routing form UUID from the URI
  var apiEndpoint = "https://api.calendly.com/routing_forms/" + uuid;
  
  try {
    var response = UrlFetchApp.fetch(apiEndpoint, options);
    var responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      var json = response.getContentText();
      var data = JSON.parse(json);
      
      // Log the raw response before processing
      Logger.log(`Raw Response: ${JSON.stringify(data, null, 2)}`);
      
      return data.resource; // Return the parsed response object
    } else {
      Logger.log("Failed to retrieve routing form. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
      return null;
    }
  } catch (e) {
    Logger.log("Error fetching routing form: " + e);
    return null;
  }
}

/**
 * Retrieves a Calendly routing form by its title.
 * 
 * This function uses the listRoutingForms function to fetch all routing forms and then finds the form that matches the specified title.
 * 
 * @param {string} formTitle - The title of the routing form to retrieve.
 * 
 * @return {Object|null} The routing form object that matches the title, or null if no match is found. The routing form object contains details such as:
 *   - `created_at`: The timestamp when the form was created.
 *   - `name`: The name of the routing form.
 *   - `organization`: The URI of the organization associated with the form.
 *   - `questions`: An array of question objects, each containing:
 *     - `answer_choices`: An array of possible answer choices.
 *     - `name`: The name of the question.
 *     - `required`: Whether the question is required.
 *     - `type`: The type of the question (e.g., "textarea", "text").
 *     - `uuid`: The UUID of the question.
 *   - `status`: The status of the form (e.g., "published", "draft").
 *   - `updated_at`: The timestamp when the form was last updated.
 *   - `uri`: The URI of the routing form.
 * 
 * @throws {Error} If there is an issue with the API request.
 */
function getRoutingFormByTitle(formTitle="Chris Test") {
  var forms = listRoutingForms();
  
  if (!forms) {
    Logger.log("Failed to retrieve routing forms.");
    return null;
  }
  
  // Find the form that matches the title
  var matchingForm = forms.find(function(form) {
    return form.name === formTitle;
  });
  
  console.log(`matchingForm: ${JSON.stringify(matchingForm, null, 2)}`);
  return matchingForm;
}

/***********************
 * FORMS UTILITES: GET FORM SUBMISSIONS
 ***********************/

/**
 * Retrieves a list of routing form submissions for a specified routing form in Calendly.
 * 
 * This function fetches routing form submissions using a Calendly Personal Access Token stored in script properties.
 * It supports pagination and optional query parameters for filtering submissions.
 * 
 * @param {string} routingFormUri The URI of the routing form for which to retrieve submissions.
 * 
 * @return {void} Logs the retrieved routing form submissions data to the console.
 * 
 * @throws {Error} If there is an issue with the API request.
 */
function listAllRoutingFormSubmissions(routingFormUri = "https://api.calendly.com/routing_forms/07c6d5c2-867d-41dc-88c0-f74b7c0ccbb8") {
  console.log(`Retrieving all Calendly Form submissions (form URI: "${routingFormUri}")...`);
  var apiEndpoint = "https://api.calendly.com/routing_form_submissions";

  // Get the Calendly Personal Access Token from script properties
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

  var queryParams = {
    "form": routingFormUri,
    "count": 100 // Optional: Set the number of submissions per page
    // Add other query parameters as needed, e.g., page_token, sort
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
        var nextPageUrl = apiEndpoint + "&form=" + routingFormUri + "&page_token=" + data.pagination.next_page_token;

        // Recursively fetch the next page of routing form submissions
        listNextRoutingFormSubmissionsPage(nextPageUrl, options);
      }

      var submissions = data.collection;
      Logger.log(`${submissions.length} form submissions found.`);
      //Logger.log(`Submissions: ${JSON.stringify(submissions, null, 2)}`);
      return submissions; // Return the parsed response object
    } else {
      Logger.log("Failed to retrieve routing form submissions. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error fetching routing form submissions: " + e);
  }
}

function listNextRoutingFormSubmissionsPage(nextUrl, options) {
  try {
    var response = UrlFetchApp.fetch(nextUrl, options);
    var responseCode = response.getResponseCode();

    if (responseCode === 200) {
      var json = response.getContentText();
      var data = JSON.parse(json);

      // Log the raw response before processing
      Logger.log(`Raw Response: ${JSON.stringify(data, null, 2)}`);

      // Process the next page of routing form submissions data here
      Logger.log(data);

      if (data.pagination.next_page_token) {
        var nextPageUrl = nextUrl + "&page_token=" + data.pagination.next_page_token;

        // Recursively fetch the next page of routing form submissions
        listNextRoutingFormSubmissionsPage(nextPageUrl, options);
      }
    } else {
      Logger.log("Failed to retrieve next page of routing form submissions. Response code: " + responseCode);
      Logger.log("Full server response: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("Error fetching next page of routing form submissions: " + e);
  }
}

/**
 * Retrieves a Calendly routing form submission based on the provided URI.
 * 
 * @param {string} [routingFormSubmissionUri] 
 *   The canonical reference (unique identifier) for the routing form submission.
 * 
 * @returns {Object|null} The retrieved routing form submission data, or null if the request fails.
 * 
 * @throws {Error} If there is an issue with the HTTP request.
 */
function getRoutingFormSubmission(routingFormSubmissionUri = "https://api.calendly.com/routing_form_submissions/8b6e9133-5b27-425b-91f5-b96ebfd8b918") {

  // Get the Calendly Personal Access Token from script properties
  var calendlyToken = PropertiesService.getScriptProperties().getProperty('CALENDLY_PERSONAL_ACCESS_TOKEN');

  if (!calendlyToken) {
    Logger.log("Calendly Personal Access Token is not set. Please configure it in the script properties.");
    return;
  }

  var options = {
    "method": "get",
    "headers": {
      "Authorization": `Bearer ${calendlyToken}`,
      "Content-Type": "application/json"
    },
    "muteHttpExceptions": true // To handle HTTP errors gracefully
  };

  try {
    var response = UrlFetchApp.fetch(routingFormSubmissionUri, options);
    var statusCode = response.getResponseCode();

    if (statusCode === 200) {
      var data = JSON.parse(response.getContentText());
      var routingSubmission = data.resource;
      Logger.log("Successful response from Calendly API:");
      Logger.log(JSON.stringify(routingSubmission, null, 2)); // Log the response data
      return routingSubmission;
    } else {
      Logger.log(`Failed to retrieve routing form submission. Status code: ${statusCode}`);
      Logger.log(response.getContentText());
      return null;
    }
  } catch (error) {
    Logger.log(`Error retrieving routing form submission: ${error}`);
    return null;
  }
}

/***********************
 * FORMS UTILITES: ADD FORM SUBMISSIONS TO NOTION
 ***********************/

/**
 * Retrieves a Calendly routing form submission, finds a Notion page by properties, and updates the page with the form submission data.
 * 
 * @param {string} routingFormSubmissionUri - The URI of the Calendly routing form submission.
 * @param {string} notionDatabaseId - The ID of the Notion database to query.
 * @param {Array<Object>} notionMatchProperties - An array of objects specifying the properties to match in Notion.
 * 
 * @returns {void} Updates the Notion page property with the form submission data.
 * 
 * @throws {Error} If there is an issue with the API requests.
 */
function updateNotionPageWithFormSubmissionData(
  routingFormSubmissionUri,
  notionDatabaseId,
  notionMatchProperties
) {
  // Retrieve the Calendly routing form submission data
  var formSubmissionData = getRoutingFormSubmission(routingFormSubmissionUri);

  if (!formSubmissionData) {
    Logger.log("Failed to retrieve Calendly routing form submission data.");
    return;
  }

  // Find the Notion page by properties
  var notionPageIds = findNotionPagesByProperties(notionDatabaseId, notionMatchProperties);

  if (notionPageIds.length === 0) {
    Logger.log("No Notion pages found matching the specified properties.");
    return;
  }

  // Convert questions and answers to markdown
  var questionsAndAnswers = formSubmissionData.questions_and_answers;
  var markdownContent = questionsAndAnswers.map(function (qa) {
    return `**${qa.question}**\n${qa.answer}`;
  }).join("\n\n");


  // Update the Notion page property
  var notionPageId = notionPageIds[0]; // Use the first matching page ID
  var propertyName = "Meeting Preparation"; // Specify the property to update

  // Call the function to update the Notion page property (assuming you have this function defined)
  // Note: You need to implement or import the updateNotionPageProperty function
  // updateNotionPageProperty(notionPageId, propertyName, markdownContent);

  // For demonstration purposes, log the update result instead
  Logger.log(`Updated property '${propertyName}' for page ID ${notionPageId} with value:\n${markdownContent}`);
}

// Example usage
function main() {
  var routingFormSubmissionUri = "https://api.calendly.com/routing_form_submissions/your-submission-uri";
  var notionDatabaseId = "your-notion-database-id";
  var notionMatchProperties = [
    {
      "name": "Question",
      "match": "Please share anything that will help prepare for our meeting."
    }
  ];

  updateNotionPageWithFormSubmissionData(routingFormSubmissionUri, notionDatabaseId, notionMatchProperties);
}


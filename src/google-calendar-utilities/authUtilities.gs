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
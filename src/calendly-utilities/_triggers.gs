/**
 * Google Sheets Custom Menu
 * --------
 * This section contains functions for handling menu selections.
 */

// Function to create the menu
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Custom Functions')
    .addItem('Manage API Keys', 'showApiKeyModal')
    .addItem('Register Service Accounts', 'showServiceAccountRegistration')
    .addToUi();
}

/***********************
 * MANAGE API KEYS
 ***********************/

// Function to show the API key modal
function showApiKeyModal() {
  var notionKey = getNotionApiKey();
  var calendlyToken = getCalendlyPersonalAccessToken();

  var html = HtmlService.createHtmlOutput(`
    <style>
      .key-item { margin-bottom: 15px; }
      .edit-button { margin-left: 10px; }
    </style>
    <div id="apiKeyForm">
      <div class="key-item">
        <label for="notionKey">Notion API Key:</label>
        <span id="notionStatus">${notionKey ? '✅' : '❌'}</span>
        <button class="edit-button" onclick="editKey('notionKey')">Edit</button><br>
        <input type="password" id="notionKey" name="notionKey" style="display:none;">
      </div>
      <div class="key-item">
        <label for="calendlyToken">Calendly Personal Access Token:</label>
        <span id="calendlyStatus">${calendlyToken ? '✅' : '❌'}</span>
        <button class="edit-button" onclick="editKey('calendlyToken')">Edit</button><br>
        <input type="password" id="calendlyToken" name="calendlyToken" style="display:none;">
      </div>
      <input type="submit" value="Save Changes" onclick="saveChanges()">
    </div>
    <script>
      function editKey(keyId) {
        document.getElementById(keyId).style.display = 'inline';
        document.getElementById(keyId + 'Status').style.display = 'none';
      }
      function saveChanges() {
        var notionKey = document.getElementById('notionKey').value;
        var calendlyToken = document.getElementById('calendlyToken').value;
        google.script.run.withSuccessHandler(function() {
          google.script.host.close();
        }).saveApiKeys(notionKey, calendlyToken);
      }
    </script>
  `)
    .setWidth(300)
    .setHeight(200);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage API Keys');
}

// Function to save API keys to script properties
function saveApiKeys(notionKey, calendlyToken) {
  var scriptProperties = PropertiesService.getScriptProperties();
  
  if (notionKey) {
    scriptProperties.setProperty('NOTION_API_KEY', notionKey);
  }
  
  if (calendlyToken) {
    scriptProperties.setProperty('CALENDLY_PERSONAL_ACCESS_TOKEN', calendlyToken);
  }
  
  SpreadsheetApp.getUi().alert('API keys have been saved successfully.');
}

// Function to get the Notion API key
function getNotionApiKey() {
  return PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
}

// Function to get the Calendly Personal Access Token
function getCalendlyPersonalAccessToken() {
  return PropertiesService.getScriptProperties().getProperty('CALENDLY_PERSONAL_ACCESS_TOKEN');
}
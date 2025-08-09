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
    .addToUi();
}

/***********************
 * MANAGE API KEYS
 ***********************/

// Function to show the API key modal
function showApiKeyModal() {
  var notionKey = getNotionApiKey();
  var apolloKey = getApolloApiKey();

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
        <label for="apolloKey">Apollo API Key:</label>
        <span id="apolloStatus">${apolloKey ? '✅' : '❌'}</span>
        <button class="edit-button" onclick="editKey('apolloKey')">Edit</button><br>
        <input type="password" id="apolloKey" name="apolloKey" style="display:none;">
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
        var apolloKey = document.getElementById('apolloKey').value;
        google.script.run.withSuccessHandler(function() {
          google.script.host.close();
        }).saveApiKeys(notionKey, apolloKey);
      }
    </script>
  `)
    .setWidth(300)
    .setHeight(200);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage API Keys');
}

// Function to save API keys to script properties
function saveApiKeys(notionKey, apolloKey) {
  var scriptProperties = PropertiesService.getScriptProperties();
  
  if (notionKey) {
    scriptProperties.setProperty('NOTION_API_KEY', notionKey);
  }
  
  if (apolloKey) {
    scriptProperties.setProperty('APOLLO_API_KEY', apolloKey);
  }
  
  SpreadsheetApp.getUi().alert('API keys have been saved successfully.');
}

// Function to get the Notion API key
function getNotionApiKey() {
  return PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
}

// Function to get the Apollo API key
function getApolloApiKey() {
  return PropertiesService.getScriptProperties().getProperty('APOLLO_API_KEY');
}
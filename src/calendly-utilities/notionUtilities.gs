/***********************
 * WEBHOOK UTILITIES
 ***********************/

/**
 * Extracts specified properties from a Notion API JSON response.
 * 
 * @param {Object|string} jsonData - The Notion API response data. Can be a JSON string or an already parsed object.
 * @param {string[]} propertyNames - An array of property names to extract from the Notion data.
 * @returns {Object} An object containing the extracted properties as key-value pairs.
 * 
 * @description
 * This function parses a Notion API response and extracts specified properties.
 * It handles various Notion property types including:
 * - title
 * - rich_text
 * - url
 * - number
 * - select
 * - multi_select
 * - date
 * - checkbox
 * - status
 * - formula
 * - rollup
 * - unique_id
 * 
 * For unsupported property types, it returns the string "Unsupported property type".
 * If a requested property is not found in the Notion data, it sets the value to null.
 * 
 * @example
 * const notionData = { ... }; // Notion API response
 * const propertiesToExtract = ['Client Name', 'Project Status', 'Due Date', 'Unique ID'];
 * const extractedProperties = extractNotionProperties(notionData, propertiesToExtract);
 */
function extractNotionProperties(jsonData, propertyNames) {
  console.log("Extracting properties from Notion JSON:", propertyNames);

  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  const result = {};

  if (data && data.data && data.data.properties) {
    const properties = data.data.properties;
    console.log(`${Object.keys(properties).length} properties found in JSON.`);

    propertyNames.forEach(propName => {
      console.log(`Processing property: ${propName}`);
      if (properties[propName]) {
        const prop = properties[propName];

        switch (prop.type) {
          case 'title':
          case 'rich_text':
            result[propName] = prop[prop.type]
              .map(item => item.plain_text)
              .join('');
            break;
          case 'number':
            result[propName] = prop.number;
            break;
          case 'select':
            result[propName] = prop.select ? prop.select.name : null;
            break;
          case 'multi_select':
            result[propName] = prop.multi_select
              .map(item => item.name)
              .join(', ');
            break;
          case 'date':
            result[propName] = prop.date ? prop.date.start : null;
            break;
          case 'checkbox':
            result[propName] = prop.checkbox;
            break;
          case 'status':
            result[propName] = prop.status ? prop.status.name : null;
            break;
          case 'unique_id':
            result[propName] = prop.unique_id.number;
            break;
          case 'formula':
            console.log(`Formula type: ${prop.formula.type}`);
            switch (prop.formula.type) {
              case 'string':
                result[propName] = prop.formula.string;
                break;
              case 'number':
                result[propName] = prop.formula.number;
                break;
              case 'boolean':
                result[propName] = prop.formula.boolean;
                break;
              case 'date':
                result[propName] = prop.formula.date ? prop.formula.date.start : null;
                break;
              default:
                console.warn(`Unsupported formula type: ${prop.formula.type}`);
                result[propName] = 'Unsupported formula type';
            }
            break;
          case 'rollup':
            console.log(`Rollup type: ${prop.rollup.type}`);
            if (prop.rollup.type === 'array') {
              result[propName] = prop.rollup.array.map(item => {
                console.log(`Rollup item type: ${item.type}`);
                switch (item.type) {
                  case 'title':
                  case 'rich_text':
                    return item[item.type]
                      .map(textItem => textItem.plain_text)
                      .join('');
                  case 'number':
                    return item.number;
                  case 'date':
                    return item.date ? item.date.start : null;
                  case 'checkbox':
                    return item.checkbox;
                  default:
                    console.warn(`Unsupported rollup item type: ${item.type}`);
                    return 'Unsupported rollup item type';
                }
              }).join(', ');
            } else {
              console.warn(`Unsupported rollup type: ${prop.rollup.type}`);
              result[propName] = 'Unsupported rollup type';
            }
            break;
          case 'url':
            result[propName] = prop.url;
            break;
          default:
            console.warn(`Unsupported property type: ${prop.type}`);
            result[propName] = 'Unsupported property type';
        }
      } else {
        console.warn(`Property not found: ${propName}`);
        result[propName] = null;
      }
    });
  } else {
    console.error("Invalid data structure: missing data.properties");
  }

  console.log(`Extracted ${Object.keys(result).length} properties:`, result);
  return result;
}

/**
 * Sends a message to a specified Notion page, replacing the existing message in the 'Messages' property.
 * 
 * This function requires a Notion API key to be set in the Script Properties with the key 'NOTION_API_KEY'.
 * It fetches the specified Notion page, creates a new message with the provided content, and updates
 * the page, replacing any existing message in the 'Messages' property.
 *
 * @param {string} notionId - The ID of the Notion page to update.
 * @param {string} message - The message content to be sent to the Notion page.
 * @param {string} [type='message'] - The type of message, either 'message', 'warning', or 'success'.
 * @param {boolean} [silent=false] - If true, the function will immediately return without executing.
 * @returns {boolean} Returns true if the message was successfully sent and the page was updated, false otherwise.
 */
function sendNotionMessage(notionId, message, type = 'message', silent = false) {
  if (silent) {
    console.log('sendNotionMessage: Silent mode enabled. Skipping message send.');
    return true;
  }

  const notionApiKey = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
  
  if (!notionApiKey) {
    console.warn('Notion API key not found. Please set the NOTION_API_KEY in Script Properties.');
    return false;
  }

  const headers = {
    'Authorization': `Bearer ${notionApiKey}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  try {
    // Get current page data
    const pageUrl = `https://api.notion.com/v1/pages/${notionId}`;
    const pageResponse = UrlFetchApp.fetch(pageUrl, {
      headers: headers,
      muteHttpExceptions: true
    });
    
    if (pageResponse.getResponseCode() !== 200) {
      console.warn(`Failed to fetch page: ${pageResponse.getContentText()}`);
      return false;
    }

    // Create new message with timestamp and appropriate emoji
    const timestamp = new Date().toLocaleString('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    
    let emoji;
    switch (type) {
      case 'warning':
        emoji = '⚠️';
        break;
      case 'success':
        emoji = '✅';
        break;
      default:
        emoji = '💬';
    }
    
    const newMessage = {
      type: "text",
      text: { content: `${emoji} ${message}` },
      annotations: {
        bold: false, italic: false, strikethrough: false, 
        underline: false, code: false, color: "default"
      }
    };

    // Update Notion page with new message, replacing the existing one
    const updateResponse = UrlFetchApp.fetch(pageUrl, {
      method: 'patch',
      headers: headers,
      payload: JSON.stringify({
        properties: {
          Messages: {
            rich_text: [newMessage]
          }
        }
      }),
      muteHttpExceptions: true
    });

    if (updateResponse.getResponseCode() !== 200) {
      console.warn(`Update failed: ${updateResponse.getContentText()}`);
      return false;
    }

    console.log('Notion Message Sent', `Updated page ${notionId} successfully`);
    return true;

  } catch (error) {
    console.warn('Notion Message Error', error.message);
    return false;
  }
}

/***********************
 * PAGE UTILITIES: GET PAGES
 ***********************/

/**
 * Retrieves the properties of a specific Notion page and formats them.
 * 
 * @param {string} pageId - The ID of the Notion page to retrieve properties from.
 * @param {boolean} getAllRelatedItems - Whether to retrieve all related items for relation properties (default: false).
 * @returns {Object} An object containing the page's properties in the format {"Property Name":"property value"}.
 * @throws {Error} If the API request fails or if there's an error processing the response.
 */
function getNotionPageProperties(pageId, getAllRelatedItems = false) {
  console.log(`Retrieving Notion page properties for pageId: ${pageId}`);
  console.log(`getAllRelatedItems is set to: ${getAllRelatedItems}`);

  const NOTION_API_KEY = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
  if (!NOTION_API_KEY) {
    console.error('Notion API key not found in script properties');
    throw new Error('Notion API key not found in script properties');
  }

  const url = `https://api.notion.com/v1/pages/${pageId}`;
  const options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28'
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      console.error(`API request failed. Status: ${responseCode}, Content: ${response.getContentText()}`);
      throw new Error(`API request failed with status ${responseCode}`);
    }

    const pageData = JSON.parse(response.getContentText());
    const properties = pageData.properties;
    const formattedProperties = {};

    for (const [key, value] of Object.entries(properties)) {
      switch (value.type) {
        case 'title':
        case 'rich_text':
          formattedProperties[key] = value[value.type].map(text => text.plain_text).join('');
          break;
        case 'number':
          formattedProperties[key] = value.number;
          break;
        case 'select':
          formattedProperties[key] = value.select ? value.select.name : null;
          break;
        case 'multi_select':
          formattedProperties[key] = value.multi_select.map(option => option.name);
          break;
        case 'date':
          formattedProperties[key] = value.date ? value.date.start : null;
          break;
        case 'checkbox':
          formattedProperties[key] = value.checkbox;
          break;
        case 'status':
          formattedProperties[key] = value.status ? value.status.name : null;
          break;
        case 'relation':
          formattedProperties[key] = getAllRelatedItems ?
            getRelatedItems(pageId, value.id, NOTION_API_KEY) :
            value.relation.map(relation => relation.id);
          break;
        case 'formula':
          formattedProperties[key] = value.formula.type === 'string' ? value.formula.string :
            value.formula.type === 'number' ? value.formula.number :
              value.formula.type === 'boolean' ? value.formula.boolean :
                value.formula.type === 'date' ? value.formula.date.start : null;
          break;
        case 'created_time':
        case 'last_edited_time':
          formattedProperties[key] = value[value.type];
          break;
        case 'people':
          formattedProperties[key] = value.people.map(person => person.name || person.id);
          break;
        case 'rollup':
          formattedProperties[key] = value.rollup.type === 'number' ? value.rollup.number :
            value.rollup.type === 'date' ? value.rollup.date.start :
              value.rollup.type === 'array' ? value.rollup.array.map(item => item.content) : null;
          break;
        case 'url':
          formattedProperties[key] = value.url;
          break;
        default:
          formattedProperties[key] = 'Unsupported type: ' + value.type;
      }
    }

    console.log(`Successfully retrieved ${Object.entries(formattedProperties).length} properties.`);
    //console.log(`formattedProperties: ${JSON.stringify(formattedProperties, null, 2)}`);
    return formattedProperties;
  } catch (error) {
    console.error(`Error in getNotionPageProperties: ${error.message}`);
    throw error;
  }
}

function getRelatedItems(pageId, propertyId, apiKey) {
  let allRelations = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    let requestUrl = `https://api.notion.com/v1/pages/${pageId}/properties/${propertyId}`;
    if (startCursor) {
      requestUrl += `?start_cursor=${startCursor}`;
    }

    const options = {
      method: 'get',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28'
      },
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(requestUrl, options);
      const responseCode = response.getResponseCode();
      if (responseCode !== 200) {
        console.error(`API request failed. Status: ${responseCode}, Content: ${response.getContentText()}`);
        throw new Error(`API request failed with status ${responseCode}`);
      }

      const data = JSON.parse(response.getContentText());
      //console.log(`data: ${JSON.stringify(data, null, 2)}`);
      if (data.results && Array.isArray(data.results)) {
        allRelations = allRelations.concat(data.results);
      }
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    } catch (error) {
      console.error(`Error fetching related items: ${error.message}`);
      hasMore = false;
    }
  }

  return allRelations
    .filter(item => item && item.relation && item.relation.id)
    .map(item => item.relation.id);
}

/***********************
 * PAGE UTILITIES: UPDATE PROPERTIES
 ***********************/

/**
 * Updates multiple properties of a Notion page, including the title.
 * Empty properties are removed and logged with a warning.
 * 
 * @param {string} notionId - The ID of the Notion page to update.
 * @param {Array<Object>} properties - An array of objects with property details.
 *                                     Each object should have the following structure:
 *                                     { name: string, value: string|number|boolean, type: string }
 *                                     Supported types and their corresponding value formats:
 *                                     - 'text': string (for rich text properties)
 *                                     - 'title': string (updates the page title)
 *                                     - 'url': string (valid URL)
 *                                     - 'checkbox': boolean or string ('true'/'false')
 *                                     - 'number': number or string (parseable to number)
 *                                     - 'status': string (must match an existing status option)
 *                                     - 'email': string (valid email address)
 *                                     - 'phone': string (valid phone number)
 * @returns {boolean} Returns true if the update was successful.
 * @throws {Error} Throws an error if:
 *                 - The Notion API key is not found in Script Properties
 *                 - A property type is unsupported
 *                 - An invalid value is provided for a property type
 *                 - The API request fails
 */
function updatePageProperties(notionId, properties) {
  const notionApiKey = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
  if (!notionApiKey) {
    throw new Error('Notion API key not found. Please set the NOTION_API_KEY in Script Properties.');
  }

  console.log(`Updating properties on Notion page "${notionId}"...`);
  const headers = {
    'Authorization': `Bearer ${notionApiKey}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  try {
    const pageUrl = `https://api.notion.com/v1/pages/${notionId}`;

    const propertyPayload = {};
    let titleUpdateNeeded = false;
    let newTitle = '';

    properties.forEach(prop => {
      const { name, value, type } = prop;

      // Check if the value is empty (undefined, null, empty string, or empty array)
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        console.warn(`Removing empty property: ${name}`);
        return; // Skip this property
      }

      if (type === 'title') {
        titleUpdateNeeded = true;
        newTitle = value;
      } else {
        propertyPayload[name] = {};

        // Handle different Notion property types
        switch (type) {
          case 'text':
            propertyPayload[name].rich_text = [{
              type: "text",
              text: { content: value }
            }];
            break;
          case 'url':
          case 'email':
            propertyPayload[name][type] = value;
            break;
          case 'phone':
            propertyPayload[name]['phone_number'] = value;
            break;
          case 'checkbox':
            propertyPayload[name][type] = (value.toString().toLowerCase() === 'true');
            break;
          case 'number':
            const numValue = typeof value === 'string' ? parseFloat(value) : value;
            if (isNaN(numValue)) {
              throw new Error(`Invalid number value provided for property: ${name}`);
            }
            propertyPayload[name][type] = numValue;
            break;
          case 'status':
            propertyPayload[name][type] = { name: value };
            break;
          default:
            throw new Error(`Unsupported property type: ${type} for property: ${name}`);
        }
      }
    });

    let updateSuccessful = true;

    // Update title if needed
    if (titleUpdateNeeded) {
      updateSuccessful = updateNotionPageTitle(notionId, newTitle);
      if (!updateSuccessful) {
        throw new Error('Failed to update page title');
      }
    }

    // Update other properties if any
    if (Object.keys(propertyPayload).length > 0) {
      const updatePayload = { properties: propertyPayload };

      // Update Notion page
      const updateResponse = UrlFetchApp.fetch(pageUrl, {
        method: 'patch',
        headers: headers,
        payload: JSON.stringify(updatePayload),
        muteHttpExceptions: true
      });

      if (updateResponse.getResponseCode() !== 200) {
        throw new Error(`Update failed: ${updateResponse.getContentText()}`);
      }
    }

    console.log('Notion update successful', `Updated properties on page ${notionId}`);
    return true;

  } catch (error) {
    console.error('Notion API Error', error.message);
    throw error;
  }
}

/***********************
 * DATABASE UTILITIES: GET PAGES
 ***********************/

/**
 * Finds Notion pages in a specified database that match given property criteria.
 *
 * @param {string} databaseId - The ID of the Notion database to query.
 * @param {Array<Object>} matchProperties - An array of objects specifying the properties to match.
 *        Each object should have the following structure:
 *        {
 *          name?: string,  // The name of the property (optional; if not provided, matches against title)
 *          match: string  // The value to match
 *        }
 * @returns {Array<string>} An array of strings with matching Notion page IDs (without dashes) or "" for unmatched properties.
 * @throws {Error} If the API request fails or returns an error.
 */
function findNotionPagesByProperties(databaseId, matchProperties = []) {
  console.log(`Finding Notion pages by properties (Database: ${databaseId})...`);
  console.log(`matchProperties: ${JSON.stringify(matchProperties)}`);

  const NOTION_API_KEY = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;

  const requests = matchProperties.map(prop => {
    const filter = buildDynamicFilter(prop);
    return {
      url: url,
      method: 'post',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ filter: filter }),
      muteHttpExceptions: true
    };
  });

  const responses = UrlFetchApp.fetchAll(requests);
  const result = matchProperties.map((prop, index) => {
    const response = responses[index];

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      console.log(`data: ${JSON.stringify(data, null, 2)}`);
      console.log(`Received ${data.results.length} results for property: ${prop.name || 'title'}`);

      for (let page of data.results) {
        if (prop.name) {
          const propertyValue = page.properties[prop.name];
          if (dynamicPropertyMatches(propertyValue, prop.match)) {
            const pageIdWithoutDashes = page.id.replace(/-/g, '');
            console.log(`Matched property: ${prop.name} with page ID: ${pageIdWithoutDashes}`);
            return pageIdWithoutDashes;
          }
        } else {
          // Match against title if name is not provided
          const titleProperty = getNotionPageTitle(page);
          if (titleMatches(titleProperty, prop.match)) {
            const pageIdWithoutDashes = page.id.replace(/-/g, '');
            console.log(`Matched title: ${prop.match} with page ID: ${pageIdWithoutDashes}`);
            return pageIdWithoutDashes;
          }
        }
      }
    } else {
      console.error(`Error for property ${prop.name || 'title'}: ${response.getContentText()}`);
    }

    console.log(`No match found for property: ${prop.name || 'title'}`);
    return "";
  });

  return result;
}

function buildDynamicFilter(prop) {
  if (prop.name) {
    return {
      property: prop.name,
      rich_text: { contains: prop.match } // Default to rich_text; Notion will handle type mismatches gracefully
    };
  } else {
    return {
      property: "title",
      title: { contains: prop.match }
    };
  }
}

function getNotionPageTitle(pageData) {
  for (let key in pageData.properties) {
    if (pageData.properties[key].type === "title") {
      return pageData.properties[key].title[0]?.plain_text || "";
    }
  }
  return "";
}

function titleMatches(pageTitle, matchValue) {
  return pageTitle.toLowerCase().includes(matchValue.toLowerCase());
}

function dynamicPropertyMatches(property, matchValue) {
  //console.log(`Checking dynamic property match: ${JSON.stringify(property)} against "${matchValue}"`);

  if (!property) {
    console.warn("Property is undefined or null.");
    return false;
  }

  switch (property.type) {
    case 'title':
      return Array.isArray(property.title) &&
        property.title.some(title => title.plain_text.includes(matchValue));
    case 'rich_text':
      return Array.isArray(property.rich_text) &&
        property.rich_text.some(text => text.plain_text.includes(matchValue));
    case 'number':
      return typeof property.number === 'number' &&
        property.number === Number(matchValue);
    case 'select':
      return property.select &&
        property.select.name === matchValue;
    case 'multi_select':
      return Array.isArray(property.multi_select) &&
        property.multi_select.some(select => select.name === matchValue);
    case 'status':
      return property.status &&
        property.status.name === matchValue;
    case 'relation':
      return Array.isArray(property.relation) &&
        property.relation.some(relation => relation.id === matchValue);
    case 'formula':
      if (property.formula.type === 'string') {
        return typeof property.formula.string === 'string' &&
          property.formula.string.includes(matchValue);
      }
      if (property.formula.type === 'number') {
        return typeof property.formula.number === 'number' &&
          property.formula.number === Number(matchValue);
      }
      return false;
    default:
      console.warn(`Unsupported or unknown property type: ${property.type}`);
      return false;
  }
}

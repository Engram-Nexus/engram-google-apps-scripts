/***********************
 * APPEND TO LOG DATA
 ***********************/

/**
 * Appends data to a log sheet, creating the sheet and headers if they don't exist.
 * 
 * @param {string} sheetName - The name of the sheet to append data to.
 * @param {string[]} headers - An array of header strings for the log sheet.
 * @param {Object[]} data - An array of objects containing the data to be logged.
 * @param {string} [append='bottom'] - Where to append the data: 'bottom' or 'top'.
 * @returns {void}
 */
function appendDataToLog(sheetName, headers, data, append = 'bottom') {
  console.log(`Starting appendDataToLog for sheet: ${sheetName}`);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  // Create sheet if it doesn't exist
  if (!sheet) {
    console.log(`Sheet "${sheetName}" not found. Creating new sheet.`);
    sheet = ss.insertSheet(sheetName);
  }

  // Add headers if they don't exist
  if (sheet.getLastRow() === 0) {
    console.log('Sheet is empty. Adding headers.');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // Validate and format data
  console.log(`Formatting ${data.length} data entries.`);
  const formattedData = data.map(obj => {
    return headers.map(header => {
      if (obj.hasOwnProperty(header)) {
        return obj[header];
      } else {
        console.warn(`Missing data for header: ${header}`);
        return '';
      }
    });
  });

  // Append data
  if (append === 'bottom') {
    console.log(`Appending ${formattedData.length} rows to the bottom of the sheet.`);
    sheet.getRange(sheet.getLastRow() + 1, 1, formattedData.length, headers.length).setValues(formattedData);
  } else if (append === 'top') {
    console.log(`Inserting ${formattedData.length} rows at the top of the sheet.`);
    sheet.insertRowsAfter(1, formattedData.length);
    sheet.getRange(2, 1, formattedData.length, headers.length).setValues(formattedData).setFontWeight('normal');
  } else {
    console.error(`Invalid append option: ${append}. Must be 'bottom' or 'top'.`);
    return;
  }

  console.log(`Data successfully appended to "${sheetName}" log sheet.`);
}

/***********************
 * CREATE OR UPDATE LOG DATA
 ***********************/

/**
 * Creates or updates data in a log sheet, creating the sheet and headers if they don't exist.
 * Protects formula cells and prevents them from being overwritten.
 * Converts boolean values to checkboxes in the sheet.
 * 
 * @param {string} sheetName - The name of the sheet to update data in.
 * @param {string[]} headers - An array of header strings for the log sheet. Only used if creating a new sheet.
 * @param {Object[]} data - An array of objects containing the data to be logged. Each object's keys should correspond to the headers.
 * @param {string[]} matchColumns - An array of header strings to use for matching existing rows. These headers are used to identify unique entries.
 * @param {string} [append='top'] - Where to append new data: 'bottom' or 'top'.
 * @returns {Object[]} An array of objects representing the updated or created data.
 * @throws {Error} If the data does not contain any of the matching columns.
 */
function createOrUpdateLogData(sheetName, headers=[], data=[], matchColumns=[], append = 'top') {
  console.log(`Starting createOrUpdateLogData for sheet: ${sheetName}`);
  
  // Check if data contains any of the matching columns
  const dataContainsMatchColumns = data.some(entry => 
    matchColumns.some(col => entry.hasOwnProperty(col))
  );
  
  if (!dataContainsMatchColumns) {
    throw new Error(`Data does not contain any of the matching columns: ${matchColumns.join(', ')}`);
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  // Create sheet if not found
  if (!sheet) {
    console.log(`Sheet "${sheetName}" not found. Creating new sheet with provided headers.`);
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    console.log(`Using existing headers from sheet: ${headers.join(', ')}`);
  }

  const existingData = sheet.getDataRange().getValues();
  const headerRow = existingData.shift();

  const updatedData = [];

  data.forEach(newEntry => {
    const matchIndices = matchColumns.map(col => headerRow.indexOf(col));
    const existingRowIndex = existingData.findIndex(row => 
      matchIndices.every(index => row[index] === newEntry[headerRow[index]])
    );

    let updatedEntry = {};

    if (existingRowIndex !== -1) {
      const actualRowNumber = existingRowIndex + 2;
      console.log(`Updating existing row ${actualRowNumber} for: ${JSON.stringify(matchColumns.map(col => newEntry[col]))}`);
      
      headers.forEach((header, index) => {
        if (newEntry.hasOwnProperty(header) && newEntry[header] !== null && newEntry[header] !== undefined) {
          const cell = sheet.getRange(actualRowNumber, index + 1);
          if (!cell.getFormula()) {
            setCellValue(cell, newEntry[header]);
            updatedEntry[header] = newEntry[header];
          } else {
            updatedEntry[header] = cell.getValue();
          }
        } else {
          updatedEntry[header] = existingData[existingRowIndex][index];
        }
      });
    } else {
      const newRowNumber = append === 'bottom' ? sheet.getLastRow() + 1 : 2;
      
      if (append === 'top') {
        sheet.insertRowBefore(2);
      }
      
      headers.forEach((header, index) => {
        const cell = sheet.getRange(newRowNumber, index + 1);
        const value = newEntry[header] || '';
        setCellValue(cell, value);
        updatedEntry[header] = value;
      });
      
      forceRowHeightToDefault(sheetName, newRowNumber);
      console.log(`Adding new row ${newRowNumber} for: ${JSON.stringify(matchColumns.map(col => newEntry[col]))}`);
    }

    updatedData.push(updatedEntry);
  });

  console.log(`Data successfully updated in "${sheetName}" log sheet.`);
  return updatedData;
}

function setCellValue(cell, value) {
  if (typeof value === 'boolean') {
    cell.insertCheckboxes();
    cell.setValue(value);
    
    // Center align checkbox
    cell.setHorizontalAlignment("center");
  } else {
    cell.setValue(value);
  }
}

/***********************
 * ROWS UTILITIES - ROW ATTRIBUTES
 ***********************/

/**
 * Forces a specific row in a sheet to have the default height using the Google Sheets API.
 * 
 * Requires the Google Sheets API advanced service to be enabled:
 * 1. In the Apps Script editor, click "Services" (+ icon) in the left toolbar
 * 2. Search for "Sheets API" and add it
 * 3. Ensure it's also enabled in the Google Cloud Console (linked from the service modal)
 * 
 * @param {string} sheetName - The name of the sheet where the row is located
 * @param {number} rowNum - The number of the row to adjust (1-indexed)
 * @throws {Error} If Sheets API service is not enabled or sheet not found
 */
function forceRowHeightToDefault(sheetName, rowNum) {
  try {
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    const sheetId = sheet.getSheetId();
    const startIndex = rowNum - 1; // Convert to 0-indexed for API
    const endIndex = startIndex + 1;

    const resource = {
      "requests": [{
        "updateDimensionProperties": {
          "range": {
            "sheetId": sheetId,
            "dimension": "ROWS",
            "startIndex": startIndex,
            "endIndex": endIndex
          },
          "properties": {
            "pixelSize": 21 // 21 pixels = default row height
          },
          "fields": "pixelSize"
        }
      }]
    };

    // Attempt API call
    Sheets.Spreadsheets.batchUpdate(resource, spreadsheetId);
    
  } catch (error) {
    // Handle missing Sheets API service
    if (error.message.includes("Sheets is not defined")) {
      throw new Error(
        'Sheets API service not enabled. Enable it by:\n' +
        '1. Opening Apps Script editor\n' +
        '2. Clicking "Services" (+ icon) in left toolbar\n' + 
        '3. Adding "Sheets API" service\n' +
        '4. Enabling in Google Cloud Console (link in service modal)'
      );
    }
    throw error; // Re-throw other errors
  }
}

/***********************
 * ROWS UTILITIES - FIND ROWS
 ***********************/

/**
 * Finds rows in a specified sheet where a given column value matches one or more provided values.
 *
 * @param {string} [sheetName="Webhook Logs"] - The name of the sheet to search in.
 * @param {string} [headerName="Subject"] - The name of the column header to search under.
 * @param {*|Array} [rowValues="Webhook Received"] - The value(s) to search for in the specified column.
 * @param {string} [returnType="rows"] - The type of data to return: 'rows' or 'data'.
 * @returns {number[]|Object[]} An array of row numbers (1-based index) where matches were found,
 *                              or an array of objects with header-value pairs if returnType is 'data'.
 * @throws {Error} If the specified header is not found in the sheet or if an invalid returnType is provided.
 *
 * @example
 * // Find rows where the "Subject" column contains "Webhook Received"
 * const matchingRows = findRowsByHeaderAndValue();
 * 
 * @example
 * // Find rows where the "Status" column contains either "Completed" or "In Progress" and return data
 * const completedRowsData = findRowsByHeaderAndValue("Tasks", "Status", ["Completed", "In Progress"], "data");
 */
function findRowsByHeaderAndValue(sheetName, headerName, rowValues, returnType = "rows") {
  console.log(`Finding rows in "${sheetName}": headerName: ${headerName} | returnType: ${returnType}...`);

  if (returnType !== "rows" && returnType !== "data") {
    throw new Error("Invalid returnType. Must be 'rows' or 'data'.");
  }

  // Ensure rowValues is always an array
  if (!Array.isArray(rowValues)) {
    rowValues = [rowValues];
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const formulas = dataRange.getFormulas();
  const headers = values[0];
  const columnIndex = headers.indexOf(headerName);

  if (columnIndex === -1) {
    console.error(`Header "${headerName}" not found in sheet "${sheetName}"`);
    throw new Error(`Header "${headerName}" not found in sheet "${sheetName}"`);
  }

  const matchingRows = [];
  const matchingData = [];

  for (let i = 1; i < values.length; i++) {
    const cellValue = values[i][columnIndex];
    const isMatch = rowValues.some(value => {
      if (value === false && (cellValue === false || cellValue === "")) {
        return true;
      }
      return cellValue === value;
    });

    if (isMatch) {
      if (returnType === "rows") {
        matchingRows.push(i + 1); // Adding 1 to convert from 0-based to 1-based index
      } else {
        const rowData = {};
        headers.forEach((header, index) => {
          let value = values[i][index];
          let formula = formulas[i][index];

          // If there's a formula, use it instead of the value
          if (formula !== "") {
            rowData[header] = { value: value, formula: formula };
          } else {
            // Try to parse JSON for the "Message" field
            if (header === "Message") {
              try {
                value = JSON.parse(value);
              } catch (e) {
                // If parsing fails, keep the original value
                console.log(`Failed to parse JSON in Message field: ${e}`);
              }
            }
            rowData[header] = value;
          }
        });
        matchingData.push(rowData);
      }
    }
  }

  if (returnType === "rows") {
    console.log(`${matchingRows.length} matching rows found.`);
    return matchingRows;
  } else {
    console.log(`${matchingData.length} matching rows found.`);
    return matchingData;
  }
}

/**
 * Finds rows in a specified sheet where given column values match provided values based on a condition.
 *
 * @param {string} [sheetName="Webhook Logs"] - The name of the sheet to search in.
 * @param {Object[]} matchValues - An array of objects specifying the headers and values to match.
 * @param {string} matchValues[].headerName - The name of the column header to search under.
 * @param {*[]} matchValues[].rowValues - The value(s) to search for in the specified column.
 * @param {string} [condition="all"] - The condition for matching: 'all' or 'any'.
 * @param {string} [returnType="rows"] - The type of data to return: 'rows' or 'data'.
 * @returns {number[]|Object[]} An array of row numbers (1-based index) where matches were found,
 *                              or an array of objects with header-value pairs if returnType is 'data'.
 * @throws {Error} If a specified header is not found in the sheet or if an invalid returnType or condition is provided.
 *
 * @example
 * // Find rows where the "Subject" column contains "Webhook Received" and "Status" is "Completed"
 * const matchingRows = findRowsByMultipleHeadersAndValues("Webhook Logs", [
 *   {headerName: "Subject", rowValues: ["Webhook Received"]},
 *   {headerName: "Status", rowValues: ["Completed"]}
 * ], "all", "rows");
 * 
 * @example
 * // Find rows where either "Status" is "Completed" or "Priority" is "High" and return data
 * const matchingData = findRowsByMultipleHeadersAndValues("Tasks", [
 *   {headerName: "Status", rowValues: ["Completed"]},
 *   {headerName: "Priority", rowValues: ["High"]}
 * ], "any", "data");
 */
function findRowsByMultipleHeadersAndValues(sheetName, matchValues=[], condition = "all", returnType = "rows") {
  console.log(`Finding rows in "${sheetName}": condition: ${condition} | returnType: ${returnType}...`);

  if (returnType !== "rows" && returnType !== "data") {
    throw new Error("Invalid returnType. Must be 'rows' or 'data'.");
  }

  if (condition !== "all" && condition !== "any") {
    throw new Error("Invalid condition. Must be 'all' or 'any'.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const formulas = dataRange.getFormulas();
  const headers = values[0];

  // Validate headers and get column indices
  const columnIndices = matchValues.map(mv => {
    const index = headers.indexOf(mv.headerName);
    if (index === -1) {
      throw new Error(`Header "${mv.headerName}" not found in sheet "${sheetName}"`);
    }
    return index;
  });

  const matchingRows = [];
  const matchingData = [];

  for (let i = 1; i < values.length; i++) {
    const rowMatches = matchValues.map((mv, index) => {
      const cellValue = values[i][columnIndices[index]];
      return mv.rowValues.some(matchValue => {
        if (matchValue === false && (cellValue === false || cellValue === "")) {
          return true;
        }
        return cellValue === matchValue;
      });
    });

    const isMatch = condition === "all" ? rowMatches.every(Boolean) : rowMatches.some(Boolean);

    if (isMatch) {
      if (returnType === "rows") {
        matchingRows.push(i + 1); // Adding 1 to convert from 0-based to 1-based index
      } else {
        const rowData = {};
        headers.forEach((header, index) => {
          let value = values[i][index];
          let formula = formulas[i][index];

          if (formula !== "") {
            rowData[header] = { value: value, formula: formula };
          } else {
            if (header === "Message") {
              try {
                value = JSON.parse(value);
              } catch (e) {
                console.log(`Failed to parse JSON in Message field: ${e}`);
              }
            }
            rowData[header] = value;
          }
        });
        matchingData.push(rowData);
      }
    }
  }

  if (returnType === "rows") {
    console.log(`${matchingRows.length} matching rows found.`);
    return matchingRows;
  } else {
    console.log(`${matchingData.length} matching rows found.`);
    return matchingData;
  }
}

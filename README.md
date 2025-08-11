# 📜 Engram Google Apps Scripts

A comprehensive collection of Google Apps Script utilities for automating Google Workspace and integrating with third-party services.

## 🚀 Features

### Google Calendar Utilities
- **Service Account Authentication**: Secure authentication for Google Calendar API
- **Event Management**: Create, update, delete, and search calendar events
- **Batch Operations**: Process multiple calendar operations efficiently
- **Time Zone Support**: Proper handling of different time zones

### Apollo.io Integration
- **Contact Enrichment**: Enhance your contact database with Apollo data
- **Lead Generation**: Find and qualify potential leads
- **Company Research**: Access detailed company information
- **Email Discovery**: Find verified email addresses

### Calendly Integration
- **Webhook Processing**: Handle Calendly events in real-time
- **Automatic Sync**: Keep Google Calendar synchronized with Calendly bookings
- **Form Data Extraction**: Parse and process Calendly form submissions
- **Custom Field Mapping**: Map Calendly fields to your data structure

### Additional Integrations
- **Google Sheets**: Import/export data and automated reporting
- **Notion API**: Sync with Notion databases and pages

## 📁 Project Structure

```
src/
├── apollo-utilities/         # Apollo.io API integration
├── calendly-utilities/       # Calendly webhook and form processing
└── google-calendar-utilities/  # Google Calendar operations
    ├── _triggers.gs         # Automated triggers
    ├── authUtilities.gs     # Authentication management
    └── eventsUtilities.gs   # Event operations
```

## 🔧 Setup

### Prerequisites
1. Google Workspace account
2. Google Apps Script project
3. Service account credentials (for Calendar API)
4. API keys for third-party services

### Installation
1. Clone this repository
2. Open Google Apps Script editor
3. Copy the relevant `.gs` files to your project
4. Configure authentication credentials
5. Set up necessary triggers

### Configuration
Create a script properties file with:
```javascript
{
  "CALENDAR_API_KEY": "your-api-key",
  "APOLLO_API_KEY": "your-apollo-key",
  "CALENDLY_WEBHOOK_SECRET": "your-webhook-secret",
  "NOTION_API_KEY": "your-notion-key"
}
```

## 📖 Usage Examples

### Google Calendar Event Creation
```javascript
const event = {
  summary: 'Team Meeting',
  location: 'Conference Room A',
  description: 'Quarterly review meeting',
  start: {
    dateTime: '2025-01-15T10:00:00-07:00',
    timeZone: 'America/Los_Angeles',
  },
  end: {
    dateTime: '2025-01-15T11:00:00-07:00',
    timeZone: 'America/Los_Angeles',
  }
};

createCalendarEvent(event);
```

### Apollo Contact Search
```javascript
const contact = searchApolloContact({
  email: 'john.doe@example.com',
  enrich: true
});
```

### Calendly Webhook Handler
```javascript
function doPost(e) {
  const webhookData = JSON.parse(e.postData.contents);
  processCalendlyWebhook(webhookData);
}
```

## 🛡️ Security

- All API keys stored in Google Apps Script Properties
- Service account authentication for sensitive operations
- Webhook signature verification for Calendly
- Rate limiting implemented for API calls

## 📊 API Integrations

| Service | Purpose | Authentication |
|---------|---------|---------------|
| Google Calendar API | Event management | Service Account |
| Apollo.io API | Contact enrichment | API Key |
| Calendly API | Booking sync | Webhook + Secret |
| Notion API | Database sync | API Key |
| Google Sheets API | Data operations | OAuth2 |

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is proprietary and confidential. All rights reserved.

## 📧 Support

For questions or support, please contact the Engram Nexus development team.

## 🏷️ Version

Current version: 0.0.1

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

Built with ❤️ by Engram Nexus
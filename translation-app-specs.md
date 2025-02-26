# Translation App Specifications

## Overview
A web application that translates long fictional stories from English to various target languages using OpenAI API. Processing is coordinated by the client to ensure reliability in production environments.

## Architecture
- **Frontend**: HTML, CSS, JavaScript (no framework)
- **Backend**: Flask API on Render.com
- **API Integration**: OpenAI API for translations
- **Pattern**: Client-side coordination for reliability

## Core Features

### Text Input/Output
- Text area for pasting long English text
- File upload option (.txt files)
- Display of translated text with copy functionality
- Maximum text size: 50,000 words

### Translation Process
- Client-side text chunking (~800 words per chunk)
- Sequential processing of chunks via API calls
- Progress tracking with visual indicator
- Context sharing between chunks
- Final assembly of translated text in client

### Translation Quality
- Check word count variation between input and output (±20% threshold)
- Basic formatting preservation

### User Experience
- Simple, clean interface
- Password protection (basic auth)
- Dark mode UI
- Side-by-side display (original vs. translated)
- Progress visualization during translation

## Technical Details

### Backend API Endpoints

1. **Authentication**
   - `POST /login`: Basic authentication
   - `GET /check-auth`: Verify authentication status

2. **Translation**
   - `POST /translate-chunk`: Translate a single text chunk
     - Inputs: text chunk, target language, previous context
     - Outputs: translated chunk

3. **Utility**
   - `GET /languages`: Get available target languages

### Frontend Components

1. **Authentication**
   - Login form
   - Session management

2. **Text Input**
   - Text area
   - File upload handler
   - Target language selector
   - Translation button

3. **Text Processing**
   - Text chunking algorithm (client-side)
   - Context extraction function
   - Translation coordinator
   - Progress tracker

4. **Output Display**
   - Result display area
   - Copy button
   - Quality check indicator

### Data Flows

1. **Authentication Flow**
   - User enters credentials
   - Backend validates credentials
   - Session cookie established

2. **Translation Flow**
   - User inputs text and selects language
   - JavaScript splits text into chunks
   - For each chunk:
     - Send to backend API
     - Receive translated chunk
     - Extract context for next chunk
     - Update progress display
   - Assemble full translation
   - Display result and quality metrics

## Implementation Guidelines

### Security Considerations
- Store API key securely as environment variable on Render
- Implement basic authentication
- Validate all inputs

### Error Handling
- Retry mechanism for failed chunk translations (3 attempts)
- Clear error messages for users
- Graceful degradation

### Performance Optimizations
- Efficient text chunking algorithm
- Progress tracking for user feedback
- Optional: background request throttling

### Quality Checks
- Compare original and translated word counts
- Check for incomplete translations
- Ensure proper assembly of chunks

## Deployment Plan

1. **Local Development**
   - Set up Flask app with single API endpoint
   - Implement basic frontend with chunking logic
   - Test with small text samples

2. **GitHub Repository**
   - Create repository with proper structure
   - Include requirements.txt and Procfile

3. **Render Deployment**
   - Connect GitHub repository
   - Set environment variables (API key, credentials)
   - Deploy web service

## File Structure

```
translation-app/
├── app.py               # Flask application
├── requirements.txt     # Dependencies
├── static/
│   ├── css/
│   │   └── styles.css   # Main stylesheet
│   └── js/
│       ├── auth.js      # Authentication handling
│       ├── chunker.js   # Text chunking logic
│       ├── translator.js # Coordination logic
│       └── ui.js        # UI interactions
├── templates/
│   └── index.html       # Single page application
└── .env.example         # Example environment variables
```

## Dependencies

- Flask
- OpenAI Python library
- Flask-CORS (for development)
- Python-dotenv (for local development)
- Gunicorn (for production)

## Future Enhancements (v2)

- Translation history
- Additional file formats (PDF, DOCX)
- More advanced quality metrics
- Custom glossary support

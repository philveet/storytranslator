import os
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
import json
from functools import wraps

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for development
# Add warning log when falling back to default secret key
secret_key = os.getenv("SECRET_KEY")
if not secret_key:
    if os.getenv('FLASK_ENV') != 'development':
        print("WARNING: Using default secret key in production environment. This is a security risk!")
    secret_key = "dev-secret-key"
app.secret_key = secret_key

# Configure OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Authentication
USERNAME = os.getenv("AUTH_USERNAME")
PASSWORD = os.getenv("AUTH_PASSWORD")

# Available target languages
AVAILABLE_LANGUAGES = {
    "spanish": "Spanish",
    "french": "French",
    "german": "German",
    "italian": "Italian",
    "portuguese": "Portuguese",
    "czech": "Czech"
}

# Authentication decorator
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'authenticated' not in session or not session['authenticated']:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    
    # Add fallback check for missing environment variables
    configured_username = USERNAME
    configured_password = PASSWORD
    
    # If auth credentials are not configured, check for development environment
    if not configured_username or not configured_password:
        if os.getenv('FLASK_ENV') == 'development':
            # In development, allow a default login if env vars aren't set
            if data and data.get('username') == 'admin' and data.get('password') == 'admin':
                session['authenticated'] = True
                return jsonify({"success": True})
        return jsonify({"error": "Authentication not properly configured"}), 401
    
    if data and data.get('username') == configured_username and data.get('password') == configured_password:
        session['authenticated'] = True
        return jsonify({"success": True})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.pop('authenticated', None)
    return jsonify({"success": True})

@app.route('/check-auth', methods=['GET'])
def check_auth():
    if 'authenticated' in session and session['authenticated']:
        return jsonify({"authenticated": True})
    return jsonify({"authenticated": False})

@app.route('/languages', methods=['GET'])
def get_languages():
    return jsonify(AVAILABLE_LANGUAGES)

@app.route('/translate-chunk', methods=['POST'])
@require_auth
def translate_chunk():
    print("Received translation request:", request.json)
    data = request.json
    
    if not data or 'text' not in data or 'target_language' not in data:
        return jsonify({"error": "Missing required parameters"}), 400
    
    text = data['text']
    target_language = data['target_language']
    context = data.get('context', '')
    
    if target_language not in AVAILABLE_LANGUAGES:
        return jsonify({"error": "Unsupported target language"}), 400
    
    try:
        # Prepare the prompt with context if available
        prompt = text
        if context:
            prompt = f"Previous translation context: {context}\n\nPlease translate the following text into {AVAILABLE_LANGUAGES[target_language]}.\nEnsure accuracy and fidelity to the original, but do not copy sentence structure directly if a different phrasing is more natural.\nInstead of translating word-for-word, rewrite each sentence naturally so that a native speaker of {AVAILABLE_LANGUAGES[target_language]} would say it this way.\nUse idiomatic expressions, adjust sentence flow, and restructure phrases where necessary to make the text feel completely fluent and natural.\nPreserve paragraph structure, line breaks, and formatting exactly as in the source text.\nHere is the text:\n{text}"
        else:
            prompt = f"Please translate the following text into {AVAILABLE_LANGUAGES[target_language]}.\nEnsure accuracy and fidelity to the original, but do not copy sentence structure directly if a different phrasing is more natural.\nInstead of translating word-for-word, rewrite each sentence naturally so that a native speaker of {AVAILABLE_LANGUAGES[target_language]} would say it this way.\nUse idiomatic expressions, adjust sentence flow, and restructure phrases where necessary to make the text feel completely fluent and natural.\nPreserve paragraph structure, line breaks, and formatting exactly as in the source text.\nHere is the text:\n{text}"
            
        # Call OpenAI API for translation
        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": f"You are a professional literary translator with expertise in both the source language and {AVAILABLE_LANGUAGES[target_language]}.\nYour goal is to create a fluent, natural, and idiomatic translation that reads as if it were originally written in {AVAILABLE_LANGUAGES[target_language]}.\nEnsure accuracy and fidelity to the original, but do not copy sentence structure from the source text if a different structure sounds more natural.\nInstead of translating word-for-word, rewrite each sentence in the way a native speaker of {AVAILABLE_LANGUAGES[target_language]} would naturally express it.\nAdapt idioms, expressions, and sentence structures where necessary to make the translation sound natural and fluent in {AVAILABLE_LANGUAGES[target_language]}.\n\nRephrase sentences freely when necessary to sound natural in {AVAILABLE_LANGUAGES[target_language]}. If a sentence structure is too English-like, rewrite it in the way a native speaker would phrase it. Focus on idiomatic language in dialogues and avoid direct word-for-word translations. Read every sentence as if you were a native {AVAILABLE_LANGUAGES[target_language]} author and adjust phrasing accordingly.\n\nPreserve all paragraph breaks, line breaks, and formatting exactly as in the original. Do not add, remove, or merge paragraphs.\nYour task is to translate meaningfully and fluently, not mechanically."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            timeout=280  # 280 second timeout
        )
        
        translated_text = response.choices[0].message.content
        print("Translation successful")
        
        # Return the translated chunk
        return jsonify({
            "translated_text": translated_text,
            "original_length": len(text.split()),
            "translated_length": len(translated_text.split())
        })
        
    except Exception as e:
        print(f"Translation error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=os.getenv('FLASK_ENV') == 'development') 
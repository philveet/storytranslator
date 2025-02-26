import os
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from dotenv import load_dotenv
import openai
import json
from functools import wraps

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for development
app.secret_key = os.getenv("SECRET_KEY") or "dev-secret-key"

# Configure OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

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
    if data and data.get('username') == USERNAME and data.get('password') == PASSWORD:
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
            prompt = f"Previous translation context: {context}\n\nTranslate the following text to {AVAILABLE_LANGUAGES[target_language]}:\n{text}"
        else:
            prompt = f"Translate the following text to {AVAILABLE_LANGUAGES[target_language]}:\n{text}"
            
        # Call OpenAI API for translation
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": f"You are a professional translator. Translate the provided text to {AVAILABLE_LANGUAGES[target_language]} while preserving the original formatting, tone, and meaning."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        
        translated_text = response.choices[0].message.content
        
        # Return the translated chunk
        return jsonify({
            "translated_text": translated_text,
            "original_length": len(text.split()),
            "translated_length": len(translated_text.split())
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=os.getenv('FLASK_ENV') == 'development') 
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import base64
import io
from PIL import Image
import os
import logging
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv
import google.generativeai as genai
from werkzeug.middleware.proxy_fix import ProxyFix
from functools import wraps
import time
import json
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

# Configuration class
class Config:
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    TESTING = os.getenv('FLASK_TESTING', 'False').lower() == 'true'
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'your-secret-key-here')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '*').split(',')
    RATE_LIMIT = os.getenv('RATE_LIMIT', '100 per day')
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    
    # Google AI Configuration
    GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
    GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash')
    
    # Image Processing Configuration
    MAX_IMAGE_SIZE = (1920, 1080)  # Maximum image dimensions
    ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png', 'image/gif'}

# Setup logging
def setup_logging(app):
    if not os.path.exists('logs'):
        os.makedirs('logs')
    
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # File handler for general logs
    file_handler = RotatingFileHandler(
        'logs/app.log', 
        maxBytes=10485760,  # 10MB
        backupCount=10
    )
    file_handler.setFormatter(formatter)
    
    # Error log handler
    error_handler = RotatingFileHandler(
        'logs/error.log',
        maxBytes=10485760,
        backupCount=10
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    
    app.logger.addHandler(file_handler)
    app.logger.addHandler(error_handler)
    app.logger.setLevel(getattr(logging, Config.LOG_LEVEL))

# Custom error classes
class ImageProcessingError(Exception):
    pass

class AIProcessingError(Exception):
    pass

# Initialize Flask app with configuration
def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Setup CORS with proper configuration
    CORS(app, resources={
        r"/api/*": {"origins": app.config['ALLOWED_ORIGINS']}
    })
    
    # Setup rate limiting
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=[app.config['RATE_LIMIT']]
    )
    
    # Setup proxy handling for proper IP addresses behind reverse proxy
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
    
    # Setup logging
    setup_logging(app)
    
    # Configure Google AI
    if not app.config['GOOGLE_API_KEY']:
        app.logger.error("Google API key not found!")
        raise ValueError("Google API key is required")
    
    genai.configure(api_key=app.config['GOOGLE_API_KEY'])
    model = genai.GenerativeModel(app.config['GEMINI_MODEL'])
    
    return app, model, limiter

app, model, limiter = create_app()

# Utility function for request timing and logging
def log_request():
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            start_time = time.time()
            response = f(*args, **kwargs)
            duration = time.time() - start_time
            
            log_data = {
                'timestamp': datetime.utcnow().isoformat(),
                'method': request.method,
                'path': request.path,
                'ip': request.remote_addr,
                'duration': f"{duration:.2f}s",
                'status_code': response.status_code
            }
            
            app.logger.info(json.dumps(log_data))
            return response
        return decorated_function
    return decorator

def process_base64_image(base64_string):
    """Process and validate base64 image data."""
    try:
        # Remove data URL prefix if present
        if 'base64,' in base64_string:
            base64_string = base64_string.split('base64,')[1]
        
        # Decode base64 string
        image_data = base64.b64decode(base64_string)
        image = Image.open(io.BytesIO(image_data))
        
        # Validate image format
        if image.format.lower() not in ['jpeg', 'png', 'gif']:
            raise ImageProcessingError("Unsupported image format")
        
        # Resize image if needed
        if image.size[0] > Config.MAX_IMAGE_SIZE[0] or image.size[1] > Config.MAX_IMAGE_SIZE[1]:
            image.thumbnail(Config.MAX_IMAGE_SIZE, Image.Resampling.LANCZOS)
        
        return image
    except Exception as e:
        app.logger.error(f"Image processing error: {str(e)}")
        raise ImageProcessingError(f"Failed to process image: {str(e)}")

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api/process-image', methods=['POST'])
@limiter.limit(Config.RATE_LIMIT)
@log_request()
def process_image():
    """Process image and generate AI response."""
    try:
        # Validate request
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 415
        
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Process image
        image = process_base64_image(data['image'])
        
        # Prepare prompt with safety guidelines
        prompt = """
        Analyze the attached image and provide:
        1. A detailed explanation of the image contents
        2. If present, description of any mathematical or scientific problems
        3. Suggested solutions or insights based on the content
        
        Please ensure responses are:
        - Accurate and relevant to the image
        - Educational and helpful
        - Safe and appropriate for all audiences
        """
        
        # Generate AI response with timeout handling
        try:
            response = model.generate_content(
                [prompt, image],
                generation_config={
                    'temperature': 0.7,
                    'max_output_tokens': 1024,
                }
            )
            
            if not response.text:
                raise AIProcessingError("No response generated")
            
            return jsonify({
                'success': True,
                'solution': response.text,
                'timestamp': datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            raise AIProcessingError(f"AI processing failed: {str(e)}")
            
    except ImageProcessingError as e:
        app.logger.error(f"Image processing error: {str(e)}")
        return jsonify({'error': str(e)}), 400
        
    except AIProcessingError as e:
        app.logger.error(f"AI processing error: {str(e)}")
        return jsonify({'error': str(e)}), 500
        
    except Exception as e:
        app.logger.error(f"Unexpected error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(429)
def ratelimit_error(error):
    return jsonify({'error': 'Rate limit exceeded'}), 429

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f"Internal server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Don't run with debug=True in production
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=False
    )
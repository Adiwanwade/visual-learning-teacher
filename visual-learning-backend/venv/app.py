from flask import Flask, request, jsonify
from flask_cors import CORS
import base64  # Import base64 module
import io
from PIL import Image
import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Configure the API key for Google Generative AI
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize the model
model = genai.GenerativeModel("gemini-1.5-flash")

def process_base64_image(base64_string):
    """Convert base64 image to a PIL image object."""
    try:
        # Remove data URL prefix if present
        if 'base64,' in base64_string:
            base64_string = base64_string.split('base64,')[1]
        
        # Decode base64 string to binary
        image_data = base64.b64decode(base64_string)  # Decode base64 data
        
        # Create a PIL image from the binary data
        image = Image.open(io.BytesIO(image_data))
        return image
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        return None

@app.route('/api/process-image', methods=['POST'])
def process_image():
    try:
        # Get image data from request
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400

        # Process the image and get a PIL image object
        image = process_base64_image(data['image'])
        if not image:
            return jsonify({'error': 'Invalid image data'}), 400

        # Prepare the prompt for Gemini
        prompt = """
        Analyze the attached image and answer the following:
        - Provide a detailed explanation of the contents of the image.
        - If applicable, describe any mathematical or scientific problems.
        - Suggest possible solutions or insights based on the content.
        """

        # Generate response using Gemini
        response = model.generate_content(
            [prompt, image],  # Send the PIL image object directly
        )

        # Extract and return the solution
        if response.text:
            return jsonify({
                'success': True,
                'solution': response.text
            })
        else:
            return jsonify({'error': 'Could not generate solution'}), 400

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

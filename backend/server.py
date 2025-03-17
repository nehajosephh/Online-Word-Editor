from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import random
import time
from fpdf import FPDF
from docx import Document
import base64
from io import BytesIO
from PIL import Image

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

storage = {}  # Temporary storage for documents

def cleanup_expired_docs():
    """Remove expired documents (older than 10 minutes)"""
    current_time = time.time()
    expired_keys = [key for key, val in storage.items() if current_time - val['timestamp'] > 600]
    for key in expired_keys:
        del storage[key]

@app.route('/save', methods=['POST'])
def save_document():
    """Save a document and return a 4-digit retrieval code"""
    data = request.json
    text = data.get("text", "")
    pin = data.get("pin", "")
    
    cleanup_expired_docs()
    
    if pin and pin in storage:
        # Update existing document
        storage[pin]["text"] = text
        storage[pin]["timestamp"] = time.time()
        return jsonify({"code": pin, "message": "Document updated successfully"})
    else:
        # Generate new PIN and save document
        new_pin = str(random.randint(1000, 9999))
        storage[new_pin] = {
            "text": text,
            "timestamp": time.time()
        }
        return jsonify({"code": new_pin, "message": "Document saved successfully"})

@app.route('/retrieve/<pin>', methods=['GET'])
def retrieve_document(pin):
    """Retrieve a document using a 4-digit code"""
    cleanup_expired_docs()
    
    if pin in storage:
        return jsonify({
            "text": storage[pin]["text"],
            "expired": False
        })
    else:
        return jsonify({
            "error": "Invalid or expired code",
            "expired": True
        }), 404

@app.route('/download/pdf', methods=['POST'])
def download_pdf():
    """Convert text to PDF and return as a file"""
    data = request.json
    text = data.get("text", "")

    if not text:
        return jsonify({"error": "Empty document"}), 400

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    
    # Handle HTML content
    text = text.replace('<br>', '\n')
    text = text.replace('</p>', '\n\n')
    text = text.replace('<p>', '')
    
    # Remove HTML tags
    import re
    text = re.sub('<[^<]+?>', '', text)
    
    pdf.multi_cell(0, 10, text)

    pdf_path = "document.pdf"
    pdf.output(pdf_path)

    return send_file(pdf_path, as_attachment=True)

@app.route('/download/docx', methods=['POST'])
def download_docx():
    """Convert text to DOCX and return as a file"""
    data = request.json
    text = data.get("text", "")

    if not text:
        return jsonify({"error": "Empty document"}), 400

    doc = Document()
    
    # Handle HTML content
    text = text.replace('<br>', '\n')
    text = text.replace('</p>', '\n\n')
    text = text.replace('<p>', '')
    
    # Remove HTML tags
    import re
    text = re.sub('<[^<]+?>', '', text)
    
    doc.add_paragraph(text)

    doc_path = "document.docx"
    doc.save(doc_path)

    return send_file(doc_path, as_attachment=True)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

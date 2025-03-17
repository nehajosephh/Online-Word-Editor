import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [text, setText] = useState("");
  const [pin, setPin] = useState("");
  const [retrievedText, setRetrievedText] = useState("");
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [pinExpiry, setPinExpiry] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const quillRef = useRef(null);

  useEffect(() => {
    // Set up clipboard paste handler
    const handlePaste = (e) => {
      const items = e.clipboardData.items;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          const reader = new FileReader();
          
          reader.onload = () => {
            const base64String = reader.result;
            const quill = quillRef.current.getEditor();
            const range = quill.getSelection();
            quill.insertEmbed(range.index, 'image', base64String);
            quill.setSelection(range.index + 1);
          };
          
          reader.readAsDataURL(file);
          return;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const handleSave = async () => {
    if (!text.trim()) {
      alert("Please enter some text before saving");
      return;
    }
    
    setIsSaving(true);
    try {
      const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      const response = await axios.post(`${API_URL}/save`, { 
        text,
        pin: pin || undefined
      });
      
      setPin(response.data.code);
      setPinExpiry(expiryTime);
      setShowPinModal(true);
    } catch (error) {
      console.error("Error saving document:", error);
      alert("Failed to save document. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetrieve = async () => {
    if (!pin) {
      alert("Please enter a PIN");
      return;
    }
    setIsRetrieving(true);
    try {
      const response = await axios.get(`${API_URL}/retrieve/${pin}`);
      if (response.data.expired) {
        alert("This PIN has expired. Please generate a new one.");
        return;
      }
      setRetrievedText(response.data.text);
      setText(response.data.text); // Update the editor with retrieved text
    } catch (error) {
      console.error("Error retrieving document:", error);
      alert("Failed to retrieve document. Please check the PIN and try again.");
    } finally {
      setIsRetrieving(false);
    }
  };

  const handleDownload = async (format) => {
    if (!text.trim()) {
      alert("Please enter some text before downloading");
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/download/${format}`,
        { text },
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `document.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(`Error downloading ${format}:`, error);
      alert(`Failed to download as ${format}. Please try again.`);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result;
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection();
      quill.insertEmbed(range.index, 'image', base64String);
      quill.setSelection(range.index + 1);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="App">
      <div className="editor-header">
        <h1>Online Word Editor</h1>
        <div className="header-buttons">
          <button 
            onClick={handleSave} 
            className="save-button"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <div className="download-buttons">
            <button onClick={() => handleDownload("pdf")}>PDF</button>
            <button onClick={() => handleDownload("docx")}>DOCX</button>
          </div>
        </div>
      </div>
      
      <div className="editor-container">
        <ReactQuill 
          ref={quillRef}
          value={text} 
          onChange={setText}
          modules={{
            toolbar: [
              [{ 'header': [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              [{ 'color': [] }, { 'background': [] }],
              ['link', 'image'],
              ['clean']
            ]
          }}
        />
      </div>

      {showPinModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Document Saved!</h2>
            <p>Use this PIN to access your document for the next 10 minutes:</p>
            <div className="pin-display">{pin}</div>
            <p className="pin-expiry">Expires at: {pinExpiry.toLocaleTimeString()}</p>
            <button onClick={() => setShowPinModal(false)}>Close</button>
          </div>
        </div>
      )}

      <div className="retrieve-section">
        <h3>Access Document</h3>
        <div className="controls">
          <input
            type="text"
            placeholder="Enter 4-digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength="4"
            pattern="[0-9]*"
          />
          <button onClick={handleRetrieve} disabled={isRetrieving}>
            {isRetrieving ? 'Retrieving...' : 'Access Document'}
          </button>
        </div>
      </div>

      {retrievedText && (
        <div className="retrieved-content">
          <h3>Retrieved Document</h3>
          <div dangerouslySetInnerHTML={{ __html: retrievedText }} />
        </div>
      )}
    </div>
  );
}

export default App;

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');

const app = express();
const upload = multer({ dest: 'uploads/' });
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/generate-image', async (req, res) => {
    const { prompt, aspectRatio } = req.body;
    
    const enhancedPrompt = aspectRatio !== '1:1' 
        ? `${prompt}. The image should be in ${aspectRatio} aspect ratio format.`
        : prompt;

    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: enhancedPrompt
    });
    
    const imageData = result.candidates[0].content.parts.find(part => part.inlineData);
    
    res.json({
        success: true,
        image: {
            data: imageData.inlineData.data,
            mimeType: imageData.inlineData.mimeType
        }
    });
});

app.post('/api/edit-image', upload.single('image'), async (req, res) => {
    const { editPrompt } = req.body;
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    
    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: [
            editPrompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: req.file.mimetype
                }
            }
        ]
    });
    
    fs.unlinkSync(req.file.path);
    
    const imageData = result.candidates[0].content.parts.find(part => part.inlineData);
    
    res.json({
        success: true,
        image: {
            data: imageData.inlineData.data,
            mimeType: imageData.inlineData.mimeType
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK',
        apiKeyConfigured: !!process.env.GOOGLE_API_KEY
    });
});

fs.mkdirSync('uploads', { recursive: true });

app.listen(3000, () => {
    console.log('🚀 Server running on http://localhost:3000');
    console.log(`🔑 API Key configured: ${!!process.env.GOOGLE_API_KEY}`);
});
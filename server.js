const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');

const app = express();
const upload = multer({ dest: 'uploads/' });
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static('public'));

app.post('/api/compose', upload.array('images'), async (req, res) => {
    const { prompt } = req.body;
    let captions = [];
    try {
        if (req.body.captions) captions = JSON.parse(req.body.captions);
    } catch (_) { captions = []; }

    const contents = [prompt];

    if (req.files) {
        req.files.forEach((file, idx) => {
            const imageBuffer = fs.readFileSync(file.path);
            const base64Image = imageBuffer.toString('base64');
            contents.push({
                inlineData: {
                    data: base64Image,
                    mimeType: file.mimetype
                }
            });
            const cap = captions[idx];
            if (cap && typeof cap === 'string' && cap.trim()) {
                contents.push(cap.trim());
            }
            fs.unlinkSync(file.path);
        });
    }

    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents
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

const dataFile = path.join(__dirname, 'data/saved_config.json');
function loadSaved() {
    try {
        if (fs.existsSync(dataFile)) {
            const raw = fs.readFileSync(dataFile, 'utf8');
            const parsed = JSON.parse(raw);
            // Ensure shape
            if (!parsed.images) parsed.images = [];
            if (!parsed.texts) parsed.texts = [];
            if (!parsed.ui) parsed.ui = defaultUiConfig();
            return parsed;
        }
    } catch (e) {
        console.error('Failed to load saved data', e);
    }
    return { images: [], texts: [], ui: defaultUiConfig() };
}
function defaultUiConfig() {
    return {
        panel: { open: false, height: '28vh' },
        layout: { left: '1fr', right: '1fr' },
        view: {
            imagesMode: 'grid',
            imagesSort: { field: 'createdAt', dir: 'desc' },
            textsMode: 'grid',
            textsSort: { field: 'createdAt', dir: 'desc' }
        },
        background: { url: 'assets/playamann.png' }
    };
}
function saveToDisk() {
    try {
        const tmp = path.join(__dirname, 'saved.tmp.json');
        fs.writeFileSync(tmp, JSON.stringify(savedData, null, 2));
        fs.renameSync(tmp, dataFile);
    } catch (e) {
        console.error('Failed to persist saved data', e);
    }
}

let savedData = loadSaved();

app.get('/api/saved', (req, res) => {
    res.json(savedData);
});

app.get('/api/ui-config', (req, res) => {
    res.json(savedData.ui || defaultUiConfig());
});

app.put('/api/ui-config', (req, res) => {
    const incoming = req.body || {};
    // Deep merge for layout.cards to avoid losing nested keys
    const current = savedData.ui || defaultUiConfig();
    const merged = {
        ...defaultUiConfig(),
        ...current,
        ...incoming,
        layout: {
            ...current.layout,
            ...incoming.layout,
            cards: {
                ...(current.layout ? current.layout.cards : {}),
                ...(incoming.layout ? incoming.layout.cards : {})
            }
        }
    };
    savedData.ui = merged;
    saveToDisk();
    res.json(savedData.ui);
});

app.post('/api/save-image', (req, res) => {
    const { data, mimeType, name, size, createdAt, caption } = req.body;
    const id = Date.now().toString();
    const defaultName = name && name.trim() ? name.trim() : `Image ${savedData.images.length + 1}`;
    const computedSize = typeof size === 'number' ? size : Math.ceil((data?.length || 0) * 3 / 4);
    const ts = typeof createdAt === 'number' ? createdAt : Date.now();
    savedData.images.push({ id, data, mimeType, name: defaultName, caption: caption || '', size: computedSize, createdAt: ts });
    saveToDisk();
    res.json({ id, name: defaultName, caption: caption || '', size: computedSize, createdAt: ts });
});

app.post('/api/save-text', (req, res) => {
    const { text, name, size, createdAt } = req.body;
    const id = Date.now().toString();
    const defaultName = name && name.trim() ? name.trim() : `Snippet ${savedData.texts.length + 1}`;
    const computedSize = typeof size === 'number' ? size : Buffer.byteLength(text || '', 'utf8');
    const ts = typeof createdAt === 'number' ? createdAt : Date.now();
    savedData.texts.push({ id, text, name: defaultName, size: computedSize, createdAt: ts });
    saveToDisk();
    res.json({ id, name: defaultName, size: computedSize, createdAt: ts });
});

app.patch('/api/saved/image/:id', (req, res) => {
    const { name, data, mimeType, size, caption } = req.body;
    const item = savedData.images.find(img => img.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (typeof name !== 'undefined') item.name = (name || '').trim() || item.name || 'Image';
    if (typeof caption !== 'undefined') item.caption = caption || '';
    if (typeof data === 'string' && data.length > 0) {
        item.data = data;
        if (mimeType) item.mimeType = mimeType;
        const computedSize = typeof size === 'number' ? size : Math.ceil((data.length || 0) * 3 / 4);
        item.size = computedSize;
    }
    saveToDisk();
    res.json({ success: true });
});

app.patch('/api/saved/text/:id', (req, res) => {
    const { name, text } = req.body;
    const item = savedData.texts.find(txt => txt.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (typeof name !== 'undefined') item.name = (name || '').trim() || item.name || 'Snippet';
    if (typeof text !== 'undefined') item.text = text || '';
    saveToDisk();
    res.json({ success: true });
});

app.delete('/api/saved/image/:id', (req, res) => {
    savedData.images = savedData.images.filter(img => img.id !== req.params.id);
    saveToDisk();
    res.json({ success: true });
});

app.delete('/api/saved/text/:id', (req, res) => {
    savedData.texts = savedData.texts.filter(txt => txt.id !== req.params.id);
    saveToDisk();
    res.json({ success: true });
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

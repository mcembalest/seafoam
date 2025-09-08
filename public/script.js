let currentFile = null;

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupFileUpload();
    setupGenerateButton();
    setupEditButton();
    setupDownloadButton();
});

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        };
    });
}

function setupFileUpload() {
    const uploadArea = document.getElementById('file-upload-area');
    const fileInput = document.getElementById('image-upload');
    
    uploadArea.onclick = () => fileInput.click();
    fileInput.onchange = (e) => handleFile(e.target.files[0]);
    
    uploadArea.ondragover = (e) => e.preventDefault();
    uploadArea.ondrop = (e) => {
        e.preventDefault();
        handleFile(e.dataTransfer.files[0]);
    };
}

function handleFile(file) {
    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('file-upload-area').innerHTML = 
            `<img src="${e.target.result}" style="max-width:100%;max-height:200px;border-radius:8px;">`;
    };
    reader.readAsDataURL(file);
    document.getElementById('edit-btn').disabled = false;
}

function setupGenerateButton() {
    document.getElementById('generate-btn').onclick = async () => {
        const prompt = document.getElementById('prompt').value;
        const aspectRatio = document.getElementById('aspect-ratio').value;
        
        setLoading('generate-btn', true);
        
        const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, aspectRatio })
        });
        
        const data = await response.json();
        displayImage(data.image);
        setLoading('generate-btn', false);
    };
}

function setupEditButton() {
    document.getElementById('edit-btn').onclick = async () => {
        const editPrompt = document.getElementById('edit-prompt').value;
        const formData = new FormData();
        formData.append('image', currentFile);
        formData.append('editPrompt', editPrompt);
        
        setLoading('edit-btn', true);
        
        const response = await fetch('/api/edit-image', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        displayImage(data.image);
        setLoading('edit-btn', false);
    };
}

function setupDownloadButton() {
    document.getElementById('download-btn').onclick = () => {
        const img = document.getElementById('generated-image');
        const link = document.createElement('a');
        link.href = img.src;
        link.download = `seafoam-${Date.now()}.png`;
        link.click();
    };
}

function displayImage(imageData) {
    const img = document.getElementById('generated-image');
    img.src = `data:${imageData.mimeType};base64,${imageData.data}`;
    
    document.getElementById('image-placeholder').style.display = 'none';
    document.getElementById('image-result').style.display = 'block';
}

function setLoading(buttonId, loading) {
    const btn = document.getElementById(buttonId);
    btn.disabled = loading;
    btn.querySelector('.btn-text').style.display = loading ? 'none' : 'block';
    btn.querySelector('.btn-loading').style.display = loading ? 'flex' : 'none';
}
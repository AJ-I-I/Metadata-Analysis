import init, { ImageAnalyzer } from './pkg/image_forensics.js';

let analyzer = null;
let currentImageData = null;
let currentResults = null;
let map = null;
let terminalLines = [];

// Terminal functions (defined early for use in initWasm)
function addTerminalLine(text, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    terminalLines.push({ text: `[${timestamp}] ${text}`, type });
    updateTerminal();
}

function updateTerminal() {
    const terminalBody = document.getElementById('terminal-body');
    if (terminalBody) {
        terminalBody.innerHTML = terminalLines.map(line => {
            return `<div class="terminal-line ${line.type}">${escapeHtml(line.text)}</div>`;
        }).join('');
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize WebAssembly module
async function initWasm() {
    try {
        await init();
        analyzer = new ImageAnalyzer();
        addTerminalLine('WebAssembly module loaded successfully', 'success');
    } catch (error) {
        console.error('Failed to initialize WebAssembly:', error);
        addTerminalLine('Failed to initialize WebAssembly module', 'error');
    }
}

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Initialize map if switching to analysis tab
    if (tabName === 'analysis' && !map) {
        initMap();
    }
}

// File upload
const uploadArea = document.getElementById('upload-area');
const imageInput = document.getElementById('image-input');
const imagePreview = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');
const removeImageBtn = document.getElementById('remove-image');
const analyzeBtn = document.getElementById('analyze-btn');

uploadArea.addEventListener('click', () => imageInput.click());
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.background = '#e8f0ff';
});
uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.background = '#f8f9ff';
});
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.background = '#f8f9ff';
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleImageFile(files[0]);
    }
});

imageInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleImageFile(e.target.files[0]);
    }
});

removeImageBtn.addEventListener('click', () => {
    currentImageData = null;
    imageInput.value = '';
    uploadArea.style.display = 'block';
    imagePreview.style.display = 'none';
    analyzeBtn.disabled = true;
});

function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        currentImageData = new Uint8Array(e.target.result);
        previewImg.src = e.target.result;
        uploadArea.style.display = 'none';
        imagePreview.style.display = 'block';
        analyzeBtn.disabled = false;
    };
    reader.readAsArrayBuffer(file);
}

// Analysis
analyzeBtn.addEventListener('click', async () => {
    if (!currentImageData || !analyzer) {
        alert('Please upload an image first');
        return;
    }

    const options = {
        extract_metadata: document.getElementById('extract-metadata').checked,
        reverse_image_search: document.getElementById('reverse-search').checked,
        plot_coordinates: document.getElementById('plot-coordinates').checked,
    };

    // Switch to analysis tab
    switchTab('analysis');
    
    // Clear terminal
    terminalLines = [];
    updateTerminal();

    addTerminalLine('Starting image analysis...', 'info');
    addTerminalLine('Loading image data...', 'info');

    try {
        addTerminalLine('Extracting metadata from image...', 'info');
        const resultsJsValue = analyzer.analyze_image(currentImageData, options);
        const results = JSON.parse(JSON.stringify(resultsJsValue));
        currentResults = results;

        addTerminalLine('Metadata extraction completed', 'success');
        
        if (options.extract_metadata) {
            addTerminalLine('Processing metadata fields...', 'info');
            const metadata = results;
            
            if (metadata.gps_latitude && metadata.gps_longitude) {
                addTerminalLine(`Found GPS coordinates: ${metadata.gps_latitude}, ${metadata.gps_longitude}`, 'success');
                plotLocationOnMap(metadata.gps_latitude, metadata.gps_longitude);
            } else {
                addTerminalLine('No GPS coordinates found in metadata', 'warning');
                addTerminalLine('Centering map on default location...', 'info');
                centerMapOnDefault();
            }
        }

        if (options.reverse_image_search) {
            addTerminalLine('Reverse image search not yet implemented', 'warning');
        }

        addTerminalLine('Analysis complete!', 'success');
        
        // Update results tab
        updateResultsTab(results);
        
        // Switch to results tab after a delay
        setTimeout(() => {
            switchTab('results');
        }, 2000);

    } catch (error) {
        console.error('Analysis error:', error);
        addTerminalLine(`Error during analysis: ${error}`, 'error');
    }
});

// Map functions
function initMap() {
    if (map) return;

    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([0, 0]),
            zoom: 2
        })
    });

    centerMapOnDefault();
}

function centerMapOnDefault() {
    if (!map) return;

    // Try to get user's location from IP (fallback to default location)
    // use ipapi
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            if (data.latitude && data.longitude) {
                const center = ol.proj.fromLonLat([data.longitude, data.latitude]);
                map.getView().setCenter(center);
                map.getView().setZoom(6);
                addTerminalLine(`Centered map on approximate location: ${data.city || 'Unknown'}, ${data.country_name || 'Unknown'}`, 'info');
            } else {
                // CHANGE THIS TO DIFFERENT LOCATION
                const center = ol.proj.fromLonLat([-95.7129, 37.0902]);
                map.getView().setCenter(center);
                map.getView().setZoom(4);
            }
        })
        .catch(() => {
            // Default to center of US
            const center = ol.proj.fromLonLat([-95.7129, 37.0902]);
            map.getView().setCenter(center);
            map.getView().setZoom(4);
        });
}

function plotLocationOnMap(latitude, longitude) {
    if (!map) initMap();

    // Remove existing markers
    const existingLayers = map.getLayers().getArray();
    existingLayers.forEach(layer => {
        if (layer.get('name') === 'marker') {
            map.removeLayer(layer);
        }
    });

    const center = ol.proj.fromLonLat([longitude, latitude]);
    
    // Add marker
    const marker = new ol.layer.Vector({
        name: 'marker',
        source: new ol.source.Vector({
            features: [
                new ol.Feature({
                    geometry: new ol.geom.Point(center),
                })
            ]
        }),
        style: new ol.style.Style({
            image: new ol.style.Icon({
                anchor: [0.5, 1],
                src: 'https://openlayers.org/en/latest/examples/data/icon.png'
            })
        })
    });

    map.addLayer(marker);
    map.getView().setCenter(center);
    map.getView().setZoom(15);
}

// Results tab
function updateResultsTab(results) {
    const resultsContent = document.getElementById('results-content');
    
    if (!results || Object.keys(results).length === 0) {
        resultsContent.innerHTML = '<p class="no-results">No results available</p>';
        return;
    }

    let html = '';

    // Camera Information
    if (results.camera_make || results.camera_model) {
        html += '<div class="metadata-section">';
        html += '<h3>Camera Information</h3>';
        html += '<div class="metadata-grid">';
        if (results.camera_make) {
            html += `<div class="metadata-item">
                <div class="metadata-label">Make</div>
                <div class="metadata-value">${escapeHtml(results.camera_make)}</div>
            </div>`;
        }
        if (results.camera_model) {
            html += `<div class="metadata-item">
                <div class="metadata-label">Model</div>
                <div class="metadata-value">${escapeHtml(results.camera_model)}</div>
            </div>`;
        }
        html += '</div></div>';
    }

    // Image Properties
    html += '<div class="metadata-section">';
    html += '<h3>Image Properties</h3>';
    html += '<div class="metadata-grid">';
    if (results.width && results.height) {
        html += `<div class="metadata-item">
            <div class="metadata-label">Dimensions</div>
            <div class="metadata-value">${results.width} × ${results.height} pixels</div>
        </div>`;
    }
    if (results.date_taken) {
        html += `<div class="metadata-item">
            <div class="metadata-label">Date Taken</div>
            <div class="metadata-value">${escapeHtml(results.date_taken)}</div>
        </div>`;
    }
    if (results.software) {
        html += `<div class="metadata-item">
            <div class="metadata-label">Software</div>
            <div class="metadata-value">${escapeHtml(results.software)}</div>
        </div>`;
    }
    html += '</div></div>';

    // GPS Information
    if (results.gps_latitude && results.gps_longitude) {
        html += '<div class="metadata-section">';
        html += '<h3>Location Information</h3>';
        html += '<div class="metadata-grid">';
        html += `<div class="metadata-item">
            <div class="metadata-label">Latitude</div>
            <div class="metadata-value">${results.gps_latitude.toFixed(6)}</div>
        </div>`;
        html += `<div class="metadata-item">
            <div class="metadata-label">Longitude</div>
            <div class="metadata-value">${results.gps_longitude.toFixed(6)}</div>
        </div>`;
        if (results.gps_altitude) {
            html += `<div class="metadata-item">
                <div class="metadata-label">Altitude</div>
                <div class="metadata-value">${results.gps_altitude.toFixed(2)} meters</div>
            </div>`;
        }
        html += '</div></div>';
    }

    // Camera Settings
    if (results.iso || results.exposure_time || results.f_number || results.focal_length) {
        html += '<div class="metadata-section">';
        html += '<h3>Camera Settings</h3>';
        html += '<div class="metadata-grid">';
        if (results.iso) {
            html += `<div class="metadata-item">
                <div class="metadata-label">ISO</div>
                <div class="metadata-value">${results.iso}</div>
            </div>`;
        }
        if (results.exposure_time) {
            html += `<div class="metadata-item">
                <div class="metadata-label">Exposure Time</div>
                <div class="metadata-value">${escapeHtml(results.exposure_time)}</div>
            </div>`;
        }
        if (results.f_number) {
            html += `<div class="metadata-item">
                <div class="metadata-label">F-Number</div>
                <div class="metadata-value">${escapeHtml(results.f_number)}</div>
            </div>`;
        }
        if (results.focal_length) {
            html += `<div class="metadata-item">
                <div class="metadata-label">Focal Length</div>
                <div class="metadata-value">${escapeHtml(results.focal_length)}</div>
            </div>`;
        }
        html += '</div></div>';
    }

    // All Fields
    if (results.all_fields && results.all_fields.length > 0) {
        html += '<div class="metadata-section all-fields-section">';
        html += '<h3>All Metadata Fields</h3>';
        results.all_fields.forEach(field => {
            html += `<div class="field-item">
                <div class="field-tag">${escapeHtml(field.tag)}</div>
                <div class="field-value">${escapeHtml(field.value)}</div>
            </div>`;
        });
        html += '</div>';
    }

    resultsContent.innerHTML = html;
}

// Export functions
document.getElementById('export-json').addEventListener('click', () => {
    if (!currentResults) {
        alert('No results to export');
        return;
    }
    exportToFile(JSON.stringify(currentResults, null, 2), 'results.json', 'application/json');
});

document.getElementById('export-csv').addEventListener('click', () => {
    if (!currentResults) {
        alert('No results to export');
        return;
    }
    const csv = convertToCSV(currentResults);
    exportToFile(csv, 'results.csv', 'text/csv');
});

document.getElementById('export-txt').addEventListener('click', () => {
    if (!currentResults) {
        alert('No results to export');
        return;
    }
    const txt = convertToTXT(currentResults);
    exportToFile(txt, 'results.txt', 'text/plain');
});

function exportToFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function convertToCSV(data) {
    let csv = 'Field,Value\n';
    
    if (data.camera_make) csv += `Camera Make,${data.camera_make}\n`;
    if (data.camera_model) csv += `Camera Model,${data.camera_model}\n`;
    if (data.date_taken) csv += `Date Taken,${data.date_taken}\n`;
    if (data.width && data.height) csv += `Dimensions,${data.width}x${data.height}\n`;
    if (data.gps_latitude) csv += `GPS Latitude,${data.gps_latitude}\n`;
    if (data.gps_longitude) csv += `GPS Longitude,${data.gps_longitude}\n`;
    if (data.gps_altitude) csv += `GPS Altitude,${data.gps_altitude}\n`;
    if (data.iso) csv += `ISO,${data.iso}\n`;
    if (data.exposure_time) csv += `Exposure Time,${data.exposure_time}\n`;
    if (data.f_number) csv += `F-Number,${data.f_number}\n`;
    if (data.focal_length) csv += `Focal Length,${data.focal_length}\n`;
    if (data.software) csv += `Software,${data.software}\n`;
    
    if (data.all_fields) {
        data.all_fields.forEach(field => {
            csv += `${field.tag},"${field.value.replace(/"/g, '""')}"\n`;
        });
    }
    
    return csv;
}

function convertToTXT(data) {
    let txt = 'DIGITAL FORENSIC IMAGE ANALYSIS RESULTS\n';
    txt += '='.repeat(50) + '\n\n';
    
    if (data.camera_make || data.camera_model) {
        txt += 'CAMERA INFORMATION\n';
        txt += '-'.repeat(30) + '\n';
        if (data.camera_make) txt += `Make: ${data.camera_make}\n`;
        if (data.camera_model) txt += `Model: ${data.camera_model}\n`;
        txt += '\n';
    }
    
    txt += 'IMAGE PROPERTIES\n';
    txt += '-'.repeat(30) + '\n';
    if (data.width && data.height) txt += `Dimensions: ${data.width} × ${data.height} pixels\n`;
    if (data.date_taken) txt += `Date Taken: ${data.date_taken}\n`;
    if (data.software) txt += `Software: ${data.software}\n`;
    txt += '\n';
    
    if (data.gps_latitude && data.gps_longitude) {
        txt += 'LOCATION INFORMATION\n';
        txt += '-'.repeat(30) + '\n';
        txt += `Latitude: ${data.gps_latitude}\n`;
        txt += `Longitude: ${data.gps_longitude}\n`;
        if (data.gps_altitude) txt += `Altitude: ${data.gps_altitude} meters\n`;
        txt += '\n';
    }
    
    if (data.iso || data.exposure_time || data.f_number || data.focal_length) {
        txt += 'CAMERA SETTINGS\n';
        txt += '-'.repeat(30) + '\n';
        if (data.iso) txt += `ISO: ${data.iso}\n`;
        if (data.exposure_time) txt += `Exposure Time: ${data.exposure_time}\n`;
        if (data.f_number) txt += `F-Number: ${data.f_number}\n`;
        if (data.focal_length) txt += `Focal Length: ${data.focal_length}\n`;
        txt += '\n';
    }
    
    if (data.all_fields && data.all_fields.length > 0) {
        txt += 'ALL METADATA FIELDS\n';
        txt += '-'.repeat(30) + '\n';
        data.all_fields.forEach(field => {
            txt += `${field.tag}: ${field.value}\n`;
        });
    }
    
    return txt;
}

// Initialize on load for webassemmbley
initWasm();


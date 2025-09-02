// Global variables
let net;
let webcam;
let trainingWebcam;
let predictionWebcam;
let classifier = knnClassifier.create();
let classes = [];
let isTraining = false;
let isPredicting = false;
let currentClass = null;
let flipCamera = false;
let trainingMode = false;
let predictionMode = false;
let autoCollectionActive = false;

// DOM Elements
const startButton = document.getElementById('startButton');
const flipButton = document.getElementById('flipButton');
const addClassBtn = document.getElementById('addClassBtn');
const trainBtn = document.getElementById('trainBtn');
const startTrainingBtn = document.getElementById('startTraining');
const saveModelBtn = document.getElementById('saveModel');
const classNameInput = document.getElementById('className');
const classButtons = document.getElementById('classButtons');
const webcamContainer = document.getElementById('webcam-container');
const labelContainer = document.getElementById('label-container');
const predictionResults = document.getElementById('predictionResults');
const recordButton = document.createElement('button');
const captureStats = document.createElement('div');
const trainingWebcamContainer = document.getElementById('training-webcam-container');
const stopTrainingModeBtn = document.getElementById('stopTrainingMode');

// Training data storage
let trainingData = {};
let currentClassSamples = 0;
const MAX_SAMPLES_PER_CLASS = 100; // Maximum number of samples per class

// Initialize the application when the DOM is loaded
async function initApp() {
    try {
        // Setup record button
        recordButton.id = 'recordButton';
        recordButton.textContent = 'Hold to Record';
        recordButton.disabled = true;
        document.querySelector('.controls').appendChild(recordButton);
        
        // Setup capture stats
        captureStats.id = 'captureStats';
        document.querySelector('.controls').appendChild(captureStats);
        updateCaptureStats();
        
        console.log('Loading TensorFlow.js and MobileNet...');
        // Initialize TensorFlow.js
        await tf.ready();
        console.log('TensorFlow.js is ready');
        
        // Load MobileNet
        net = await mobilenet.load();
        console.log('MobileNet loaded');
        
        // Initialize the KNN classifier
        classifier = knnClassifier.create();
        
        // Enable the start button
        if (startButton) {
            startButton.disabled = false;
        }
        
        console.log('Application initialized');
    } catch (error) {
        console.error('Error initializing application:', error);
        alert('Failed to initialize the application. Please check the console for details: ' + error.message);
    }
    
    // Set up event listeners
    setupEventListeners();
}

// Start the application when the window loads
window.addEventListener('DOMContentLoaded', initApp);

// Update capture statistics display
function updateCaptureStats() {
    let stats = [];
    for (const className in trainingData) {
        stats.push(`${className}: ${trainingData[className] || 0} samples`);
    }
    
    let statusText = stats.join(' | ') || 'No samples captured yet';
    
    // Add prediction status
    if (isPredicting) {
        statusText += ' | 🔍 Predicting...';
    }
    
    captureStats.textContent = statusText;
}

// Start training mode with separate webcam
async function startTrainingMode() {
    if (classes.length < 1) {
        alert('Please add at least one class first');
        return;
    }
    
    try {
        trainingMode = true;
        
        // Show the training webcam container
        trainingWebcamContainer.style.display = 'block';
        
        // Create training webcam
        const trainingWebcamElement = document.getElementById('training-webcam');
        trainingWebcam = new Webcam(trainingWebcamElement, 'user');
        await trainingWebcam.setup();
        
        // Start automatic training for all classes
        startAutomaticTraining();
        
        // Start predictions on main webcam if it exists
        if (webcam && webcam.isStreaming()) {
            startPredicting();
        }
        
        showMessage('Training mode started! The system will automatically collect training data.', 'success');
        
    } catch (error) {
        console.error('Error starting training mode:', error);
        showMessage('Error starting training mode: ' + error.message, 'error');
    }
}

// Stop training mode
async function stopTrainingMode() {
    trainingMode = false;
    
    // Hide training webcam
    trainingWebcamContainer.style.display = 'none';
    
    // Stop training webcam
    if (trainingWebcam) {
        await trainingWebcam.stop();
        trainingWebcam = null;
    }
    
    // Stop automatic training
    isTraining = false;
    
    showMessage('Training mode stopped', 'info');
}

// Automatic training for all classes
async function startAutomaticTraining() {
    if (!trainingWebcam || !trainingMode) return;
    
    isTraining = true;
    let classIndex = 0;
    
    const trainNextClass = async () => {
        if (!trainingMode || !isTraining) return;
        
        const className = classes[classIndex];
        if (!className) return;
        
        // Set current class
        setCurrentClass(className);
        
        // Collect samples for this class
        for (let i = 0; i < 20 && trainingMode; i++) {
            try {
                const img = await trainingWebcam.capture();
                const activation = net.infer(img, true);
                classifier.addExample(activation, className);
                
                if (!trainingData[className]) trainingData[className] = 0;
                trainingData[className]++;
                updateCaptureStats();
                
                img.dispose();
                activation.dispose();
                
                // Wait between captures
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error('Error during automatic training:', error);
            }
        }
        
        // Move to next class
        classIndex = (classIndex + 1) % classes.length;
        
        // Continue training
        if (trainingMode) {
            setTimeout(trainNextClass, 1000);
        }
    };
    
    trainNextClass();
}

// Set up event listeners
function setupEventListeners() {
    // Start/Stop Webcam
    startButton.addEventListener('click', toggleWebcam);
    
    // Record button events
    recordButton.addEventListener('mousedown', startRecording);
    recordButton.addEventListener('touchstart', startRecording);
    recordButton.addEventListener('mouseup', stopRecording);
    recordButton.addEventListener('touchend', stopRecording);
    recordButton.addEventListener('mouseleave', stopRecording);
    
    // Flip Camera
    flipButton.addEventListener('click', () => {
        flipCamera = !flipCamera;
        if (webcam) {
            toggleWebcam(); // Restart webcam with new settings
            setTimeout(toggleWebcam, 100);
        }
    });
    
    // Add Class
    addClassBtn.addEventListener('click', addNewClass);
    
    // Train Model
    trainBtn.addEventListener('click', trainModel);
    
    // Start Training
    startTrainingBtn.addEventListener('click', startTrainingMode);
    
    // Stop Training Mode
    if (stopTrainingModeBtn) {
        stopTrainingModeBtn.addEventListener('click', stopTrainingMode);
    }
    
    // Save Model
    saveModelBtn.addEventListener('click', saveModel);
    
    // Allow pressing Enter in the class name input to add a new class
    classNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addNewClass();
        }
    });
}

// Toggle webcam on/off
// Start recording frames
function startRecording(e) {
    e.preventDefault();
    if (!webcam || !currentClass || isTraining) return;
    
    recordButton.textContent = 'Recording...';
    recordButton.classList.add('recording');
    
    // Start capturing frames at 100ms intervals
    webcam.startCapture(100, async (frame) => {
        if (!trainingData[currentClass]) {
            trainingData[currentClass] = 0;
        }
        
        if (trainingData[currentClass] < MAX_SAMPLES_PER_CLASS) {
            try {
                // Get the activation from MobileNet
                const activation = net.infer(frame, true);
                
                // Add the example to the classifier
                classifier.addExample(activation, currentClass);
                
                // Update the count
                trainingData[currentClass]++;
                updateCaptureStats();
                
                // Show visual indicator for each capture
                const indicator = document.createElement('div');
                indicator.className = 'capture-indicator';
                indicator.style.left = Math.random() * window.innerWidth + 'px';
                indicator.style.top = Math.random() * window.innerHeight + 'px';
                document.body.appendChild(indicator);
                setTimeout(() => indicator.remove(), 500);
                
                console.log(`Added training example for ${currentClass}. Total: ${trainingData[currentClass]}`);
            } catch (error) {
                console.error('Error adding training example:', error);
            }
        } else {
            showMessage(`Maximum samples (${MAX_SAMPLES_PER_CLASS}) reached for ${currentClass}`, 'warning');
            stopRecording();
        }
    });
}

// Stop recording frames
function stopRecording() {
    if (!webcam) return;
    
    webcam.stopCapture();
    recordButton.textContent = 'Hold to Record';
    recordButton.classList.remove('recording');
    updateCaptureStats();
    
    // Auto-start predictions if we have training data for multiple classes
    const trainedClasses = Object.keys(trainingData).filter(className => trainingData[className] > 0);
    if (trainedClasses.length >= 2 && !isPredicting) {
        startPredicting();
    }
}

// Toggle webcam on/off
async function toggleWebcam() {
    try {
        if (webcam && webcam.isStreaming()) {
            // Stop the webcam
            await webcam.stop();
            webcam = null;
            startButton.textContent = 'Enable Webcam';
            flipButton.disabled = true;
            recordButton.disabled = true;
        } else {
            // Start the webcam
            const webcamElement = document.getElementById('webcam-container');
            webcam = new Webcam(webcamElement, flipCamera ? 'environment' : 'user');
            await webcam.setup();
            startButton.textContent = 'Disable Webcam';
            flipButton.disabled = false;
            
            // Enable record button if a class is selected
            if (currentClass) {
                recordButton.disabled = false;
            }
        }
    } catch (error) {
        console.error('Error toggling webcam:', error);
        alert(`Error accessing webcam: ${error.message}`);
        if (startButton) {
            startButton.disabled = false;
            startButton.textContent = 'Enable Webcam';
        }
    }
}

// Add a new class for training
function addNewClass() {
    const className = classNameInput.value.trim();
    
    if (!className) {
        alert('Please enter a class name');
        return;
    }
    
    if (classes.includes(className)) {
        alert('This class already exists');
        return;
    }
    
    // Add the class to our list
    classes.push(className);
    
    // Initialize training data for this class
    trainingData[className] = 0;
    
    // Create a button for this class
    const button = document.createElement('button');
    button.className = 'class-button';
    button.innerHTML = `
        ${className}
        <span class="delete-class" data-class="${className}">×</span>
    `;
    
    // Add click event to the button to set the current class
    button.addEventListener('click', () => setCurrentClass(className));
    
    // Add delete functionality to the delete button
    const deleteBtn = button.querySelector('.delete-class');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteClass(className);
    });
    
    classButtons.appendChild(button);
    
    // Clear the input
    classNameInput.value = '';
    
    // Enable the train button if we have at least 1 class
    if (classes.length >= 1) {
        trainBtn.disabled = false;
    }
    
    // Set the first class as current
    if (classes.length === 1) {
        setCurrentClass(className);
    }
    
    // Automatically start collecting samples for this class if webcam is active
    if (webcam && webcam.isStreaming()) {
        autoCollectSamples(className);
    }
    
    updateCaptureStats();
}

// Set the current class for adding training examples
function setCurrentClass(className) {
    currentClass = className;
    
    // Initialize training data for this class if it doesn't exist
    if (!trainingData[className]) {
        trainingData[className] = 0;
        updateCaptureStats();
    }
    
    // Update the active state of all class buttons
    document.querySelectorAll('.class-button').forEach(btn => {
        if (btn.textContent.includes(className)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Enable record button if webcam is active
    if (webcam && webcam.isStreaming()) {
        recordButton.disabled = false;
    }
}

// Delete a class
function deleteClass(className) {
    // Remove the class from our list
    classes = classes.filter(c => c !== className);
    
    // Remove the class button
    const button = Array.from(document.querySelectorAll('.class-button'))
        .find(btn => btn.textContent.includes(className));
    
    if (button) {
        button.remove();
    }
    
    // Update the classifier to remove this class
    if (classifier && classifier.getNumClasses() > 0) {
        // We'd need to retrain the model after removing a class
        // For simplicity, we'll just clear the classifier
        classifier = knnClassifier.create();
        isTraining = false;
        isPredicting = false;
        startTrainingBtn.disabled = true;
        saveModelBtn.disabled = true;
    }
    
    // Update the train button state
    trainBtn.disabled = classes.length < 1;
    
    // Remove from training data
    delete trainingData[className];
    updateCaptureStats();
}

// Start the training process
function startTraining() {
    if (!webcam) {
        alert('Please start the webcam first');
        return;
    }
    
    if (classes.length < 2) {
        alert('You need at least 2 classes to start training');
        return;
    }
    
    // Disable the start training button
    startTrainingBtn.disabled = true;
    
    // Enable the train button
    trainBtn.disabled = false;
    
    // Enable the save model button
    saveModelBtn.disabled = false;
    
    // Start the training loop
    isTraining = true;
    trainModel();
}

// Train the model - now starts prediction webcam
async function trainModel() {
    if (classes.length < 1) {
        alert('Please add at least one class first');
        return;
    }
    
    try {
        // Start prediction webcam mode
        await startPredictionWebcam();
        showMessage('Training complete! Prediction webcam started.', 'success');
    } catch (error) {
        console.error('Error starting prediction mode:', error);
        showMessage('Error starting prediction mode: ' + error.message, 'error');
    }
}

// Start continuous predictions
function startPredicting() {
    if (!webcam || !classifier || classifier.getNumClasses() === 0) {
        return;
    }
    
    isPredicting = true;
    updateCaptureStats();
    predict();
}

// Stop continuous predictions
function stopPredicting() {
    isPredicting = false;
    updateCaptureStats();
}

// Start/Stop prediction
async function togglePrediction() {
    if (isPredicting) {
        stopPredicting();
        predictButton.textContent = 'Start Prediction';
        return;
    }
    
    if (classifier.getNumClasses() < 2) {
        alert('Please train the model with at least 2 classes first');
        return;
    }
    
    startPredicting();
    predictButton.textContent = 'Stop Prediction';
}

// Make a prediction using the trained model
async function predict() {
    if (!webcam || !classifier || classifier.getNumClasses() === 0) {
        showMessage('Please train the model first', 'warning');
        return;
    }
    
    try {
        // Get the current frame from the webcam
        const img = await webcam.capture();
        
        // Get the activation from MobileNet
        const activation = net.infer(img, 'conv_preds');
        
        // Get the prediction from the classifier
        const result = await classifier.predictClass(activation);
        
        // Get the probabilities for all classes
        const predictions = Array.from(result.confidences)
            .map((confidence, index) => ({
                className: Object.keys(result.confidences)[index],
                probability: confidence
            }))
            .sort((a, b) => b.probability - a.probability);
        
        // Display the predictions
        displayPredictions(predictions);
        
        // Dispose the tensor to avoid memory leaks
        img.dispose();
        activation.dispose();
        
        // Continue predicting if still in prediction mode
        if (isPredicting) {
            setTimeout(predict, 200); // Predict every 200ms
        }
    } catch (error) {
        console.error('Error making prediction:', error);
        showMessage('Error making prediction. Please try again.', 'error');
    }
}

// Display the predictions in the UI
function displayPredictions(predictions) {
    // Clear previous predictions
    predictionResults.innerHTML = '';
    
    // Show the top prediction prominently
    if (predictions.length > 0) {
        const topPrediction = predictions[0];
        if (topPrediction.probability > 0.7) { // Only show if confidence is high
            const currentPredictionElement = document.createElement('div');
            currentPredictionElement.className = 'current-prediction';
            currentPredictionElement.textContent = `Identified: ${topPrediction.className} (${Math.round(topPrediction.probability * 100)}%)`;
            predictionResults.appendChild(currentPredictionElement);
        }
    }
    
    // Add each prediction to the UI
    predictions.forEach(prediction => {
        const predictionElement = document.createElement('div');
        predictionElement.className = 'prediction-row';
        predictionElement.innerHTML = `
            <span class="prediction-label">${prediction.className}</span>
            <div class="prediction-bar-container">
                <div class="prediction-bar" style="width: ${prediction.probability * 100}%"></div>
            </div>
            <span class="prediction-percent">${Math.round(prediction.probability * 100)}%</span>
        `;
        predictionResults.appendChild(predictionElement);
    });
}

// Save the trained model
async function saveModel() {
    if (classifier.getNumClasses() < 2) {
        alert('Please train the model with at least 2 classes first');
        return;
    }
    
    try {
        // Convert the classifier to a JSON object
        const dataset = classifier.getClassifierDataset();
        const datasetObj = {};
        
        // Convert TensorFlow tensors to arrays for JSON serialization
        Object.keys(dataset).forEach(key => {
            const data = dataset[key].dataSync();
            datasetObj[key] = Array.from(data);
        });
        
        // Create a download link
        const jsonData = JSON.stringify(datasetObj);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'model.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        showMessage('Model saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving model:', error);
        showMessage('Error saving model. Please try again.', 'error');
    }
}

// Show a message to the user
function showMessage(message, type = 'info') {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    // Add the message to the UI
    const messageContainer = document.getElementById('message-container') || (() => {
        const container = document.createElement('div');
        container.id = 'message-container';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.zIndex = '1000';
        document.body.appendChild(container);
        return container;
    })();
    
    messageContainer.appendChild(messageElement);
    
    // Remove the message after 3 seconds
    setTimeout(() => {
        messageElement.remove();
        
        // If no more messages, remove the container
        if (messageContainer.children.length === 0) {
            messageContainer.remove();
        }
    }, 3000);
  }

// Automatically collect samples for a class
async function autoCollectSamples(className, sampleCount = 30) {
    if (!webcam || !webcam.isStreaming() || autoCollectionActive) {
        return;
    }
    
    autoCollectionActive = true;
    showMessage(`Auto-collecting ${sampleCount} samples for ${className}...`, 'info');
    
    for (let i = 0; i < sampleCount && autoCollectionActive; i++) {
        try {
            const img = await webcam.capture();
            const activation = net.infer(img, true);
            classifier.addExample(activation, className);
            
            trainingData[className]++;
            updateCaptureStats();
            
            img.dispose();
            activation.dispose();
            
            // Wait between captures
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error('Error during auto sample collection:', error);
            break;
        }
    }
    
    autoCollectionActive = false;
    showMessage(`Collected ${trainingData[className]} samples for ${className}`, 'success');
}

// Start prediction webcam mode
async function startPredictionWebcam() {
    if (predictionMode) {
        return;
    }
    
    try {
        predictionMode = true;
        
        // Create prediction webcam container if it doesn't exist
        let predictionContainer = document.getElementById('prediction-webcam-container');
        if (!predictionContainer) {
            predictionContainer = document.createElement('div');
            predictionContainer.id = 'prediction-webcam-container';
            predictionContainer.innerHTML = `
                <div class="prediction-webcam-header">
                    <h3>Live Prediction</h3>
                    <button id="closePredictionWebcam" class="btn secondary">Close</button>
                </div>
                <div id="prediction-webcam"></div>
                <div id="live-prediction-results"></div>
            `;
            predictionContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 320px;
                background: white;
                border: 2px solid #007bff;
                border-radius: 10px;
                padding: 15px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 1000;
            `;
            document.body.appendChild(predictionContainer);
            
            // Add close button event
            document.getElementById('closePredictionWebcam').addEventListener('click', stopPredictionWebcam);
        }
        
        predictionContainer.style.display = 'block';
        
        // Create prediction webcam
        const predictionWebcamElement = document.getElementById('prediction-webcam');
        predictionWebcam = new Webcam(predictionWebcamElement, 'user');
        await predictionWebcam.setup();
        
        // Style the prediction webcam video
        const video = predictionWebcamElement.querySelector('video');
        if (video) {
            video.style.cssText = `
                width: 100%;
                height: 200px;
                object-fit: cover;
                border-radius: 5px;
            `;
        }
        
        // Start live predictions
        startLivePredictions();
        
    } catch (error) {
        console.error('Error starting prediction webcam:', error);
        throw error;
    }
}

// Stop prediction webcam mode
async function stopPredictionWebcam() {
    predictionMode = false;
    isPredicting = false;
    
    // Stop prediction webcam
    if (predictionWebcam) {
        await predictionWebcam.stop();
        predictionWebcam = null;
    }
    
    // Hide prediction container
    const predictionContainer = document.getElementById('prediction-webcam-container');
    if (predictionContainer) {
        predictionContainer.style.display = 'none';
    }
    
    showMessage('Prediction webcam stopped', 'info');
}

// Start live predictions on the prediction webcam
function startLivePredictions() {
    if (!predictionWebcam || !classifier || classifier.getNumClasses() === 0) {
        return;
    }
    
    isPredicting = true;
    makeLivePrediction();
}

// Make live predictions
async function makeLivePrediction() {
    if (!predictionWebcam || !predictionMode || !isPredicting) {
        return;
    }
    
    try {
        const img = await predictionWebcam.capture();
        const activation = net.infer(img, true);
        const result = await classifier.predictClass(activation);
        
        // Display live prediction results
        displayLivePredictions(result);
        
        img.dispose();
        activation.dispose();
        
        // Continue predicting
        if (isPredicting && predictionMode) {
            setTimeout(makeLivePrediction, 200);
        }
    } catch (error) {
        console.error('Error making live prediction:', error);
        if (isPredicting && predictionMode) {
            setTimeout(makeLivePrediction, 500); // Retry after longer delay
        }
    }
}

// Display live prediction results
function displayLivePredictions(result) {
    const liveResults = document.getElementById('live-prediction-results');
    if (!liveResults) return;
    
    const predictions = Object.entries(result.confidences)
        .map(([className, confidence]) => ({ className, confidence }))
        .sort((a, b) => b.confidence - a.confidence);
    
    const topPrediction = predictions[0];
    
    if (topPrediction && topPrediction.confidence > 0.6) {
        liveResults.innerHTML = `
            <div style="
                background: #28a745;
                color: white;
                padding: 10px;
                border-radius: 5px;
                text-align: center;
                margin-top: 10px;
                font-weight: bold;
            ">
                Detected: ${topPrediction.className}<br>
                Confidence: ${Math.round(topPrediction.confidence * 100)}%
            </div>
        `;
    } else {
        liveResults.innerHTML = `
            <div style="
                background: #6c757d;
                color: white;
                padding: 10px;
                border-radius: 5px;
                text-align: center;
                margin-top: 10px;
            ">
                No clear detection
            </div>
        `;
    }
}


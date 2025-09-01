// Global variables
let net;
let webcam;
let classifier = knnClassifier.create();
let classes = [];
let isTraining = false;
let isPredicting = false;
let currentClass = null;
let flipCamera = false;

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
    startTrainingBtn.addEventListener('click', startTraining);
    
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
    
    // Enable the train button if we have at least 2 classes
    if (classes.length >= 2) {
        trainBtn.disabled = false;
    }
    
    // Set the first class as current
    if (classes.length === 1) {
        setCurrentClass(className);
    }
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
    trainBtn.disabled = classes.length < 2;
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

// Train the model with the current class
async function trainModel() {
    if (!webcam || !currentClass) return;
    
    try {
        // Get the current frame from the webcam
        const img = await webcam.capture();
        
        // Get the intermediate activation of MobileNet 'conv_preds'
        const activation = net.infer(img, 'conv_preds');
        
        // Add the activation to the classifier
        classifier.addExample(activation, currentClass);
        
        // Dispose the tensor to avoid memory leaks
        img.dispose();
        
        // Show a success message
        showMessage(`Added example for class: ${currentClass}`, 'success');
        
        // If we're in training mode, continue training
        if (isTraining) {
            setTimeout(trainModel, 500);
        }
    } catch (error) {
        console.error('Error training model:', error);
        showMessage('Error training model. Please try again.', 'error');
    }
}

// Start/Stop prediction
async function togglePrediction() {
    if (isPredicting) {
        isPredicting = false;
        predictButton.textContent = 'Start Prediction';
        return;
    }
    
    if (classifier.getNumClasses() < 2) {
        alert('Please train the model with at least 2 classes first');
        return;
    }
    
    isPredicting = true;
    predictButton.textContent = 'Stop Prediction';
    
    // Start the prediction loop
    while (isPredicting) {
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
}

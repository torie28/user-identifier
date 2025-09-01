// Webcam class to handle webcam operations
class Webcam {
    constructor(webcamElement, facingMode = 'user', flip = false) {
        this.webcamElement = webcamElement;
        this.facingMode = facingMode;
        this.flip = flip;
        this.video = null;
    }
    
    async setup() {
        return new Promise((resolve, reject) => {
            // Create video element if it doesn't exist
            if (!this.video) {
                this.video = document.createElement('video');
                this.video.autoplay = true;
                this.video.muted = true;
                this.video.playsInline = true;
                this.webcamElement.appendChild(this.video);
            }
            
            // Get user media
            navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            }).then(stream => {
                this.video.srcObject = stream;
                this.video.play();
                
                // Apply flip if needed
                if (this.flip) {
                    this.video.style.transform = 'scaleX(-1)';
                }
                
                // Resolve when video is playing
                this.video.onplaying = () => {
                    resolve();
                };
            }).catch(error => {
                reject(error);
            });
        });
    }
    
    // Check if the webcam is currently streaming
    isStreaming() {
        return this.video && this.video.srcObject && this.video.srcObject.active;
    }
    
    // Start capturing frames at regular intervals
    startCapture(interval, onFrame) {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
        }
        
        this.captureInterval = setInterval(async () => {
            try {
                const frame = await this.capture();
                if (frame && onFrame) {
                    onFrame(frame);
                }
            } catch (error) {
                console.error('Error capturing frame:', error);
            }
        }, interval);
        
        return this.captureInterval;
    }
    
    // Stop capturing frames
    stopCapture() {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
    }
    
    // Capture a single frame from the webcam
    async capture() {
        if (!this.video) {
            throw new Error('Webcam not initialized');
        }
        
        // Create a canvas to capture the current frame
        const canvas = document.createElement('canvas');
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        
        // Draw the current frame to the canvas
        const ctx = canvas.getContext('2d');
        if (this.flip) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
        
        // Convert the canvas to a tensor
        const img = tf.browser.fromPixels(canvas);
        
        // Normalize the image
        const normalized = img.toFloat().div(127).sub(1);
        
        // Add a batch dimension
        const batched = normalized.expandDims(0);
        
        // Clean up
        img.dispose();
        normalized.dispose();
        
        return batched;
    }
    
    // Stop the webcam
    stop() {
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
        }
        
        if (this.webcamElement) {
            this.webcamElement.innerHTML = '';
        }
        
        this.video = null;
    }
}

// Make Webcam globally available
window.Webcam = Webcam;

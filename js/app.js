//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; 						//stream from getUserMedia()
var rec; 							//Recorder.js object
var input; 							//MediaStreamAudioSourceNode we'll be recording

// shim for AudioContext when it's not avb. 
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext //audio context to help us record

var recordButton = document.getElementById("recordButton");

//add events to those 2 buttons
recordButton.addEventListener("click", startRecording);

// Speech Recognition Variables
const webkitSpeechRecognition = window.webkitSpeechRecognition;
const recognition = new webkitSpeechRecognition();

recognition.continuous = false; // Stop after one input
recognition.interimResults = false; // Only final results
recognition.lang = "en-US"; // Set language (use "vi-VN" for Vietnamese)

// Handle transcription
recognition.onresult = function (event) {
	const transcript = event.results[0][0].transcript;
	
	fetch('http://192.168.31.239/post-message', {
		method: 'POST',
		headers: {
			'Content-Type': 'text/plain',
		},
		body: transcript
	})
	.then(response => response.text())
	.then(data => {
		console.log('Response from ESP32 (text):', data);
	})
	.catch((error) => {
		console.error('Error:', error);
	});
};

recognition.onerror = function (event) {
	console.error("Speech Recognition Error:", event.error);
};

function startRecording() {
	console.log("recordButton clicked");

	/*
		Simple constraints object, for more advanced audio features see
		https://addpipe.com/blog/audio-constraints-getusermedia/
	*/
    
    var constraints = { audio: true, video:false }

 	/*
    	Disable the record button until we get a success or fail from getUserMedia() 
	*/

	recordButton.disabled = true;

	recognition.start();

	/*
    	We're using the standard promise based getUserMedia() 
    	https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
	*/

	navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
		console.log("getUserMedia() success, stream created, initializing Recorder.js ...");

		/*
			create an audio context after getUserMedia is called
			sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
			the sampleRate defaults to the one set in your OS for your playback device

		*/
		audioContext = new AudioContext();

		//update the format 
		document.getElementById("formats").innerHTML="Format: 1 channel pcm @ "+audioContext.sampleRate/1000+"kHz"

		/*  assign to gumStream for later use  */
		gumStream = stream;
		
		/* use the stream */
		input = audioContext.createMediaStreamSource(stream);

		/* 
			Create the Recorder object and configure to record mono sound (1 channel)
			Recording 2 channels  will double the file size
		*/
		rec = new Recorder(input,{numChannels:1})

		//start the recording process
		rec.record()

		console.log("Recording started");

		// Automatically stop recording after 5 seconds
		setTimeout(() => {
			stopRecording();
			recognition.stop();
		}, 5000);

	}).catch(function(err) {
    	recordButton.disabled = false;
	});
}

function stopRecording() {
	console.log("stopButton clicked");

	recordButton.disabled = false;
	
	//tell the recorder to stop the recording
	rec.stop();

	//stop microphone access
	gumStream.getAudioTracks()[0].stop();

	rec.exportWAV(sendWAVtoCloud);
}

function sendWAVtoCloud(blob) {
	var filename = new Date().toISOString();

	// Automatically send the file to the API
    var formData = new FormData();
    formData.append("file", blob, filename + ".wav");

    // Replace the URL with your API endpoint
    fetch("http://192.168.0.100:5000/predict", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log("Server response:", data);
    })
    .catch(error => {
        console.error("Error uploading file:", error);
    });
}